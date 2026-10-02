"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { withGrowth } from "@/lib/growth";
import { distanceToPath } from "@/lib/layout";
import { brookDepth, distanceToPond, GARDEN_BROOK, groundHeight, POND, smoothstep } from "@/lib/terrain";

const MOSS = new THREE.Color("#2b4a2f");
const MOSS_LIGHT = new THREE.Color("#3f6238");
export const MUD = new THREE.Color("#2c2a26");
export const TRODDEN = new THREE.Color("#3d4436");
export const HILLS = new THREE.Color("#1c2f25");

/** A stretch of ground: its height, and how to colour it over the moss (mud, worn paths, darker hills). */
export interface Terrain {
  height: (x: number, z: number) => number;
  tint: (x: number, z: number, color: THREE.Color) => void;
}

/** The garden's: mud at the pond's edge and along the brook, a worn strip along the path, dark hills at the rim. */
const GARDEN_TERRAIN: Terrain = {
  height: groundHeight,
  tint: (x, z, c) => {
    // The path stays within the garden, so skip the (slow) distance check out on the hills.
    if (Math.hypot(x, z) < 14) c.lerp(TRODDEN, (1 - smoothstep(0.3, 1.1, distanceToPath(x, z))) * 0.6);
    c.lerp(MUD, 1 - smoothstep(POND.radius * 0.8, POND.radius * 1.15, distanceToPond(x, z)));
    c.lerp(HILLS, smoothstep(11, 20, Math.hypot(x, z)));
    c.lerp(MUD, Math.min(1, (brookDepth(GARDEN_BROOK, x, z) / GARDEN_BROOK.depth) * 1.6));
  },
};

export default function Ground({ terrain = GARDEN_TERRAIN }: { terrain?: Terrain }) {
  const groundHeight = terrain.height;
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(64, 64, 120, 120);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, groundHeight(x, z));

      // Patchy moss, then whatever this ground adds over it.
      const patches = 0.5 + 0.25 * Math.sin(x * 0.7) * Math.cos(z * 0.6) + 0.25 * Math.sin(x * 1.9 + z * 1.3);
      c.copy(MOSS).lerp(MOSS_LIGHT, patches);
      terrain.tint(x, z, c);
      c.toArray(colors, i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [terrain, groundHeight]);

  // A coarse ring carrying the hills out to the horizon, under the tree ring. It sits a
  // hair below the detailed ground so the two never fight where they overlap.
  const skirt = useMemo(() => {
    const g = new THREE.RingGeometry(30, 110, 72, 6);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)) - 0.06);
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) HILLS.toArray(colors, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [groundHeight]);

  const material = useMemo(() => withGrowth(new THREE.MeshLambertMaterial({ vertexColors: true })), []);

  useEffect(
    () => () => {
      geometry.dispose();
      skirt.dispose();
      material.dispose();
    },
    [geometry, skirt, material],
  );

  return (
    <>
      <mesh geometry={geometry} material={material} />
      <mesh geometry={skirt} material={material} />
    </>
  );
}
