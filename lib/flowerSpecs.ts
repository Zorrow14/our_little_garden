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

export interface FlowerEntry {
  /** How the flower is named in the planting form. */
  name: string;
  /** The "open when…" it suggests when chosen in the planting form. */
  label: string;
  /** Whether it's offered in the planting form. The moon lotus stays reserved for the last original letter. */
  plantable: boolean;
  spec: FlowerSpec;
}

/**
 * Every known flower type: what it's called, what it means, and how it looks.
 *
 * Being in the registry doesn't put a flower in the garden. What's pre-placed
 * on load is a separate list, FLOWER_SPOTS in lib/layout.ts (the original
 * letters in data/memories.ts). Everything else only appears once one of you
 * plants it from the "Plant something" form, whose choices come from here.
 */
export const FLOWER_REGISTRY = {
  lotus: {
    name: "Lotus",
    label: "Open when you feel far from me",
    plantable: true,
    spec: {
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
  },

  // Six recurved tepals, blush at the throat fading to white, with long stamens.
  lily: {
    name: "Lily",
    label: "Open when you're sad",
    plantable: true,
    spec: {
      layers: [
        { count: 3, length: 0.78, width: 0.28, cup: 0.25, curl: 0.4, tip: "pointed", baseColor: "#f09ab8", tipColor: "#fff7fa", radius: 0.03, y: 0, closedTilt: 0.15, openTilt: 1.2, twist: 0 },
        { count: 3, length: 0.74, width: 0.34, cup: 0.3, curl: 0.35, tip: "pointed", baseColor: "#ec8fb0", tipColor: "#fffafc", radius: 0.03, y: 0.01, closedTilt: 0.12, openTilt: 1.1, twist: Math.PI / 3 },
      ],
      center: "stamens",
      centerColor: "#c4632c",
      glow: "#f7c6d6",
      stemHeight: 1.25,
      stemBend: 0.12,
      headTilt: 0.55,
      leaves: { count: 6, length: 0.5, width: 0.1, spread: 0.7, tilt: 0.9 },
      restOpenness: 0.8,
      hitRadius: 0.6,
    },
  },

  // A deep coral cup that stays mostly closed until its letter is read.
  tulip: {
    name: "Tulip",
    label: "Open when you're mad at me",
    plantable: true,
    spec: {
      layers: [
        { count: 3, length: 0.5, width: 0.4, cup: 0.7, curl: -0.1, tip: "round", baseColor: "#a3243b", tipColor: "#f0566f", radius: 0.02, y: 0, closedTilt: 0.05, openTilt: 0.75, twist: 0 },
        { count: 3, length: 0.48, width: 0.4, cup: 0.7, curl: -0.12, tip: "round", baseColor: "#9a1f36", tipColor: "#e94a66", radius: 0.01, y: 0.01, closedTilt: 0.02, openTilt: 0.55, twist: Math.PI / 3 },
      ],
      center: "none",
      centerColor: "#2b2b2b",
      glow: "#f06a82",
      stemHeight: 0.95,
      stemBend: 0.08,
      headTilt: 0.1,
      leaves: { count: 2, length: 0.65, width: 0.2, spread: 0, tilt: 0.45 },
      restOpenness: 0.45,
      hitRadius: 0.5,
    },
  },

  // Rings of rounded petals, tight at the heart and loosening outward.
  rose: {
    name: "Rose",
    label: "Open when you can't sleep",
    plantable: true,
    spec: {
      layers: [
        { count: 3, length: 0.26, width: 0.26, cup: 0.8, curl: -0.18, tip: "round", baseColor: "#5e0b1d", tipColor: "#a8182f", radius: 0, y: 0.08, closedTilt: 0.02, openTilt: 0.12, twist: 0 },
        { count: 5, length: 0.32, width: 0.3, cup: 0.65, curl: -0.05, tip: "round", baseColor: "#6a0e22", tipColor: "#bc2038", radius: 0.02, y: 0.05, closedTilt: 0.06, openTilt: 0.38, twist: 0.6 },
        { count: 5, length: 0.38, width: 0.34, cup: 0.5, curl: 0.12, tip: "round", baseColor: "#74112a", tipColor: "#cc2a44", radius: 0.03, y: 0.03, closedTilt: 0.12, openTilt: 0.75, twist: 1.25 },
        { count: 7, length: 0.42, width: 0.36, cup: 0.35, curl: 0.28, tip: "round", baseColor: "#7d152f", tipColor: "#d8384f", radius: 0.04, y: 0, closedTilt: 0.25, openTilt: 1.15, twist: 0.3 },
      ],
      center: "none",
      centerColor: "#000000",
      glow: "#e0445c",
      stemHeight: 1.05,
      stemBend: 0.1,
      headTilt: 0.35,
      leaves: { count: 4, length: 0.26, width: 0.14, spread: 0.6, tilt: 1 },
      restOpenness: 0.7,
      hitRadius: 0.5,
    },
  },

  // Two rings of slim white rays around a golden dome.
  daisy: {
    name: "Daisy",
    label: "Open when you doubt us",
    plantable: true,
    spec: {
      layers: [
        { count: 18, length: 0.36, width: 0.085, cup: 0.15, curl: 0.06, tip: "round", baseColor: "#eeeae6", tipColor: "#ffffff", radius: 0.08, y: 0, closedTilt: 0.5, openTilt: 1.42, twist: 0 },
        { count: 16, length: 0.32, width: 0.08, cup: 0.15, curl: 0.04, tip: "round", baseColor: "#f4f1ee", tipColor: "#ffffff", radius: 0.07, y: 0.012, closedTilt: 0.4, openTilt: 1.3, twist: 0.17 },
      ],
      center: "dome",
      centerColor: "#f2bf2c",
      glow: "#fff2b8",
      stemHeight: 0.8,
      stemBend: 0.1,
      headTilt: 0.5,
      leaves: { count: 3, length: 0.3, width: 0.1, spread: 0.3, tilt: 1.1 },
      restOpenness: 0.8,
      hitRadius: 0.5,
    },
  },

  // A moth orchid facing outward: sepals up and down, broad petals left and right, a golden-throated lip.
  orchid: {
    name: "Orchid",
    label: "Open when you miss me",
    plantable: true,
    spec: {
      layers: [
        { count: 3, length: 0.36, width: 0.17, cup: 0.12, curl: 0.05, tip: "round", baseColor: "#b0317a", tipColor: "#e58bc0", radius: 0.02, y: 0, closedTilt: 0.35, openTilt: 1.45, twist: Math.PI },
        { count: 2, length: 0.34, width: 0.34, cup: 0.12, curl: 0.04, tip: "round", baseColor: "#a92a74", tipColor: "#ef9fcb", radius: 0.02, y: 0.005, closedTilt: 0.3, openTilt: 1.38, twist: Math.PI / 2 },
        { count: 1, length: 0.22, width: 0.2, cup: 0.7, curl: 0.1, tip: "round", baseColor: "#f2c14e", tipColor: "#7d1350", radius: 0.02, y: 0.02, closedTilt: 0.3, openTilt: 1.05, twist: 0 },
      ],
      center: "column",
      centerColor: "#fbf2dc",
      glow: "#e27ab8",
      stemHeight: 1.15,
      stemBend: 0.3,
      headTilt: 1.2,
      leaves: { count: 3, length: 0.5, width: 0.2, spread: 0, tilt: 1.25 },
      restOpenness: 0.8,
      hitRadius: 0.55,
    },
  },

  // The final bloom: a moonlit lotus in white and gold that glows once the other six are read.
  final: {
    name: "Moon lotus",
    label: "Open anytime, just because",
    plantable: false,
    spec: {
      layers: [
        { count: 10, length: 0.62, width: 0.4, cup: 0.55, curl: 0.08, tip: "pointed", baseColor: "#fff4d6", tipColor: "#f3c867", radius: 0.08, y: 0, closedTilt: 0.12, openTilt: 1.3, twist: 0 },
        { count: 9, length: 0.54, width: 0.36, cup: 0.6, curl: 0.02, tip: "pointed", baseColor: "#fffaf0", tipColor: "#f6d98c", radius: 0.07, y: 0.03, closedTilt: 0.07, openTilt: 0.9, twist: 0.31 },
        { count: 7, length: 0.44, width: 0.3, cup: 0.65, curl: -0.05, tip: "pointed", baseColor: "#ffffff", tipColor: "#f9e3a8", radius: 0.05, y: 0.06, closedTilt: 0.03, openTilt: 0.5, twist: 0.1 },
      ],
      center: "orb",
      centerColor: "#ffe7a3",
      glow: "#ffd479",
      stemHeight: 0.7,
      stemBend: 0.05,
      headTilt: 0.15,
      leaves: { count: 4, length: 0.55, width: 0.3, spread: 0, tilt: 1.35 },
      restOpenness: 1,
      hitRadius: 0.8,
    },
  },

  // ---- Plantable only: never pre-placed, they grow when one of you plants them. ----

  // Five broad, overlapping coral petals, deep crimson at the heart, with a long stamen column.
  hibiscus: {
    name: "Hibiscus",
    label: "Open when you're overwhelmed",
    plantable: true,
    spec: {
      layers: [
        { count: 5, length: 0.5, width: 0.46, cup: 0.3, curl: 0.18, tip: "round", baseColor: "#a3122f", tipColor: "#ff6f6a", radius: 0.03, y: 0, closedTilt: 0.25, openTilt: 1.2, twist: 0 },
      ],
      center: "stamens",
      centerColor: "#ffd35c",
      glow: "#ff7a72",
      stemHeight: 0.95,
      stemBend: 0.12,
      headTilt: 0.6,
      leaves: { count: 4, length: 0.36, width: 0.24, spread: 0.6, tilt: 1 },
      restOpenness: 0.8,
      hitRadius: 0.55,
    },
  },

  // Small and sky blue: five round petals around a white eye and a yellow centre.
  "forget-me-not": {
    name: "Forget-me-not",
    label: "Open when you're scared of losing this",
    plantable: true,
    spec: {
      layers: [
        { count: 5, length: 0.3, width: 0.3, cup: 0.15, curl: 0.04, tip: "round", baseColor: "#6f9cf2", tipColor: "#a9cbff", radius: 0.05, y: 0, closedTilt: 0.4, openTilt: 1.45, twist: 0 },
        { count: 5, length: 0.08, width: 0.09, cup: 0.1, curl: 0, tip: "round", baseColor: "#ffffff", tipColor: "#eef4ff", radius: 0.02, y: 0.01, closedTilt: 0.4, openTilt: 1.4, twist: Math.PI / 5 },
      ],
      center: "dome",
      centerColor: "#ffd84a",
      glow: "#8fb6ff",
      stemHeight: 0.7,
      stemBend: 0.1,
      headTilt: 0.55,
      leaves: { count: 3, length: 0.26, width: 0.1, spread: 0.5, tilt: 1.1 },
      restOpenness: 0.8,
      hitRadius: 0.5,
    },
  },

  // A lush ball of cupped blush petals, fullest of all the flowers.
  peony: {
    name: "Peony",
    label: "Open when you need reassurance",
    plantable: true,
    spec: {
      layers: [
        { count: 4, length: 0.22, width: 0.24, cup: 0.8, curl: -0.2, tip: "round", baseColor: "#ee8fa9", tipColor: "#fbd2dd", radius: 0, y: 0.1, closedTilt: 0.02, openTilt: 0.2, twist: 0 },
        { count: 6, length: 0.3, width: 0.3, cup: 0.7, curl: -0.12, tip: "round", baseColor: "#f09ab2", tipColor: "#ffdbe4", radius: 0.02, y: 0.07, closedTilt: 0.06, openTilt: 0.5, twist: 0.5 },
        { count: 7, length: 0.36, width: 0.34, cup: 0.6, curl: 0, tip: "round", baseColor: "#f2a4b9", tipColor: "#ffe4eb", radius: 0.03, y: 0.04, closedTilt: 0.12, openTilt: 0.85, twist: 1.1 },
        { count: 8, length: 0.42, width: 0.38, cup: 0.45, curl: 0.12, tip: "round", baseColor: "#f4adc0", tipColor: "#ffeaf0", radius: 0.04, y: 0, closedTilt: 0.2, openTilt: 1.2, twist: 0.3 },
      ],
      center: "none",
      centerColor: "#000000",
      glow: "#f7a8bf",
      stemHeight: 0.95,
      stemBend: 0.08,
      headTilt: 0.35,
      leaves: { count: 4, length: 0.34, width: 0.18, spread: 0.55, tilt: 1 },
      restOpenness: 0.65,
      hitRadius: 0.55,
    },
  },

  // Five pale pink petals, faintly deeper at the base, around a spray of pink stamens.
  "cherry-blossom": {
    name: "Cherry blossom",
    label: "Open when you're missing home",
    plantable: true,
    spec: {
      layers: [
        { count: 5, length: 0.32, width: 0.3, cup: 0.25, curl: 0.08, tip: "round", baseColor: "#f39bb8", tipColor: "#fff1f6", radius: 0.04, y: 0, closedTilt: 0.35, openTilt: 1.3, twist: 0 },
      ],
      center: "stamens",
      centerColor: "#e2688f",
      glow: "#ffc3d6",
      stemHeight: 0.85,
      stemBend: 0.22,
      headTilt: 0.6,
      leaves: { count: 2, length: 0.28, width: 0.14, spread: 0.4, tilt: 1 },
      restOpenness: 0.85,
      hitRadius: 0.5,
    },
  },

  // Three upright violet standards over three drooping falls with a golden flash at the base.
  iris: {
    name: "Iris",
    label: "Open when you need to hear you're doing great",
    plantable: true,
    spec: {
      layers: [
        { count: 3, length: 0.5, width: 0.3, cup: 0.2, curl: 0.45, tip: "round", baseColor: "#f2c74a", tipColor: "#6a4bd6", radius: 0.03, y: 0, closedTilt: 0.2, openTilt: 1.65, twist: 0 },
        { count: 3, length: 0.46, width: 0.26, cup: 0.5, curl: -0.12, tip: "round", baseColor: "#8a6ee6", tipColor: "#b9a2ff", radius: 0.02, y: 0.02, closedTilt: 0.05, openTilt: 0.35, twist: Math.PI / 3 },
      ],
      center: "none",
      centerColor: "#000000",
      glow: "#9d85f2",
      stemHeight: 1.2,
      stemBend: 0.06,
      headTilt: 0.2,
      leaves: { count: 2, length: 0.8, width: 0.12, spread: 0, tilt: 0.25 },
      restOpenness: 0.8,
      hitRadius: 0.55,
    },
  },
} satisfies Record<string, FlowerEntry>;

/** Every known flower type, pre-placed or not. */
export type FlowerType = keyof typeof FLOWER_REGISTRY;
export const FLOWER_TYPES = Object.keys(FLOWER_REGISTRY) as FlowerType[];
