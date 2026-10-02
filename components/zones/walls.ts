/**
 * Walls seen dollhouse-style: each is a plane facing into the room, so from
 * outside the ones nearest the camera are see-through. Used by the cottage
 * and the rooms off the far garden.
 */

/** One wall, as a plane facing into the room. `holes` leave gaps for the window and door. */
export interface WallSpec {
  /** Where the wall's left edge (seen from inside) starts, its length, and how it's turned. */
  position: [number, number, number];
  rotation: number;
  length: number;
  holes?: { from: number; to: number; bottom: number; top: number }[];
}

/** Rectangles covering a wall of `length` × `height` around its holes, in the wall's own 2D space. */
export function wallPanels(length: number, height: number, holes: WallSpec["holes"] = []) {
  const panels: { x: number; y: number; w: number; h: number }[] = [];
  const cuts = [...holes].sort((a, b) => a.from - b.from);
  let x = 0;
  for (const hole of cuts) {
    if (hole.from > x) panels.push({ x, y: 0, w: hole.from - x, h: height });
    if (hole.bottom > 0) panels.push({ x: hole.from, y: 0, w: hole.to - hole.from, h: hole.bottom });
    if (hole.top < height) panels.push({ x: hole.from, y: hole.top, w: hole.to - hole.from, h: height - hole.top });
    x = hole.to;
  }
  if (x < length) panels.push({ x, y: 0, w: length - x, h: height });
  return panels;
}

