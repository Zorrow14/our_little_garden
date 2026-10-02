/**
 * Shared, per-frame state for walking your own gardener: what the keyboard and
 * the on-screen joystick are asking for, and where the gardener is, so the
 * camera can keep them in view. Plain mutable objects, read inside `useFrame`.
 */

/** Movement asked for, relative to the camera: x is right, y is away from the camera. Each -1..1. */
export const playerInput = {
  keys: { x: 0, y: 0 },
  stick: { x: 0, y: 0 },
};

/** The combined request, no longer than 1. */
export function readMove() {
  const x = playerInput.keys.x + playerInput.stick.x;
  const y = playerInput.keys.y + playerInput.stick.y;
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

/** Where your gardener is, while you're walking one. */
export const player = {
  active: false,
  moving: false,
  x: 0,
  y: 0,
  z: 0,
};
