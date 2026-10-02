import { create } from "zustand";
import { useGardenStore } from "@/lib/gardenStore";
import { supabase } from "@/lib/supabase";

/**
 * The corkboard inside the cottage: short notes either of you can pin, kept in
 * the `notes` table and shared live, the same way planted flowers are. Notes
 * can be added and read from the site, never edited or taken down.
 */

export interface Note {
  id: string;
  author: string;
  message: string;
  created_at: string;
}

export const NOTE_MAX = 280;

interface NotesState {
  notes: Note[];
  /** False until the first fetch lands, so notes already on the board aren't announced as new. */
  loaded: boolean;
  receive: (rows: Note[]) => void;
}

/** Ids pinned from this tab, so their realtime echo isn't announced as someone else's. */
const mine = new Set<string>();

export const useNotes = create<NotesState>()((set, get) => ({
  notes: [],
  loaded: false,
  receive: (rows) => {
    const s = get();
    const known = new Set(s.notes.map((n) => n.id));
    const added = rows.filter((row) => !known.has(row.id));
    if (added.length === 0) {
      if (!s.loaded) set({ loaded: true });
      return;
    }
    set({ notes: [...s.notes, ...added].sort((a, b) => a.created_at.localeCompare(b.created_at)), loaded: true });
    const fromThem = s.loaded ? added.filter((n) => !mine.has(n.id)) : [];
    if (fromThem.length > 0) {
      useGardenStore.setState({ notice: `${fromThem[fromThem.length - 1].author} pinned a note in the cottage.` });
    }
  },
}));

async function fetchNotes() {
  const { data, error } = await supabase.from("notes").select("*").order("created_at").returns<Note[]>();
  if (error) throw error;
  return data;
}

/** Loads the board and keeps it live: realtime for new notes, and a refetch on reconnect or when the tab comes back. */
export function startNoteSync() {
  const { receive } = useNotes.getState();
  let stopped = false;
  const refresh = async () => {
    try {
      const rows = await fetchNotes();
      if (!stopped) receive(rows);
    } catch (error) {
      console.warn("Couldn't load the notes board", error);
    }
  };

  const channel = supabase
    .channel(`notes-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notes" }, (payload) => {
      if (!stopped) receive([payload.new as Note]);
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

export async function pinNote(author: string, message: string) {
  const id = crypto.randomUUID();
  mine.add(id);
  const { data, error } = await supabase
    .from("notes")
    .insert({ id, author: author.trim().slice(0, 40), message: message.trim().slice(0, NOTE_MAX) })
    .select()
    .single<Note>();
  if (error) throw error;
  useNotes.getState().receive([data]);
  return data;
}
