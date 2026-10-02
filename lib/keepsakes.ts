import { useMemo } from "react";
import { create } from "zustand";
import { memories } from "@/data/memories";
import { FLOWER_REGISTRY, type FlowerType } from "@/lib/flowerSpecs";
import { useGardenStore } from "@/lib/gardenStore";
import { usePlantStore } from "@/lib/plantStore";
import { plantKind } from "@/lib/plants";

/**
 * The keepsakes inside the cottage: the photo wall, the notes board and the
 * letter archive on the bookshelf. Each opens a panel when clicked; this file
 * says which one is open, and gathers the letters and photos they show.
 */

export type Keepsake = "photos" | "notes" | "archive";

interface KeepsakeState {
  open: Keepsake | null;
  /** Set while re-reading a letter from the archive, so closing it goes back to the shelf. */
  rereading: boolean;
}

export const useKeepsakes = create<KeepsakeState>()(() => ({ open: null, rereading: false }));

export function openKeepsake(which: Keepsake) {
  const g = useGardenStore.getState();
  if (g.stage !== "garden" || g.activeId || g.celebrating) return;
  useKeepsakes.setState({ open: which });
}

export function closeKeepsake() {
  useKeepsakes.setState({ open: null });
}

/** Re-reads an archived letter: the shelf closes, the letter opens, and closing the letter comes back to the shelf. */
export function rereadLetter(id: string) {
  useKeepsakes.setState({ open: null, rereading: true });
  useGardenStore.getState().selectFlower(id);
  if (!useGardenStore.getState().activeId) useKeepsakes.setState({ open: "archive", rereading: false });
}

export interface ArchivedLetter {
  id: string;
  label: string;
  flower: FlowerType;
  /** Who planted it, for letters from the shared garden. */
  by?: string;
  /** When it was planted, for letters from the shared garden. */
  on?: string;
  photo?: { src: string; alt: string };
}

/**
 * Every letter already opened on this device, original ones first, then the
 * planted ones in the order they were planted. Unopened letters never appear:
 * the archive is for re-reading, not a way round the garden.
 */
export function useOpenedLetters(): ArchivedLetter[] {
  const opened = useGardenStore((s) => s.opened);
  const plants = usePlantStore((s) => s.plants);
  const read = usePlantStore((s) => s.read);
  return useMemo(
    () => [
      ...memories
        .filter((m) => opened.includes(m.id))
        .map((m) => ({ id: m.id, label: m.label, flower: m.flower as FlowerType, photo: m.photo })),
      ...plants
        .filter((p) => read.includes(p.id))
        .map((p) => ({
          id: p.id,
          label: p.category_label,
          flower: plantKind(p.flower_type),
          by: p.planted_by,
          on: p.created_at,
          photo: p.photo_url ? { src: p.photo_url, alt: `A photo from ${p.planted_by}` } : undefined,
        })),
    ],
    [opened, plants, read],
  );
}

export interface WallPhoto {
  id: string;
  src: string;
  alt: string;
  label: string;
}

/** Photos from the letters opened so far, newest letters first: the photo wall never shows one from an unopened letter. */
export function useWallPhotos(): WallPhoto[] {
  const letters = useOpenedLetters();
  return useMemo(
    () =>
      letters
        .filter((l) => l.photo)
        .map((l) => ({ id: l.id, src: l.photo!.src, alt: l.photo!.alt, label: l.label }))
        .reverse(),
    [letters],
  );
}

/** The colour a letter's flower glows, for a small dot beside it in lists. */
export function flowerColor(flower: FlowerType) {
  return FLOWER_REGISTRY[flower].spec.glow;
}
