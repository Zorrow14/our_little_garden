import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { player } from "@/lib/playerInput";
import type { SpawnPoint } from "./registry";

/**
 * Camera helpers shared by the outdoor zones (the garden and the far garden):
 * framing for tall phone screens, the view you arrive to through a door or
 * over a bridge, and following your gardener as they walk.
 */

export interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/** Tall phone screens back the camera off so the whole scene still fits side to side. */
export function portraitPull(aspect: number) {
  return aspect >= 1 ? 1 : THREE.MathUtils.lerp(1.6, 1, THREE.MathUtils.clamp((aspect - 0.45) / 0.55, 0, 1));
}

/** A close shot, backed off along its line of sight on tall phone screens (less than a wide view: it's framing something small). */
export function framed(position: THREE.Vector3, target: THREE.Vector3, aspect: number): Pose {
  const offset = position.clone().sub(target).multiplyScalar(THREE.MathUtils.lerp(1, portraitPull(aspect), 0.55));
  return { position: target.clone().add(offset), target: target.clone() };
}

/** Arriving somewhere: just behind and above where you appear, looking the way you're facing. */
export function arrivalPose(
  spawn: SpawnPoint,
  height: (x: number, z: number) => number,
  back: number,
  up: number,
  aspect: number,
): Pose {
  const target = new THREE.Vector3(spawn.x, height(spawn.x, spawn.z) + 0.6, spawn.z);
  const behind = new THREE.Vector3(-Math.sin(spawn.yaw), 0, -Math.cos(spawn.yaw));
  const position = target.clone().addScaledVector(behind, back).add(new THREE.Vector3(0, up, 0));
  return framed(position, target, aspect);
}

/** How near the edges of the screen your gardener can stroll before the view follows (in -1..1 screen units). */
const SAFE_X = 0.6;
const SAFE_TOP = 0.45;
const SAFE_BOTTOM = -0.5;
const onScreen = new THREE.Vector3();

/**
 * While you walk your gardener, the view drifts along with them once they
 * near the edge of the screen, keeping its angle and distance. Standing still,
 * the view stays wherever you've turned it.
 */
export function keepPlayerInView(camera: THREE.Camera, controls: OrbitControlsImpl, delta: number) {
  if (!player.active || !player.moving || !controls.enabled) return;
  onScreen.set(player.x, player.y + 0.6, player.z).project(camera);
  const behind = onScreen.z > 1;
  const outside = Math.max(Math.abs(onScreen.x) - SAFE_X, onScreen.y - SAFE_TOP, SAFE_BOTTOM - onScreen.y, 0);
  if (!behind && outside === 0) return;
  const k = Math.min(1, behind ? 1 : outside * 3) * (1 - Math.exp(-5 * delta));
  const dx = (player.x - controls.target.x) * k;
  const dz = (player.z - controls.target.z) * k;
  controls.target.x += dx;
  controls.target.z += dz;
  camera.position.x += dx;
  camera.position.z += dz;
}

/** Wider field of view on tall phone screens. */
export function fitFov(camera: THREE.PerspectiveCamera, aspect: number) {
  camera.fov = aspect >= 1 ? 45 : THREE.MathUtils.lerp(58, 45, THREE.MathUtils.clamp((aspect - 0.45) / 0.55, 0, 1));
  camera.updateProjectionMatrix();
}
