import * as THREE from "three";
import type { Festival } from "@/lib/festivals";
import { sharedUniforms } from "@/lib/growth";

/**
 * What the festival's lights share, read every frame (not React state):
 *
 * - `amount`: 0..1, easing in when a festival starts and out when it ends.
 *   The sky and lights lean toward warm dusk by it.
 * - `flash`: a burst of warmth from a firework just gone off, fading fast,
 *   brightest near `flashAt`. Lanterns and the ground pick it up.
 * - `boost`: every lantern turned up at once, for lighting together.
 * - `festival`: the festival on, or the one just ended while it fades out.
 *
 * Shaders read them through `festivalUniforms`, so nothing here costs a light.
 */
export const festivalGlow = {
  amount: 0,
  flash: 0,
  boost: 0,
  festival: null as Festival | null,
};

export const festivalUniforms = {
  uTime: sharedUniforms.uTime,
  uAmount: { value: 0 },
  uFlash: { value: 0 },
  uFlashAt: { value: new THREE.Vector3() },
  uBoost: { value: 0 },
};

/** A firework just burst at `at`: a warm flash on everything near it. */
export function flashAt(at: THREE.Vector3, strength = 1) {
  festivalGlow.flash = Math.max(festivalGlow.flash, strength);
  festivalUniforms.uFlashAt.value.copy(at);
}

/** Turns every lantern up for a moment. */
export function boostLanterns(strength = 1) {
  festivalGlow.boost = Math.max(festivalGlow.boost, strength);
}

/** Eases `amount` toward whether a festival is on, and lets a flash or boost fade. */
export function stepFestivalGlow(festival: Festival | null, dt: number) {
  if (festival) festivalGlow.festival = festival;
  festivalGlow.amount = THREE.MathUtils.damp(festivalGlow.amount, festival ? 1 : 0, 1.2, dt);
  if (!festival && festivalGlow.amount < 0.001) {
    festivalGlow.amount = 0;
    festivalGlow.festival = null;
  }
  festivalGlow.flash = Math.max(0, festivalGlow.flash - dt * 2.2);
  festivalGlow.boost = Math.max(0, festivalGlow.boost - dt * 0.35);
  festivalUniforms.uAmount.value = festivalGlow.amount;
  festivalUniforms.uFlash.value = festivalGlow.flash;
  festivalUniforms.uBoost.value = festivalGlow.boost;
}

/**
 * GLSL for a festival light's brightness: a slow flicker of its own (by
 * `seed`, 0..1), turned up by a nearby firework's flash and by the boost.
 * Needs `uTime`, `uFlash`, `uFlashAt`, `uBoost` and a world position.
 */
export const GLOW_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uAmount;
  uniform float uFlash;
  uniform vec3 uFlashAt;
  uniform float uBoost;
  float festivalBrightness(vec3 world, float seed, float flicker) {
    float t = uTime * (1.3 + seed * 1.7) + seed * 40.0;
    float wobble = 1.0 - flicker * (0.5 + 0.5 * sin(t)) * (0.55 + 0.45 * sin(t * 2.7 + 1.3));
    float near = 1.0 / (1.0 + 0.012 * dot(world - uFlashAt, world - uFlashAt));
    return wobble * (1.0 + uFlash * near * 1.2 + uBoost * 0.7);
  }
`;
