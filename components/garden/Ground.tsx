"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { withGrowth } from "@/lib/growth";
import { distanceToPath } from "@/lib/layout";
import { distanceToPond, groundHeight, POND, smoothstep } from "@/lib/terrain";

const MOSS = new THREE.Color("#2b4a2f");
const MOSS_LIGHT = new THREE.Color("#3f6238");
const MUD = new THREE.Color("#2c2a26");
const TRODDEN = new THREE.Color("#3d4436");
const HILLS = new THREE.Color("#1c2f25");

export default function Ground() {
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

      // Patchy moss, darker mud at the waterline, a worn strip along the path, dark hills at the rim.
      const patches = 0.5 + 0.25 * Math.sin(x * 0.7) * Math.cos(z * 0.6) + 0.25 * Math.sin(x * 1.9 + z * 1.3);
      c.copy(MOSS).lerp(MOSS_LIGHT, patches);
      c.lerp(TRODDEN, (1 - smoothstep(0.3, 1.1, distanceToPath(x, z))) * 0.6);
      c.lerp(MUD, 1 - smoothstep(POND.radius * 0.8, POND.radius * 1.15, distanceToPond(x, z)));
      c.lerp(HILLS, smoothstep(11, 20, Math.hypot(x, z)));
      c.toArray(colors, i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  const material = useMemo(() => withGrowth(new THREE.MeshLambertMaterial({ vertexColors: true })), []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <mesh geometry={geometry} material={material} />;
}
