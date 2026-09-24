import type { FlowerKind } from "@/data/memories";
import type { PetalShape } from "@/lib/petal";

export interface PetalLayer extends PetalShape {
  count: number;
  /** Distance of each petal's base from the centre of the flower. */
  radius: number;
  y: number;
  /** Lean away from vertical, in radians, when closed and when fully open. */
  closedTilt: number;
  openTilt: number;
  /** Rotates the ring so successive layers interleave. */
  twist: number;
}

export type FlowerCenter = "pod" | "stamens" | "dome" | "column" | "orb" | "none";

export interface FlowerSpec {
  layers: PetalLayer[];
  center: FlowerCenter;
  centerColor: string;
  /** Emissive tint of the petals and colour of the pool of light beneath the flower. */
  glow: string;
  /** 0 floats the flower on the water on a pad instead of a stem. */
  stemHeight: number;
  stemBend: number;
  /** Tilts the flower head toward the viewer, in radians. */
  headTilt: number;
  leaves: { count: number; length: number; width: number; spread: number; tilt: number } | null;
  /** How open the flower sits before its letter is read (1 = fully open). */
  restOpenness: number;
  /** Radius of the invisible tap target; generous so flowers are easy to hit on a phone. */
  hitRadius: number;
}

export const FLOWER_SPECS: Partial<Record<FlowerKind, FlowerSpec>> = {
  lotus: {
    layers: [
      { count: 8, length: 0.6, width: 0.4, cup: 0.55, curl: 0.08, tip: "pointed", baseColor: "#fde8ef", tipColor: "#ea7aa3", radius: 0.07, y: 0, closedTilt: 0.35, openTilt: 1.35, twist: 0 },
      { count: 8, length: 0.54, width: 0.38, cup: 0.6, curl: 0.02, tip: "pointed", baseColor: "#fff2f6", tipColor: "#f08fb3", radius: 0.06, y: 0.03, closedTilt: 0.2, openTilt: 0.95, twist: Math.PI / 8 },
      { count: 5, length: 0.44, width: 0.32, cup: 0.65, curl: -0.04, tip: "pointed", baseColor: "#fff8fa", tipColor: "#f6adc7", radius: 0.05, y: 0.06, closedTilt: 0.1, openTilt: 0.55, twist: 0.2 },
    ],
    center: "pod",
    centerColor: "#f0cf5e",
    glow: "#f59ab9",
    stemHeight: 0,
    stemBend: 0,
    headTilt: 0,
    leaves: null,
    restOpenness: 0.75,
    hitRadius: 0.8,
  },
};
