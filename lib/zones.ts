import { create } from "zustand";

/**
 * The places you can be: the garden, the inside of the cottage, the far
 * garden over the bridge, and the five places off the far garden. Each zone's
 * scene, spawn points and exits are registered in `components/zones/registry`;
 * this file holds just the names and which zone is showing, so the UI can use
 * them without pulling in three.js.
 */

export const ZONE_NAMES = ["garden", "house", "far-garden", "greenhouse", "treehouse", "gazebo", "lighthouse", "maze"] as const;
export type ZoneName = (typeof ZONE_NAMES)[number];

export const isZone = (value: unknown): value is ZoneName => ZONE_NAMES.includes(value as ZoneName);

/** Where someone is, for "Skelly is …". Add each new zone here too. */
export const ZONE_PLACES: Record<ZoneName, string> = {
  garden: "in the garden",
  house: "in the cottage",
  "far-garden": "in the far garden",
  greenhouse: "in the greenhouse",
  treehouse: "up in the treehouse",
  gazebo: "in the gazebo",
  lighthouse: "in the lighthouse",
  maze: "in the maze",
};

/** The same, in a word or two, for "Skelly · cottage" on narrow screens. */
export const ZONE_SHORT: Record<ZoneName, string> = {
  garden: "garden",
  house: "cottage",
  "far-garden": "far garden",
  greenhouse: "greenhouse",
  treehouse: "treehouse",
  gazebo: "gazebo",
  lighthouse: "lighthouse",
  maze: "maze",
};

/** Whether a zone is indoors, where the music is heard through the walls. */
export const ZONE_INDOORS: Record<ZoneName, boolean> = {
  garden: false,
  house: true,
  "far-garden": false,
  greenhouse: true,
  treehouse: true,
  gazebo: false,
  lighthouse: true,
  maze: false,
};

/** Where you arrive when the site opens. */
export const START_ZONE: ZoneName = "garden";
/** Where a gardener whose owner is away spends their time. */
export const HOME_ZONE: ZoneName = "house";

interface ZoneState {
  /** The zone on screen. */
  zone: ZoneName;
  /** The spawn point you arrived at, or null on first load. */
  arrival: string | null;
  /** Set while fading out on the way to another zone. */
  leaving: { to: ZoneName; spawn: string } | null;
}

export const useZone = create<ZoneState>()(() => ({
  zone: START_ZONE,
  arrival: null,
  leaving: null,
}));

/** Starts the walk through to another zone: the screen fades, then `arriveInZone` swaps the scene. */
export function goToZone(to: ZoneName, spawn: string) {
  const { zone, leaving } = useZone.getState();
  if (leaving || to === zone) return;
  useZone.setState({ leaving: { to, spawn } });
}

export function arriveInZone() {
  const { leaving } = useZone.getState();
  if (!leaving) return;
  useZone.setState({ zone: leaving.to, arrival: leaving.spawn, leaving: null });
}
