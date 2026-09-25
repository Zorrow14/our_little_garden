import type * as THREE from "three";
import { create } from "zustand";
import { useGardenStore } from "@/lib/gardenStore";
import { choosePlantSpot, fetchPlants, insertPlant, type NewPlant, type Plant, plantKind, uploadMedia } from "@/lib/plants";
import { supabase } from "@/lib/supabase";

const READ_KEY = "our-little-garden:read-plants";
const UNLOCK_KEY = "our-little-garden:plant-unlocked";
const NAME_KEY = "our-little-garden:planter";

interface PlantState {
  plants: Plant[];
  /** Plants that arrived while the garden was open. They grow in slowly, and beckon until read. */
  fresh: string[];
  /** Plants whose letters have been read on this device. */
  read: string[];
  /** False until the first fetch lands, so plants already in the garden aren't announced as new. */
  loaded: boolean;
  formOpen: boolean;

  receive: (rows: Plant[]) => void;
  markPlantRead: (id: string) => void;
  openForm: () => void;
  closeForm: () => void;
}

/** Ids planted from this tab, so their realtime echo isn't announced as someone else's. */
const mine = new Set<string>();

/** The scene's camera, for picking a spot the planter can see. Set by the Plants component. */
export const plantView = { camera: null as THREE.Camera | null };

export const usePlantStore = create<PlantState>()((set, get) => ({
  plants: [],
  fresh: [],
  read: [],
  loaded: false,
  formOpen: false,

  receive: (rows) => {
    const s = get();
    const known = new Set(s.plants.map((p) => p.id));
    const added = rows.filter((row) => !known.has(row.id));
    if (added.length === 0) {
      if (!s.loaded) set({ loaded: true });
      return;
    }
    const arrivedLive = s.loaded ? added : [];
    set({
      plants: [...s.plants, ...added].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      fresh: [...s.fresh, ...arrivedLive.map((p) => p.id)],
      loaded: true,
    });
    const fromThem = arrivedLive.filter((p) => !mine.has(p.id));
    if (fromThem.length > 0) {
      const who = fromThem[fromThem.length - 1].planted_by;
      useGardenStore.setState({
        notice: fromThem.length === 1 ? `${who} just planted something new.` : `${fromThem.length} new plants just sprouted.`,
      });
    }
  },

  markPlantRead: (id) => {
    const { read } = get();
    if (read.includes(id)) return;
    const next = [...read, id];
    set({ read: next });
    writeLocal(READ_KEY, JSON.stringify(next));
  },

  openForm: () => {
    const g = useGardenStore.getState();
    if (g.stage === "garden" && !g.activeId && !g.celebrating) set({ formOpen: true });
  },
  closeForm: () => set({ formOpen: false }),
}));

function readLocal(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (e.g. some private modes): it just won't be remembered next visit.
  }
}

/** Whether this device has already been let in with the passcode. */
export const planting = {
  isUnlocked: () => readLocal(UNLOCK_KEY) === "1",
  rememberUnlock: () => writeLocal(UNLOCK_KEY, "1"),
  savedName: () => readLocal(NAME_KEY) ?? "",
  saveName: (name: string) => writeLocal(NAME_KEY, name),
};

/**
 * Loads the shared garden and keeps it live: an initial fetch, a realtime
 * subscription for new plants, and a refetch whenever the connection comes back
 * or the tab returns to the foreground, in case anything was missed meanwhile.
 * Returns a cleanup function.
 */
export function startPlantSync() {
  try {
    const read = JSON.parse(readLocal(READ_KEY) ?? "[]");
    if (Array.isArray(read)) usePlantStore.setState({ read: read.filter((id) => typeof id === "string") });
  } catch {
    // Corrupt entry: start with nothing read.
  }

  const { receive } = usePlantStore.getState();
  let stopped = false;
  const refresh = async () => {
    try {
      const rows = await fetchPlants();
      if (!stopped) receive(rows);
    } catch (error) {
      console.warn("Couldn't load the shared garden", error);
    }
  };

  // A unique topic per subscription: realtime hands back an existing channel with the same name,
  // which would still be closing after a quick unmount and remount.
  const channel = supabase
    .channel(`plants-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "plants" }, (payload) => {
      if (!stopped) receive([payload.new as Plant]);
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
  };
}

/** Uploads any photo or voice note, picks a spot, and plants the letter. */
export async function plantLetter(letter: NewPlant, photo: File | null, audio: File | null) {
  const [photo_url, audio_url] = await Promise.all([
    photo ? uploadMedia(photo, "photos") : null,
    audio ? uploadMedia(audio, "audio") : null,
  ]);
  const { plants, receive, markPlantRead } = usePlantStore.getState();
  const taken = plants.map((p) => ({ x: p.position_x, z: p.position_z }));
  const [x, y, z] = choosePlantSpot(plantKind(letter.flower_type), taken, plantView.camera);
  const id = crypto.randomUUID();
  mine.add(id);
  const row = await insertPlant({ id, ...letter, photo_url, audio_url, position_x: x, position_y: y, position_z: z });
  // You wrote it, so it's already read here; it still grows in for you to watch.
  markPlantRead(id);
  receive([row]);
  return row;
}
