import { create } from "zustand";

/**
 * Stargazing from the hill in the garden's back corner: standing on it (or
 * clicking it) lets the dusk deepen into full night, with a sky full of stars,
 * and the view tips up to look at them. Walking off brings the garden back.
 * Purely on this device; nothing is shared or stored.
 */

interface StargazingState {
  /** Whether the stars are out, and whether it's because you're standing on the hill or because you clicked it. */
  on: boolean;
  by: "hill" | "click" | null;
}

export const useStargazing = create<StargazingState>()(() => ({ on: false, by: null }));

/** Read and written every frame by the scene, so not React state. */
export const night = {
  /** 0 the usual blue dusk .. 1 deep night, easing between the two. */
  amount: 0,
  /** Set by clicking the hill from elsewhere; cleared by clicking it again or walking anywhere. */
  clicked: false,
  /** When it was clicked (`performance.now()`), so a walk already under way doesn't count as setting off. */
  clickedAt: 0,
  /** Whether your gardener was on the hill last frame. */
  onHill: false,
};

/** Clicking the hill: the stars come out, or (when they came out from a click) go back in. */
export function toggleStargazing() {
  const { on, by } = useStargazing.getState();
  if (!on) {
    night.clicked = true;
    night.clickedAt = performance.now();
  } else if (by === "click") {
    night.clicked = false;
  }
}

/** Back to the usual dusk at once, e.g. when leaving the garden. */
export function resetStargazing() {
  night.amount = 0;
  night.clicked = false;
  night.onHill = false;
  useStargazing.setState({ on: false, by: null });
}
