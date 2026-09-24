import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { memories } from "@/data/memories";

export const STORAGE_KEY = "our-little-garden";

/** The "just because" letter, held back until every other letter has been read. */
export const FINAL_ID = memories.find((m) => m.flower === "final")?.id ?? "";
export const LETTER_IDS = memories.filter((m) => m.flower !== "final").map((m) => m.id);

export type Stage = "intro" | "entering" | "garden";
export type Quality = "high" | "low";

interface GardenState {
  /** False until opened letters have been restored from localStorage. */
  hydrated: boolean;
  /** Ids of letters she has opened. The only persisted field. */
  opened: string[];
  /** A letter read for the first time whose flower waits to bloom until the letter is closed. */
  pendingBloom: string | null;
  stage: Stage;
  sceneReady: boolean;
  hoveredId: string | null;
  activeId: string | null;
  /** True from closing the sixth letter until the final bloom has had its moment. */
  celebrating: boolean;
  notice: string | null;
  quality: Quality;
  debug: boolean;

  setSceneReady: () => void;
  enter: () => void;
  finishEntering: () => void;
  hover: (id: string) => void;
  unhover: (id: string) => void;
  selectFlower: (id: string) => void;
  markRead: (id: string) => void;
  closeLetter: () => void;
  endCelebration: () => void;
  clearNotice: () => void;
  setQuality: (quality: Quality) => void;
}

type BloomState = Pick<GardenState, "opened" | "pendingBloom">;

/** Letters whose flowers show as bloomed in the garden. */
export function bloomedIds(s: BloomState) {
  return s.opened.filter((id) => id !== s.pendingBloom);
}

export function bloomedLetterCount(s: BloomState) {
  return bloomedIds(s).filter((id) => LETTER_IDS.includes(id)).length;
}

export function isFinalUnlocked(s: BloomState) {
  return bloomedLetterCount(s) === LETTER_IDS.length;
}

/**
 * localStorage that ignores writes until saved progress has been restored.
 * Zustand's persist writes on every state change, so any update made before
 * rehydration (URL flags, scene ready, hover) would otherwise overwrite her
 * opened letters with an empty list.
 */
const progressStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    if (!useGardenStore.getState().hydrated) return;
    try {
      localStorage.setItem(name, value);
    } catch {
      // Storage full or unavailable (e.g. some private modes): progress just won't be remembered.
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Nothing to remove if storage is unavailable.
    }
  },
};

export const useGardenStore = create<GardenState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      opened: [],
      pendingBloom: null,
      stage: "intro",
      sceneReady: false,
      hoveredId: null,
      activeId: null,
      celebrating: false,
      notice: null,
      quality: "high",
      debug: false,

      setSceneReady: () => set({ sceneReady: true }),
      enter: () => set((s) => (s.stage === "intro" ? { stage: "entering" } : {})),
      finishEntering: () => set({ stage: "garden" }),

      hover: (id) => set({ hoveredId: id }),
      unhover: (id) => set((s) => (s.hoveredId === id ? { hoveredId: null } : {})),

      selectFlower: (id) => {
        const s = get();
        if (s.stage !== "garden" || s.activeId || s.celebrating) return;
        if (id === FINAL_ID && !isFinalUnlocked(s)) {
          set({ notice: "This one blooms after you've opened the other six." });
          return;
        }
        set({ activeId: id, hoveredId: null, notice: null });
      },

      markRead: (id) =>
        set((s) => (s.opened.includes(id) ? {} : { opened: [...s.opened, id], pendingBloom: id })),

      closeLetter: () =>
        set((s) => {
          const completesGarden =
            s.pendingBloom !== null &&
            s.pendingBloom !== FINAL_ID &&
            LETTER_IDS.every((id) => s.opened.includes(id));
          return {
            activeId: null,
            pendingBloom: null,
            celebrating: s.celebrating || completesGarden,
          };
        }),

      endCelebration: () => set({ celebrating: false }),
      clearNotice: () => set({ notice: null }),
      setQuality: (quality) => set({ quality }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => progressStorage),
      partialize: (s) => ({ opened: s.opened }),
      // Rehydrated from GardenExperience after mount, so server and client render the same first frame.
      skipHydration: true,
      onRehydrateStorage: () => () => useGardenStore.setState({ hydrated: true }),
    },
  ),
);
