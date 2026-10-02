import type { RealtimeChannel } from "@supabase/supabase-js";
import { create } from "zustand";
import { useGardenStore } from "@/lib/gardenStore";
import { supabase } from "@/lib/supabase";
import { isZone, useZone, ZONE_PLACES, type ZoneName } from "@/lib/zones";

/**
 * The live garden: which of you is at the keyboard, who else is here right
 * now, which zone they're in, and where their gardener is walking. One
 * Supabase Realtime channel carries all of it (presence for who's online and
 * where, broadcast for movement, sitting, waves, and a nudge when a letter is
 * posted) and stays connected as you move between zones. Nothing here touches
 * the database.
 */

export const GARDENER_NAMES = ["Zorrow", "Skelly"] as const;
export type GardenerName = (typeof GARDENER_NAMES)[number];

const ME_KEY = "our-little-garden:me";
const TOPIC = "garden-live";

interface PresenceState {
  /** Which gardener this device walks as, or null until chosen. */
  me: GardenerName | null;
  /** False until the saved choice has been read, so the question doesn't flash up for a returning visitor. */
  identityLoaded: boolean;
  /** Everyone with the garden open right now (yourself included). */
  online: GardenerName[];
  /** Which zone each of them is in, as they last told presence. */
  zones: Partial<Record<GardenerName, ZoneName>>;
  /** Set once you've walked a step, which retires the "how to walk" hint. */
  walked: boolean;
}

export const usePresence = create<PresenceState>()(() => ({
  me: null,
  identityLoaded: false,
  online: [],
  zones: {},
  walked: false,
}));

const isGardener = (value: unknown): value is GardenerName => GARDENER_NAMES.includes(value as GardenerName);

function readMe(): GardenerName | null {
  try {
    const saved = localStorage.getItem(ME_KEY);
    return isGardener(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function chooseIdentity(name: GardenerName | null) {
  try {
    if (name) localStorage.setItem(ME_KEY, name);
    else localStorage.removeItem(ME_KEY);
  } catch {
    // Storage unavailable: it'll ask again next visit.
  }
  usePresence.setState({ me: name, identityLoaded: true });
}

export function markWalked() {
  if (!usePresence.getState().walked) usePresence.setState({ walked: true });
}

/** What a gardener's owner reports about them, several times a second while they move. */
export interface PoseMessage {
  who: GardenerName;
  x: number;
  z: number;
  yaw: number;
  /** Walking speed in units per second; 0 when standing. */
  pace: number;
  anim: "idle" | "walk" | "sit";
  /** The seat they're sitting on (see `lib/props`), while sitting. */
  seat?: string;
  /** The zone they're in. Only gardeners in your own zone are shown moving. */
  zone: ZoneName;
  /** Sender's clock, in ms. */
  sent: number;
}

/** A received pose, timed on this device's clock (`performance.now()`). */
export interface PoseSnapshot {
  at: number;
  x: number;
  z: number;
  yaw: number;
  pace: number;
  zone: ZoneName;
  seat: string | null;
}

interface LiveTrack {
  snapshots: PoseSnapshot[];
  /** Best estimate of (this clock − their clock), so their updates can be replayed evenly spaced. */
  offset: number;
  /** When the latest update arrived, on this device's clock. */
  heardAt: number;
}

/** Recent movement of each gardener someone else is walking. Read every frame by the scene, so not React state. */
export const liveTracks = new Map<GardenerName, LiveTrack>();

/** Bumped when someone waves at a gardener; the scene plays the wave when it sees the count change. */
export const greetSignals = new Map<GardenerName, number>();

/** Updates are replayed this far behind real time, so there's nearly always a next one to move toward. */
export const PLAYBACK_DELAY = 140;
/** Their gardener goes back to pottering about if nothing's been heard for this long (e.g. their tab is hidden). */
const STALE_AFTER = 8000;

/** The live update to show for `who` right now, interpolated between the two around the playback time. */
export function livePose(who: GardenerName, now: number): PoseSnapshot | null {
  const track = liveTracks.get(who);
  if (!track || track.snapshots.length === 0) return null;
  if (now - track.heardAt > STALE_AFTER || !usePresence.getState().online.includes(who)) return null;
  const { snapshots } = track;
  const t = now - PLAYBACK_DELAY;
  let i = snapshots.length - 1;
  while (i > 0 && snapshots[i - 1].at > t) i--;
  const next = snapshots[i];
  const prev = snapshots[i - 1];
  if (!prev || t >= next.at || prev.zone !== next.zone) return next;
  if (t <= prev.at) return prev;
  const k = (t - prev.at) / (next.at - prev.at);
  const turn = Math.atan2(Math.sin(next.yaw - prev.yaw), Math.cos(next.yaw - prev.yaw));
  return {
    at: t,
    x: prev.x + (next.x - prev.x) * k,
    z: prev.z + (next.z - prev.z) * k,
    yaw: prev.yaw + turn * k,
    pace: prev.pace + (next.pace - prev.pace) * k,
    zone: next.zone,
    seat: next.seat,
  };
}

let channel: RealtimeChannel | null = null;
let joined = false;
/** What presence currently says about us, as "name:zone", or null when not tracked. */
let tracked: string | null = null;

function receivePose(message: PoseMessage) {
  if (!isGardener(message.who) || message.who === usePresence.getState().me) return;
  if (![message.x, message.z, message.yaw, message.pace, message.sent].every(Number.isFinite) || !isZone(message.zone)) return;
  const now = performance.now();
  let track = liveTracks.get(message.who);
  // A long silence means a fresh start: don't interpolate from where they were minutes ago.
  if (!track || now - track.heardAt > STALE_AFTER) {
    track = { snapshots: [], offset: now - message.sent, heardAt: now };
    liveTracks.set(message.who, track);
  }
  // The quickest delivery seen is the best guide to the clock difference; let it relax slowly in case the route gets slower.
  track.offset = Math.min(track.offset + 1, now - message.sent);
  track.heardAt = now;
  const at = message.sent + track.offset;
  const last = track.snapshots[track.snapshots.length - 1];
  if (last && at <= last.at) return;
  // Through a door into another zone: start afresh there rather than gliding between the two.
  if (last && last.zone !== message.zone) track.snapshots.length = 0;
  const seat = message.anim === "sit" && typeof message.seat === "string" ? message.seat.slice(0, 24) : null;
  track.snapshots.push({ at, x: message.x, z: message.z, yaw: message.yaw, pace: message.pace, zone: message.zone, seat });
  if (track.snapshots.length > 20) track.snapshots.shift();
}

function receiveGreet(payload: { to?: unknown; from?: unknown }) {
  if (!isGardener(payload.to)) return;
  greetSignals.set(payload.to, (greetSignals.get(payload.to) ?? 0) + 1);
  const { me } = usePresence.getState();
  if (payload.to === me && isGardener(payload.from) && payload.from !== me) {
    useGardenStore.setState({ notice: `${payload.from} waved at you.` });
  }
}

/** Called when the other person posts a letter, so the mailbox can check what's on its way. */
const mailListeners = new Set<() => void>();

export function onMailNudge(listener: () => void) {
  mailListeners.add(listener);
  return () => {
    mailListeners.delete(listener);
  };
}

/** Announces arrivals: "is here" when you walk in to find them, "just came in" when they arrive after you. */
let firstSync = true;
let waitingHello: GardenerName | null = null;

function hereText(name: GardenerName) {
  const zone = usePresence.getState().zones[name];
  return `${name} is ${ZONE_PLACES[zone ?? "garden"]} right now.`;
}

function sayHello(name: GardenerName, already: boolean) {
  const text = already ? hereText(name) : `${name} just came into the garden.`;
  if (useGardenStore.getState().stage === "garden") useGardenStore.setState({ notice: text });
  else waitingHello = name;
}

function receivePresence() {
  if (!channel) return;
  const names = new Set<GardenerName>();
  const zones: PresenceState["zones"] = {};
  for (const metas of Object.values(channel.presenceState<{ who?: unknown; zone?: unknown }>())) {
    for (const meta of metas) {
      if (!isGardener(meta.who)) continue;
      names.add(meta.who);
      if (isZone(meta.zone)) zones[meta.who] = meta.zone;
    }
  }
  const online = GARDENER_NAMES.filter((n) => names.has(n));
  const { me, online: before } = usePresence.getState();
  const arrived = online.filter((n) => n !== me && !before.includes(n));
  usePresence.setState({ online, zones });
  if (arrived.length > 0) sayHello(arrived[0], firstSync);
  firstSync = false;
}

/** Shows up as online (and in which zone) once you've chosen who you are and stepped past the title screen. */
function updateTracking() {
  if (!channel || !joined) return;
  const { me } = usePresence.getState();
  const { zone } = useZone.getState();
  const want = me && useGardenStore.getState().stage !== "intro" ? `${me}:${zone}` : null;
  if (want === tracked) return;
  tracked = want;
  void (me && want ? channel.track({ who: me, zone }) : channel.untrack());
}

/**
 * Joins the shared live channel. Runs once for the life of the page: the
 * channel name is shared, and realtime would hand a quick remount the
 * previous, still-closing channel.
 */
export function startPresence() {
  if (channel) return;
  const saved = readMe();
  usePresence.setState({ me: saved, identityLoaded: true });

  channel = supabase.channel(TOPIC, { config: { broadcast: { self: false, ack: false } } });
  channel
    .on("presence", { event: "sync" }, receivePresence)
    .on("broadcast", { event: "pose" }, ({ payload }) => receivePose(payload as PoseMessage))
    .on("broadcast", { event: "greet" }, ({ payload }) => receiveGreet(payload as { to?: unknown; from?: unknown }))
    .on("broadcast", { event: "mail" }, () => mailListeners.forEach((listener) => listener()))
    .subscribe((status) => {
      joined = status === "SUBSCRIBED";
      if (joined) {
        // A reconnect starts presence afresh on the server, so track again.
        tracked = null;
        updateTracking();
      }
    });

  usePresence.subscribe((s, prev) => {
    if (s.me !== prev.me) updateTracking();
  });
  useZone.subscribe((s, prev) => {
    if (s.zone !== prev.zone) updateTracking();
  });
  useGardenStore.subscribe((s, prev) => {
    if (s.stage === prev.stage) return;
    updateTracking();
    if (s.stage === "garden" && waitingHello) {
      const name = waitingHello;
      waitingHello = null;
      if (usePresence.getState().online.includes(name)) useGardenStore.setState({ notice: hereText(name) });
    }
  });
}

/** Sends the local gardener's pose. The scene calls this a dozen times a second at most. */
export function sendPose(pose: Omit<PoseMessage, "who" | "sent">) {
  const { me } = usePresence.getState();
  if (!channel || !joined || !me) return;
  const message: PoseMessage = { who: me, sent: Date.now(), ...pose };
  void channel.send({ type: "broadcast", event: "pose", payload: message });
}

export function sendGreet(to: GardenerName) {
  if (!channel || !joined) return;
  void channel.send({ type: "broadcast", event: "greet", payload: { to, from: usePresence.getState().me } });
}

/** Tells the other device a letter was just posted. It holds nothing: they fetch what's on its way themselves. */
export function sendMailNudge() {
  if (!channel || !joined) return;
  void channel.send({ type: "broadcast", event: "mail", payload: {} });
}
