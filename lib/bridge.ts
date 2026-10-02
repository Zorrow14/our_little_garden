import { type Frame, toLocal, toWorld } from "@/lib/frame";
import type { Point } from "@/lib/wander";

/**
 * A footbridge over a brook: from its origin (the near end) out along local
 * +z, arched in the middle, each end resting on its bank. The garden and the
 * far garden each have one, either side of the same brook.
 */
export interface BridgeSpan extends Frame {
  length: number;
  width: number;
  /** How far the middle arches above a straight line between the ends. */
  rise: number;
  /** Height of the boards at the near and far ends. */
  start: number;
  end: number;
}

/** Half the width you can walk along, between the handrails, and (wider) on the way up to the bridge, narrowing onto it. */
const WALK_HALF = 0.34;
const APPROACH_HALF = 0.8;

export function makeBridge(frame: Frame, length: number, height: (x: number, z: number) => number): BridgeSpan {
  const far = toWorld(frame, 0, length);
  return { ...frame, length, width: 1.0, rise: 0.38, start: height(frame.x, frame.z) + 0.06, end: height(far.x, far.z) + 0.06 };
}

/** The top of the boards `lz` along the bridge. */
export function deckAt(b: BridgeSpan, lz: number) {
  const t = Math.min(1, Math.max(0, lz / b.length));
  return b.start + (b.end - b.start) * t + b.rise * Math.sin(Math.PI * t);
}

/** The top of the boards at (x, z), if that's on the bridge. */
export function bridgeHeight(b: BridgeSpan, x: number, z: number): number | null {
  const l = toLocal(b, x, z);
  if (l.z < 0 || l.z > b.length || Math.abs(l.x) > b.width / 2) return null;
  return deckAt(b, l.z);
}

/**
 * How far (x, z) is off the way over the bridge: from `approach` units before
 * its near end (wide there, narrowing like a funnel so you're steered onto
 * it), down the middle between the handrails, to just short of its far end.
 * 0 on it.
 */
export function offBridgeWalkBy(b: BridgeSpan, x: number, z: number, approach: number) {
  const l = toLocal(b, x, z);
  const along = Math.max(-approach - l.z, l.z - (b.length - 0.15), 0);
  const narrowing = Math.min(1, Math.max(0, (l.z + 1.4) / 1.4));
  const half = APPROACH_HALF + (WALK_HALF - APPROACH_HALF) * narrowing * narrowing * (3 - 2 * narrowing);
  return Math.hypot(Math.max(Math.abs(l.x) - half, 0), along);
}

/** Where stepping onto the far end takes you across: an exit point, and how near counts. */
export function bridgeCrossing(b: BridgeSpan): { at: Point; radius: number } {
  return { at: toWorld(b, 0, b.length - 0.45), radius: 0.45 };
}

/** Where you arrive on this side, having crossed from the other: `back` units in from the near end, facing away from the bridge. */
export function bridgeLanding(b: BridgeSpan, back: number) {
  const p = toWorld(b, 0, -back);
  return { x: p.x, z: p.z, yaw: b.yaw + Math.PI };
}
