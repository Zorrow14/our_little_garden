import * as THREE from "three";

export interface PetalShape {
  length: number;
  width: number;
  /** How far the petal's edges curl toward the flower's centre (0 = flat). */
  cup: number;
  /** Bend along the length: positive arches the tip outward, negative curls it inward. */
  curl: number;
  /** "pointed" narrows to a tip (lotus, lily); "round" stays broad (rose, tulip). */
  tip: "pointed" | "round";
  baseColor: string;
  tipColor: string;
}

/**
 * A single petal, base at the origin, growing along +Y. Its inner face looks
 * toward -Z, so rotating it about X by a positive angle leans it outward.
 * Colour runs from base to tip through vertex colours.
 */
export function createPetalGeometry(shape: PetalShape, segments = { across: 6, along: 8 }) {
  const geometry = new THREE.PlaneGeometry(1, 1, segments.across, segments.along);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(shape.baseColor);
  const tip = new THREE.Color(shape.tipColor);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) * 2; // -1 (left edge) .. 1 (right edge)
    const v = pos.getY(i) + 0.5; // 0 (base) .. 1 (tip)
    const profile =
      shape.tip === "pointed"
        ? Math.pow(Math.sin(Math.PI * Math.pow(v, 0.85)), 0.62)
        : Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * Math.pow(v, 0.85))), 0.5);
    const x = u * 0.5 * shape.width * profile;
    const y = v * shape.length;
    const z = -shape.cup * shape.width * u * u * profile + shape.curl * shape.length * v * v;
    pos.setXYZ(i, x, y, z);
    c.copy(base).lerp(tip, Math.pow(v, 0.9)).toArray(colors, i * 3);
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
