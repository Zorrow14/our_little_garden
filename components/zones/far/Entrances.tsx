"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { box, NO_RAYCAST, type Part, PropHover, useMergedParts } from "@/components/garden/props/shared";
import { type Entrance, type EntranceId, ENTRANCES, farHeight } from "@/lib/farGarden";
import { useGardenStore } from "@/lib/gardenStore";
import { createRandom } from "@/lib/terrain";
import { getGlowTexture } from "@/lib/textures";
import { takeExit } from "../registry";

/**
 * The five entrances round the far garden, each the way into a place still to
 * be built: a greenhouse door, a white gazebo arch, a stone gateway with a
 * lighthouse lamp on top, a hedge arch into the maze, and a ladder up a tree.
 * Each is built in its own space, facing the signpost (+z), its doorway at the
 * origin. Clicking one goes in once it leads somewhere; until then, it says so.
 */

const PALETTE = {
  white: "#e9e4da",
  glass: "#a9d6cf",
  pot: "#b4674a",
  leaf: "#3f7a46",
  leafDark: "#2f5f3a",
  pink: "#f29ab6",
  stone: "#8a847b",
  stoneDark: "#6f6a62",
  red: "#c4534a",
  bark: "#4a3628",
  wood: "#8a6a52",
  rope: "#d9c9a6",
};

type Parts = () => Part[];
const leaves = (r: number) => new THREE.IcosahedronGeometry(r, 0);

const BUILDS: Record<EntranceId, Parts> = {
  /** A white-framed glass door under a little gable, with a pot plant either side. */
  greenhouse: () => {
    const parts: Part[] = [];
    for (const side of [-1, 1]) {
      parts.push({ geometry: box(0.09, 2.0, 0.09), material: "white", position: [side * 0.62, 1.0, 0] });
      // A door leaf of glass, with a bar across it.
      parts.push({ geometry: box(0.56, 1.85, 0.03), material: "glass", position: [side * 0.3, 0.97, 0] });
      parts.push({ geometry: box(0.56, 0.04, 0.05), material: "white", position: [side * 0.3, 1.1, 0] });
      parts.push({ geometry: box(0.82, 0.07, 0.1), material: "white", position: [side * 0.34, 2.2, 0], rotation: [0, 0, side * -0.5] });
      // A terracotta pot with a leafy plant.
      parts.push({ geometry: new THREE.CylinderGeometry(0.16, 0.12, 0.28, 8), material: "pot", position: [side * 1.0, 0.14, 0.1] });
      parts.push({ geometry: leaves(0.24), material: "leaf", position: [side * 1.0, 0.45, 0.1] });
      parts.push({ geometry: leaves(0.15), material: "leafDark", position: [side * 0.92, 0.62, 0.15] });
    }
    parts.push({ geometry: box(1.34, 0.08, 0.12), material: "white", position: [0, 1.98, 0] });
    parts.push({ geometry: box(0.06, 1.85, 0.05), material: "white", position: [0, 0.97, 0.01] });
    return parts;
  },
  /** A white arch, grown over with leaves and pink flowers. */
  gazebo: () => {
    const parts: Part[] = [];
    for (const side of [-1, 1]) parts.push({ geometry: box(0.1, 1.9, 0.1), material: "white", position: [side * 0.62, 0.95, 0] });
    parts.push({ geometry: new THREE.TorusGeometry(0.62, 0.05, 5, 14, Math.PI), material: "white", position: [0, 1.9, 0] });
    const rand = createRandom(91);
    for (let i = 0; i < 14; i++) {
      const a = (i / 13) * Math.PI;
      const r = 0.62 + (rand() - 0.5) * 0.08;
      const at: [number, number, number] = [Math.cos(a) * r, 1.9 + Math.sin(a) * r, (rand() - 0.5) * 0.12];
      parts.push({ geometry: leaves(0.09 + rand() * 0.05), material: i % 3 ? "leaf" : "leafDark", position: at });
      if (i % 3 === 1) parts.push({ geometry: leaves(0.05), material: "pink", position: [at[0], at[1] - 0.06, at[2] + 0.08] });
    }
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) parts.push({ geometry: leaves(0.07), material: "leaf", position: [side * 0.64, 0.4 + k * 0.38, 0.06 * (k % 2 ? 1 : -1)] });
    }
    return parts;
  },
  /** A stone gateway with a little striped lighthouse lamp on the lintel. */
  lighthouse: () => {
    const parts: Part[] = [];
    for (const side of [-1, 1]) {
      parts.push({ geometry: box(0.3, 1.8, 0.32), material: "stone", position: [side * 0.66, 0.9, 0] });
      parts.push({ geometry: box(0.36, 0.1, 0.38), material: "stoneDark", position: [side * 0.66, 0.05, 0] });
    }
    parts.push({ geometry: box(1.7, 0.24, 0.38), material: "stoneDark", position: [0, 1.92, 0] });
    // The lamp tower: red and white bands, a lamp room, a cap.
    for (let k = 0; k < 3; k++) {
      parts.push({ geometry: new THREE.CylinderGeometry(0.17 - k * 0.015, 0.19 - k * 0.015, 0.16, 10), material: k % 2 ? "white" : "red", position: [0, 2.12 + k * 0.16, 0] });
    }
    parts.push({ geometry: new THREE.ConeGeometry(0.2, 0.2, 10), material: "red", position: [0, 2.78, 0] });
    return parts;
  },
  /** Two clipped hedges with a hedge arch between them, the way into the maze. */
  maze: () => {
    const parts: Part[] = [];
    for (const side of [-1, 1]) parts.push({ geometry: box(0.75, 1.6, 0.7), material: "leafDark", position: [side * 0.98, 0.8, 0] });
    parts.push({ geometry: box(2.7, 0.42, 0.7), material: "leafDark", position: [0, 1.8, 0] });
    const rand = createRandom(93);
    for (let i = 0; i < 18; i++) {
      parts.push({
        geometry: leaves(0.12 + rand() * 0.08),
        material: "leaf",
        position: [(rand() - 0.5) * 2.6, 0.3 + rand() * 1.7, 0.33 + rand() * 0.04],
      });
    }
    return parts;
  },
  /** A tree with a rope ladder up to the boards of a treehouse peeking out of the leaves. */
  treehouse: () => {
    const parts: Part[] = [];
    parts.push({ geometry: new THREE.CylinderGeometry(0.28, 0.42, 3.4, 8), material: "bark", position: [0, 1.7, -0.62] });
    parts.push({ geometry: box(1.5, 0.08, 1.3), material: "wood", position: [0, 2.45, -0.5] });
    parts.push({ geometry: box(1.4, 0.4, 0.05), material: "wood", position: [0, 2.68, 0.13] });
    const rand = createRandom(95);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push({ geometry: new THREE.IcosahedronGeometry(0.8 + rand() * 0.3, 1), material: i % 2 ? "leaf" : "leafDark", position: [Math.cos(a) * 0.7, 3.45 + rand() * 0.4, -0.62 + Math.sin(a) * 0.7] });
    }
    // The rope ladder, hanging from the boards to the ground.
    for (const side of [-1, 1]) parts.push({ geometry: new THREE.CylinderGeometry(0.015, 0.015, 2.45, 4), material: "rope", position: [side * 0.2, 1.22, 0.1] });
    for (let k = 0; k < 7; k++) parts.push({ geometry: box(0.46, 0.035, 0.05), material: "wood", position: [0, 0.25 + k * 0.32, 0.1] });
    return parts;
  },
};

function EntranceMarker({ entrance }: { entrance: Entrance }) {
  const meshes = useMergedParts(BUILDS[entrance.id], PALETTE);
  const ground = useMemo(() => farHeight(entrance.x, entrance.z), [entrance]);
  const enter = () => {
    if (entrance.to) takeExit("far-garden", entrance.id);
    else useGardenStore.setState({ notice: `${entrance.label} isn't open yet. Something is being built here.` });
  };

  return (
    <group position={[entrance.x, ground - 0.02, entrance.z]} rotation-y={entrance.yaw}>
      <PropHover
        tag={entrance.label}
        note={entrance.to ? "step inside" : "still being built"}
        tagAt={[0, entrance.id === "treehouse" ? 3.2 : 2.6, 0.2]}
        pool={{ at: [0, 0.04, 0.4], size: 2.6 }}
        light={[0, 1.6, 1.0]}
        onSelect={enter}
      >
        {meshes}
        {/* The doorway and its frame, for clicking. */}
        <mesh visible={false} position={[0, 1.1, 0]}>
          <boxGeometry args={[1.8, 2.3, 0.7]} />
        </mesh>
      </PropHover>
      {entrance.id === "lighthouse" && <LighthouseLamp />}
    </group>
  );
}

/** The lighthouse lamp's warm glow, slowly brightening and dimming like a lamp turning. */
function LighthouseLamp() {
  const glow = useRef<THREE.SpriteMaterial>(null!);
  useFrame(({ clock }) => {
    glow.current.opacity = 0.45 + 0.35 * Math.max(0, Math.sin(clock.elapsedTime * 0.9));
  });
  return (
    <>
      <mesh position={[0, 2.6, 0]} raycast={NO_RAYCAST}>
        <cylinderGeometry args={[0.13, 0.13, 0.16, 8]} />
        <meshBasicMaterial color="#ffe3a0" />
      </mesh>
      <sprite position={[0, 2.6, 0]} scale={1.1} raycast={NO_RAYCAST}>
        <spriteMaterial ref={glow} map={getGlowTexture()} color="#ffd88a" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </>
  );
}

export default function Entrances() {
  return ENTRANCES.map((e) => <EntranceMarker key={e.id} entrance={e} />);
}

/** The signpost in the middle of the far garden: an arm pointing to each entrance, and a lantern on top. */
export function Signpost() {
  const meshes = useMergedParts(signpostParts, { post: "#6e5543", arm: "#9a7a5e", cap: "#3a3330" });
  const ground = useMemo(() => farHeight(0, 0), []);
  return (
    <group position={[0, ground - 0.02, 0]}>
      {meshes}
      <sprite position={[0, 2.18, 0]} scale={0.7} raycast={NO_RAYCAST}>
        <spriteMaterial map={getGlowTexture()} color="#ffc978" transparent opacity={0.7} depthWrite={false} />
      </sprite>
      <mesh position={[0, 2.18, 0]} raycast={NO_RAYCAST}>
        <boxGeometry args={[0.12, 0.14, 0.12]} />
        <meshBasicMaterial color="#ffd59a" />
      </mesh>
    </group>
  );
}

function signpostParts(): Part[] {
  const parts: Part[] = [{ geometry: box(0.12, 2.1, 0.12), material: "post", position: [0, 1.05, 0] }];
  ENTRANCES.forEach((e, i) => {
    // Each arm points from the post toward its entrance, a little lower down the post for each.
    const toward = Math.atan2(e.x, e.z);
    const y = 1.75 - i * 0.16;
    const reach = 0.36;
    parts.push({
      geometry: box(0.05, 0.13, 0.62),
      material: "arm",
      position: [Math.sin(toward) * reach, y, Math.cos(toward) * reach],
      rotation: [0, toward, 0],
    });
  });
  parts.push({ geometry: box(0.2, 0.04, 0.2), material: "cap", position: [0, 2.08, 0] });
  parts.push({ geometry: box(0.18, 0.04, 0.18), material: "cap", position: [0, 2.28, 0] });
  return parts;
}
