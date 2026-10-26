import { create } from "zustand";
import { useFestival } from "@/lib/festivals";
import { useGardenStore } from "@/lib/gardenStore";
import type { GardenerName } from "@/lib/presence";
import { supabase } from "@/lib/supabase";

/**
 * Lamps lit in the garden during a festival, kept in the `festival_lamps`
 * table and shared live, the way notes are. Each is where its gardener stood,
 * with an optional dedication. They can be lit and seen from the site, never
 * moved or put out, and each of you can light up to `LAMP_CAP` per festival
 * (the database holds to that too).
 */

export interface FestivalLamp {
  id: string;
  festival: string;
  lit_by: GardenerName;
  dedication: string | null;
  x: number;
  z: number;
  created_at: string;
}

export const LAMP_CAP = 30;
export const DEDICATION_MAX = 80;

interface LampsState {
  lamps: FestivalLamp[];
  /** False until the first fetch lands, so lamps already lit aren't announced as new. */
  loaded: boolean;
  /** Lamps that arrived after the first fetch, by id: they light up as they appear. */
  fresh: Set<string>;
  receive: (rows: FestivalLamp[]) => void;
  clear: () => void;
}

/** Ids lit from this tab, so their realtime echo isn't announced as someone else's. */
const mine = new Set<string>();

export const useLamps = create<LampsState>()((set, get) => ({
  lamps: [],
  loaded: false,
  fresh: new Set(),
  receive: (rows) => {
    const s = get();
    const festival = useFestival.getState().festival?.id;
    const known = new Set(s.lamps.map((l) => l.id));
    const added = rows.filter((row) => row.festival === festival && !known.has(row.id));
    if (added.length === 0) {
      if (!s.loaded) set({ loaded: true });
      return;
    }
    const fresh = s.loaded ? new Set([...s.fresh, ...added.map((l) => l.id)]) : s.fresh;
    set({ lamps: [...s.lamps, ...added].sort((a, b) => a.created_at.localeCompare(b.created_at)), loaded: true, fresh });
    const fromThem = s.loaded ? added.filter((l) => !mine.has(l.id)) : [];
    if (fromThem.length > 0) {
      const lamp = fromThem[fromThem.length - 1];
      useGardenStore.setState({ notice: `${lamp.lit_by} lit a lamp in the garden.` });
    }
  },
  clear: () => set({ lamps: [], loaded: false, fresh: new Set() }),
}));

/** How many lamps someone has lit this festival. */
export const litBy = (lamps: FestivalLamp[], who: string | null) => lamps.filter((l) => l.lit_by === who).length;

async function fetchLamps(festival: string) {
  const { data, error } = await supabase.from("festival_lamps").select("*").eq("festival", festival).order("created_at").returns<FestivalLamp[]>();
  if (error) throw error;
  return data;
}

/** Loads one festival's lamps and keeps them live: realtime for new ones, and a refetch on reconnect or when the tab comes back. */
function syncFestival(festival: string) {
  const { receive } = useLamps.getState();
  let stopped = false;
  const refresh = async () => {
    try {
      const rows = await fetchLamps(festival);
      if (!stopped) receive(rows);
    } catch (error) {
      console.warn("Couldn't load the festival lamps", error);
    }
  };

  const channel = supabase
    .channel(`lamps-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "festival_lamps", filter: `festival=eq.${festival}` }, (payload) => {
      if (!stopped) receive([payload.new as FestivalLamp]);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") void refresh();
    });
  void refresh();

  const onVisible = () => {
    if (document.visibilityState === "visible") void refresh();
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisible);
    void supabase.removeChannel(channel);
    useLamps.getState().clear();
  };
}

/** Keeps the lamps of whichever festival is on in sync, and lets them go when it ends. */
export function startLampSync() {
  let stop: (() => void) | null = null;
  let syncing: string | null = null;
  const follow = (festival: string | null) => {
    if (festival === syncing) return;
    stop?.();
    stop = festival ? syncFestival(festival) : null;
    syncing = festival;
  };
  follow(useFestival.getState().festival?.id ?? null);
  const unsubscribe = useFestival.subscribe((s) => follow(s.festival?.id ?? null));
  return () => {
    unsubscribe();
    follow(null);
  };
}

/** Lights a lamp at (x, z), with an optional dedication. */
export async function lightLamp(festival: string, litBy: GardenerName, dedication: string, x: number, z: number) {
  const id = crypto.randomUUID();
  mine.add(id);
  const words = dedication.trim().slice(0, DEDICATION_MAX);
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const { data, error } = await supabase
    .from("festival_lamps")
    .insert({ id, festival, lit_by: litBy, dedication: words || null, x: round(x), z: round(z) })
    .select()
    .single<FestivalLamp>();
  if (error) throw error;
  useLamps.getState().receive([data]);
  return data;
}
