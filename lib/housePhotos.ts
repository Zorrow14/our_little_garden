import { create } from "zustand";
import { useGardenStore } from "@/lib/gardenStore";
import { uploadMedia } from "@/lib/plants";
import { supabase } from "@/lib/supabase";

/**
 * Photos hung straight on the cottage's photo wall, apart from any letter: kept
 * in the `house_photos` table (files under `house-photos/` in the media bucket)
 * and shared live, the same way notes are. They can be added and seen from the
 * site, never edited or taken down.
 */

export interface HousePhoto {
  id: string;
  url: string;
  caption: string | null;
  uploaded_by: string;
  created_at: string;
}

export const CAPTION_MAX = 200;

interface HousePhotosState {
  photos: HousePhoto[];
  /** False until the first fetch lands, so photos already on the wall aren't announced as new. */
  loaded: boolean;
  receive: (rows: HousePhoto[]) => void;
}

/** Ids uploaded from this tab, so their realtime echo isn't announced as someone else's. */
const mine = new Set<string>();

export const useHousePhotos = create<HousePhotosState>()((set, get) => ({
  photos: [],
  loaded: false,
  receive: (rows) => {
    const s = get();
    const known = new Set(s.photos.map((p) => p.id));
    const added = rows.filter((row) => !known.has(row.id));
    if (added.length === 0) {
      if (!s.loaded) set({ loaded: true });
      return;
    }
    set({ photos: [...s.photos, ...added].sort((a, b) => a.created_at.localeCompare(b.created_at)), loaded: true });
    const fromThem = s.loaded ? added.filter((p) => !mine.has(p.id)) : [];
    if (fromThem.length > 0) {
      useGardenStore.setState({ notice: `${fromThem[fromThem.length - 1].uploaded_by} hung a photo in the cottage.` });
    }
  },
}));

export async function fetchHousePhotos() {
  const { data, error } = await supabase.from("house_photos").select("*").order("created_at").returns<HousePhoto[]>();
  if (error) throw error;
  return data;
}

/** Loads the wall and keeps it live: realtime for new photos, and a refetch on reconnect or when the tab comes back. */
export function startHousePhotoSync() {
  const { receive } = useHousePhotos.getState();
  let stopped = false;
  const refresh = async () => {
    try {
      const rows = await fetchHousePhotos();
      if (!stopped) receive(rows);
    } catch (error) {
      console.warn("Couldn't load the photo wall", error);
    }
  };

  const channel = supabase
    .channel(`house-photos-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "house_photos" }, (payload) => {
      if (!stopped) receive([payload.new as HousePhoto]);
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

/** Shrinks and uploads the photo, then hangs it on the wall. */
export async function uploadHousePhoto(uploadedBy: string, file: File, caption?: string) {
  const url = await uploadMedia(file, "house-photos");
  const id = crypto.randomUUID();
  mine.add(id);
  const trimmed = caption?.trim().slice(0, CAPTION_MAX);
  const { data, error } = await supabase
    .from("house_photos")
    .insert({ id, url, caption: trimmed || null, uploaded_by: uploadedBy.trim().slice(0, 40) })
    .select()
    .single<HousePhoto>();
  if (error) throw error;
  useHousePhotos.getState().receive([data]);
  return data;
}
