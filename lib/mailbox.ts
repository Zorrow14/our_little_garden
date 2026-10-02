import { create } from "zustand";
import { useGardenStore } from "@/lib/gardenStore";
import { GARDENER_NAMES, type GardenerName, onMailNudge, sendMailNudge, usePresence } from "@/lib/presence";
import { supabase } from "@/lib/supabase";

/**
 * The mailbox by the gate: letters to the other person that take their time
 * arriving. Each is a row in the `mailbox` table with when it should arrive
 * (`deliver_at`), and the database only hands a letter out once that time has
 * passed. Until then all either of you can see is that something is on its way:
 * `mailbox_pending()` says who sent it and when it lands, never what it says.
 * `delivered` is set once its recipient has opened it.
 */

export interface MailLetter {
  id: string;
  author: GardenerName;
  message: string;
  created_at: string;
  deliver_at: string;
  delivered: boolean;
}

export interface InTransit {
  id: string;
  author: GardenerName;
  deliver_at: string;
}

export const MAIL_MAX = 1000;

/** How long a letter takes to arrive: the sender picks one, and `deliver_at` is worked out from it when it's posted. */
export const DELAYS = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
] as const;
export const DEFAULT_DELAY_DAYS = 1;

/**
 * A vague idea of when something on its way will arrive, for whoever it's
 * coming to: never the exact time, to keep a little anticipation.
 */
export function arrivalHint(deliverAt: string, now = Date.now()) {
  return Date.parse(deliverAt) - now <= 24 * 60 * 60 * 1000 ? "soon" : "in a few days";
}

/** Letters always go to the other one of you. */
export function recipientOf(author: GardenerName): GardenerName {
  return author === GARDENER_NAMES[0] ? GARDENER_NAMES[1] : GARDENER_NAMES[0];
}

interface MailState {
  /** Letters that have arrived (to either of you), oldest first. */
  letters: MailLetter[];
  /** Letters still on their way, soonest first. */
  transit: InTransit[];
  loaded: boolean;
}

export const useMail = create<MailState>()(() => ({ letters: [], transit: [], loaded: false }));

/** How many letters have arrived for you and not been opened yet. */
export function useWaitingMail() {
  const me = usePresence((s) => s.me);
  return useMail((s) => (me ? s.letters.filter((l) => recipientOf(l.author) === me && !l.delivered).length : 0));
}

/** Letters already announced this visit, so "you've got mail" is said once per letter. */
const announced = new Set<string>();

/** "You've got mail", for letters that have arrived for you, once you're in the garden and not reading something else. */
function announceArrivals() {
  const { me } = usePresence.getState();
  const g = useGardenStore.getState();
  if (!me || g.stage !== "garden" || g.activeId || g.celebrating) return;
  const fresh = useMail.getState().letters.filter((l) => recipientOf(l.author) === me && !l.delivered && !announced.has(l.id));
  if (fresh.length === 0) return;
  fresh.forEach((l) => announced.add(l.id));
  useGardenStore.setState({
    notice:
      fresh.length > 1
        ? `You've got mail! ${fresh.length} letters are waiting in the mailbox by the gate.`
        : `You've got mail! A letter from ${fresh[0].author} is waiting in the mailbox by the gate.`,
  });
}

async function fetchMail() {
  const [arrived, pending] = await Promise.all([
    supabase.from("mailbox").select("*").order("deliver_at").returns<MailLetter[]>(),
    supabase.rpc("mailbox_pending"),
  ]);
  if (arrived.error) throw arrived.error;
  if (pending.error) throw pending.error;
  return { letters: arrived.data ?? [], transit: (pending.data ?? []) as InTransit[] };
}

/** Checks the mailbox now, if it's being kept up to date. */
let refreshMail: (() => void) | null = null;

/**
 * Keeps the mailbox up to date: a check when the page opens, when the tab comes
 * back, when the other person posts something, and just after the next letter
 * on its way is due; realtime for letters being opened.
 */
export function startMailSync() {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const refresh = async () => {
    try {
      const { letters, transit } = await fetchMail();
      if (stopped) return;
      useMail.setState({ letters, transit, loaded: true });
      announceArrivals();
      clearTimeout(timer);
      const next = transit[0];
      if (next) {
        // The server's clock decides when it's arrived, so look a moment after it's due, and again later if it's still not there.
        const due = Date.parse(next.deliver_at) - Date.now();
        timer = setTimeout(() => void refresh(), Math.min(Math.max(due + 1500, 10_000), 6 * 60 * 60 * 1000));
      }
    } catch (error) {
      console.warn("Couldn't check the mailbox", error);
    }
  };
  refreshMail = () => void refresh();

  const channel = supabase
    .channel(`mailbox-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "mailbox" }, () => {
      if (!stopped) void refresh();
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") void refresh();
    });
  void refresh();

  const stopNudges = onMailNudge(() => void refresh());
  const onVisible = () => {
    if (document.visibilityState === "visible") void refresh();
  };
  document.addEventListener("visibilitychange", onVisible);
  const every = setInterval(() => void refresh(), 5 * 60 * 1000);
  // Hold "you've got mail" until you're in the garden, and not in the middle of a letter.
  const stopGarden = useGardenStore.subscribe((s, prev) => {
    if (s.stage !== prev.stage || s.activeId !== prev.activeId || s.celebrating !== prev.celebrating) announceArrivals();
  });
  const stopPresence = usePresence.subscribe((s, prev) => {
    if (s.me !== prev.me) announceArrivals();
  });

  return () => {
    stopped = true;
    refreshMail = null;
    clearTimeout(timer);
    clearInterval(every);
    stopNudges();
    stopGarden();
    stopPresence();
    document.removeEventListener("visibilitychange", onVisible);
    void supabase.removeChannel(channel);
  };
}

/** Posts a letter to the other person, to arrive `days` from now. Returns when it'll arrive. */
export async function postLetter(author: GardenerName, message: string, days: number) {
  const id = crypto.randomUUID();
  const deliver_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  // No row comes back: the table won't hand out a letter before it has arrived, even to its sender.
  const { error } = await supabase.from("mailbox").insert({ id, author, message: message.trim().slice(0, MAIL_MAX), deliver_at });
  if (error) throw error;
  useMail.setState((s) => ({
    transit: [...s.transit, { id, author, deliver_at }].sort((a, b) => a.deliver_at.localeCompare(b.deliver_at)),
  }));
  sendMailNudge();
  refreshMail?.();
  return deliver_at;
}

/** Opening a letter that came for you marks it delivered, on both devices. */
export async function markDelivered(id: string) {
  const { me } = usePresence.getState();
  const letter = useMail.getState().letters.find((l) => l.id === id);
  if (!letter || letter.delivered || recipientOf(letter.author) !== me) return;
  useMail.setState((s) => ({ letters: s.letters.map((l) => (l.id === id ? { ...l, delivered: true } : l)) }));
  const { error } = await supabase.from("mailbox").update({ delivered: true }).eq("id", id);
  if (error) console.warn("Couldn't mark the letter as read", error);
}
