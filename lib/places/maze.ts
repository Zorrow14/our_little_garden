import type { RoomPlan, Solid } from "@/lib/rooms";
import type { Point } from "@/lib/wander";

/**
 * The hedge maze: a 7 × 7 grid of cells in its own space, centred on the
 * origin, with a clearing three cells across in the middle. You come in
 * through a gap in the near (+z) hedge. The first fork sends you left or
 * right: left winds up the side into dead ends, right climbs round the back
 * to the one way into the clearing, past a few side pockets. In the clearing,
 * a flower that grows nowhere else, and a few words for whoever finds it.
 *
 * The layout is the list of `PASSAGES` between neighbouring cells; every
 * other edge between cells is hedge. Change the maze by changing that list.
 */

/** What the flower in the middle says when you reach it (or click it). */
export const MAZE_SECRET = "You found the middle. I'd find my way to you through anything.";

export const CELL = 1.7;
export const MAZE_CELLS = 7;
export const MAZE_HALF = (CELL * MAZE_CELLS) / 2;
/** Hedges: half their thickness, and their height. */
export const HEDGE = { half: 0.22, height: 1.35 };

/** The clearing: cells 2 to 4 each way. */
const inClearing = (c: number, r: number) => c >= 2 && c <= 4 && r >= 2 && r <= 4;

/** The way in: through the near hedge into this cell. */
const ENTRY_CELL = 3;

/** Open edges between neighbouring cells, as "col,row-col,row". Row 0 is the far (-z) side. */
const PASSAGES = [
  // In from the gate, to the first fork.
  "3,6-3,5",
  // Left: along the front, then up the left side, into dead ends.
  "3,5-2,5", "2,5-2,6", "2,5-1,5", "1,5-1,6", "1,6-0,6", "0,6-0,5", "0,5-0,4", "0,4-1,4", "1,4-1,3", "1,3-0,3",
  "0,3-0,2", "0,2-1,2", "0,2-0,1", "0,1-1,1", "1,1-1,0", "1,0-0,0",
  // Right: along the front, up the right side, and round the back...
  "3,5-4,5", "4,5-4,6", "4,6-5,6", "5,6-6,6", "6,6-6,5", "6,5-5,5", "6,5-6,4", "6,4-5,4", "5,4-5,3", "5,3-6,3",
  "6,3-6,2", "6,2-5,2", "6,2-6,1", "6,1-5,1", "5,1-5,0", "5,0-6,0", "5,0-4,0", "4,0-4,1", "4,1-3,1",
  // ...to the way into the clearing, with one last pocket beside it.
  "3,1-3,2", "3,1-2,1", "2,1-2,0", "2,0-3,0",
];

const key = (a: number, b: number, c: number, d: number) => (a < c || (a === c && b < d) ? `${a},${b}-${c},${d}` : `${c},${d}-${a},${b}`);
const OPEN = new Set(
  PASSAGES.map((p) => {
    const [a, b] = p.split("-").map((s) => s.split(",").map(Number));
    return key(a[0], a[1], b[0], b[1]);
  }),
);

/** Where a grid corner is, in the maze's space. */
const corner = (c: number, r: number): Point => ({ x: c * CELL - MAZE_HALF, z: r * CELL - MAZE_HALF });
/** The middle of a cell. */
export const cellCentre = (c: number, r: number): Point => ({ x: (c + 0.5) * CELL - MAZE_HALF, z: (r + 0.5) * CELL - MAZE_HALF });

/**
 * Every run of hedge, as a line from corner to corner. Neighbouring stretches
 * in a row are joined into one, so there are fewer to walk round and to draw.
 */
function hedges(): { a: Point; b: Point }[] {
  const runs: { a: Point; b: Point }[] = [];
  const N = MAZE_CELLS;
  // Edges along x (between rows r - 1 and r, including the near and far sides).
  for (let r = 0; r <= N; r++) {
    let start: number | null = null;
    for (let c = 0; c <= N; c++) {
      let wall = false;
      if (c < N) {
        if (r === 0) wall = true;
        else if (r === N) wall = c !== ENTRY_CELL;
        else wall = !OPEN.has(key(c, r - 1, c, r)) && !(inClearing(c, r - 1) && inClearing(c, r));
      }
      if (wall && start === null) start = c;
      if (!wall && start !== null) {
        runs.push({ a: corner(start, r), b: corner(c, r) });
        start = null;
      }
    }
  }
  // Edges along z (between columns c - 1 and c).
  for (let c = 0; c <= N; c++) {
    let start: number | null = null;
    for (let r = 0; r <= N; r++) {
      let wall = false;
      if (r < N) {
        if (c === 0 || c === N) wall = true;
        else wall = !OPEN.has(key(c - 1, r, c, r)) && !(inClearing(c - 1, r) && inClearing(c, r));
      }
      if (wall && start === null) start = r;
      if (!wall && start !== null) {
        runs.push({ a: corner(c, start), b: corner(c, r) });
        start = null;
      }
    }
  }
  return runs;
}

export const HEDGES = hedges();

/** The flower in the middle, on its little round bed. */
export const SECRET_FLOWER = { x: 0, z: 0.25, r: 0.45 };
/** A stone bench facing the flower, and a lantern in each corner of the clearing. */
export const CLEARING_BENCH = { x: 0, z: 1.75, halfX: 0.55, halfZ: 0.17 };
export const CLEARING_LANTERNS: Point[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: sx * (CELL * 1.5 - 0.35), z: sz * (CELL * 1.5 - 0.35) })));

/** Inside the clearing (with a little margin), where the flower opens for you. */
export const inMazeClearing = (x: number, z: number) => Math.abs(x) < CELL * 1.5 - 0.3 && Math.abs(z) < CELL * 1.5 - 0.3;

export const MAZE_GATE = { x: cellCentre(ENTRY_CELL, MAZE_CELLS - 1).x, z: MAZE_HALF };

export const MAZE_PLAN: RoomPlan = {
  floor: { halfWidth: MAZE_HALF, halfDepth: MAZE_HALF },
  door: MAZE_GATE,
  solids: [...HEDGES.map((h): Solid => ({ ...h, half: HEDGE.half })), SECRET_FLOWER, CLEARING_BENCH, ...CLEARING_LANTERNS.map((p) => ({ ...p, r: 0.06 }))],
  tend: [{ stand: { x: 0, z: 1.2 }, face: SECRET_FLOWER }],
};
