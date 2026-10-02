"use client";

import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useState } from "react";
import * as THREE from "three";
import Flower from "@/components/garden/Flower";
import Grass, { type GrassField } from "@/components/garden/Grass";
import Ground, { HILLS, type Terrain, TRODDEN } from "@/components/garden/Ground";
import Lights from "@/components/garden/Lights";
import { box, NO_RAYCAST, type Part, PropHoverLight, useMergedParts } from "@/components/garden/props/shared";
import Sky from "@/components/garden/Sky";
import Trees, { type TreeRing } from "@/components/garden/Trees";
import FlowerTag from "@/components/ui/FlowerTag";
import type { FlowerSpec } from "@/lib/flowerSpecs";
import { useGardenStore } from "@/lib/gardenStore";
import { CELL, CLEARING_BENCH, CLEARING_LANTERNS, HEDGE, HEDGES, inMazeClearing, MAZE_GATE, MAZE_HALF, MAZE_SECRET, SECRET_FLOWER } from "@/lib/places/maze";
import { player } from "@/lib/playerInput";
import { createRandom, smoothstep } from "@/lib/terrain";
import { getGlowTexture } from "@/lib/textures";
import { PlaceCamera, type PlaceView, WayOut } from "./shared";

/**
 * The hedge maze, seen from above and following you through it. The hedges
 * are solid (walls in `lib/places/maze.ts`, walked round like the cottage's
 * furniture). In the clearing in the middle, a heartsease that grows nowhere
 * else in the garden: it opens as you come into the clearing, and has a few
 * words for you when you reach it.
 */

const PALETTE = { hedge: "#356a41", top: "#4a8a50", stone: "#8a847b", bed: "#3b2a21", wood: "#8a6a52", leaf: "#4f8a55" };

/** Flat inside the maze, rising into hills beyond it. */
const mazeHeight = (x: number, z: number) => smoothstep(MAZE_HALF + 2.5, 24, Math.max(Math.abs(x), Math.abs(z))) * 4;

const inside = (x: number, z: number) => Math.abs(x) < MAZE_HALF && Math.abs(z) < MAZE_HALF;

/** How far (x, z) is from the nearest hedge. */
function hedgeDistance(x: number, z: number) {
  let min = Infinity;
  for (const { a, b } of HEDGES) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    min = Math.min(min, Math.hypot(a.x + dx * t - x, a.z + dz * t - z));
  }
  return min;
}

const TERRAIN: Terrain = {
  height: mazeHeight,
  tint: (x, z, c) => {
    if (inside(x, z)) c.lerp(TRODDEN, 0.55);
    c.lerp(HILLS, smoothstep(MAZE_HALF + 1, MAZE_HALF + 9, Math.max(Math.abs(x), Math.abs(z))));
  },
};

/** Grass round the outside, and in tufts along the corridors. */
const FIELD: GrassField = {
  radius: 10,
  center: [0, 0],
  height: mazeHeight,
  open: (x, z) => hedgeDistance(x, z) > HEDGE.half + 0.08 && (!inside(x, z) || hedgeDistance(x, z) < HEDGE.half + 0.35) && Math.hypot(x - SECRET_FLOWER.x, z - SECRET_FLOWER.z) > 0.7,
};

const RING: TreeRing = { seed: 53, count: 52, inner: MAZE_HALF + 7.5, depth: 7, height: mazeHeight, clearing: () => false };

const VIEW: PlaceView = {
  target: [MAZE_GATE.x, 0.5, MAZE_GATE.z - 0.8],
  distance: 9,
  polar: 0.62,
  azimuth: 0.3,
  zoom: [5, 13],
  tip: [0.3, 0.95],
  follow: "always",
};

/**
 * The flower at the heart of the maze, found nowhere else: a heartsease, the
 * little wild pansy whose old name means "thinking of you". Violet and gold,
 * with a glowing heart.
 */
const HEARTSEASE: FlowerSpec = {
  layers: [
    { count: 5, length: 0.42, width: 0.4, cup: 0.2, curl: 0.1, tip: "round", baseColor: "#f4c64e", tipColor: "#6a3fc0", radius: 0.04, y: 0, closedTilt: 0.25, openTilt: 1.35, twist: 0 },
    { count: 5, length: 0.24, width: 0.22, cup: 0.25, curl: 0, tip: "round", baseColor: "#fff3c4", tipColor: "#b48cf0", radius: 0.03, y: 0.02, closedTilt: 0.15, openTilt: 1.1, twist: Math.PI / 5 },
  ],
  center: "orb",
  centerColor: "#ffe08a",
  glow: "#c9a2ff",
  stemHeight: 0.75,
  stemBend: 0.06,
  headTilt: 0.35,
  leaves: { count: 4, length: 0.32, width: 0.16, spread: 0.5, tilt: 1.1 },
  restOpenness: 0.15,
  hitRadius: 0.55,
};

export default function MazeZone() {
  return (
    <>
      <fog attach="fog" args={["#262a4e", 16, 50]} />
      <Sky />
      <Lights />
      <Ground terrain={TERRAIN} />
      <Grass field={FIELD} />
      <Trees ring={RING} />
      <Hedges />
      <Gate />
      <Clearing />
      <PropHoverLight />
      <PlaceCamera view={VIEW} />
    </>
  );
}

/** Every run of hedge as a clipped box, with leafy bumps along the top. Two draw calls for the lot. */
function hedgeParts(): Part[] {
  const parts: Part[] = [];
  const rand = createRandom(61);
  for (const { a, b } of HEDGES) {
    const length = Math.hypot(b.x - a.x, b.z - a.z) + HEDGE.half * 2;
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    parts.push({ geometry: box(HEDGE.half * 2, HEDGE.height, length), material: "hedge", position: [mid.x, HEDGE.height / 2, mid.z], rotation: [0, yaw, 0] });
    const bumps = Math.max(1, Math.round(length / 0.55));
    for (let i = 0; i < bumps; i++) {
      const t = (i + 0.5) / bumps;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      parts.push({ geometry: new THREE.IcosahedronGeometry(0.2 + rand() * 0.08, 0), material: "top", position: [x, HEDGE.height + 0.02 + rand() * 0.05, z] });
    }
  }
  return parts;
}

function Hedges() {
  const meshes = useMergedParts(hedgeParts, PALETTE);
  return <>{meshes}</>;
}

/**
 * The way in (and out): the gap in the near hedge, between two taller clipped
 * pillars with a ball on top. No arch over it, which would hide you from the
 * camera as you come in.
 */
function Gate() {
  const meshes = useMergedParts(
    () =>
      [-1, 1].flatMap((side): Part[] => [
        { geometry: box(0.56, HEDGE.height + 0.3, HEDGE.half * 2 + 0.12), material: "hedge", position: [side * (CELL / 2 + 0.06), (HEDGE.height + 0.3) / 2, 0] },
        { geometry: new THREE.IcosahedronGeometry(0.26, 1), material: "top", position: [side * (CELL / 2 + 0.06), HEDGE.height + 0.52, 0] },
      ]),
    PALETTE,
  );
  return (
    <group position={[MAZE_GATE.x, 0, MAZE_GATE.z]}>
      <WayOut zone="maze" tagAt={[0, 2.3, 0]} pool={{ at: [0, 0.03, -0.6], size: 2 }} light={[0, 1.5, -0.8]}>
        {meshes}
        <mesh visible={false} position={[0, 0.9, 0]}>
          <boxGeometry args={[CELL + 0.6, 1.8, 0.6]} />
        </mesh>
      </WayOut>
    </group>
  );
}

/** The clearing: a round bed with the heartsease, a bench, and a lantern at each corner. */
function Clearing() {
  const [found, setFound] = useState(false);
  const [told, setTold] = useState(false);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (!player.active) return;
    if (!found && inMazeClearing(player.x, player.z)) setFound(true);
    if (!told && Math.hypot(player.x - SECRET_FLOWER.x, player.z - SECRET_FLOWER.z) < SECRET_FLOWER.r + 0.9) {
      setTold(true);
      useGardenStore.setState({ notice: MAZE_SECRET });
    }
  });

  const meshes = useMergedParts(
    () => {
      const parts: Part[] = [];
      const ring = new THREE.TorusGeometry(SECRET_FLOWER.r, 0.07, 4, 16);
      ring.rotateX(Math.PI / 2);
      parts.push({ geometry: ring, material: "stone", position: [SECRET_FLOWER.x, 0.05, SECRET_FLOWER.z] });
      parts.push({ geometry: new THREE.CylinderGeometry(SECRET_FLOWER.r - 0.04, SECRET_FLOWER.r - 0.04, 0.06, 16), material: "bed", position: [SECRET_FLOWER.x, 0.03, SECRET_FLOWER.z] });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        parts.push({ geometry: new THREE.IcosahedronGeometry(0.08, 0), material: "leaf", position: [SECRET_FLOWER.x + Math.cos(a) * 0.28, 0.08, SECRET_FLOWER.z + Math.sin(a) * 0.28] });
      }
      const b = CLEARING_BENCH;
      parts.push({ geometry: box(b.halfX * 2, 0.08, b.halfZ * 2), material: "stone", position: [b.x, 0.42, b.z] });
      for (const side of [-1, 1]) parts.push({ geometry: box(0.12, 0.38, b.halfZ * 2 - 0.04), material: "stone", position: [b.x + side * (b.halfX - 0.15), 0.19, b.z] });
      for (const p of CLEARING_LANTERNS) parts.push({ geometry: box(0.07, 0.62, 0.07), material: "wood", position: [p.x, 0.31, p.z] });
      return parts;
    },
    PALETTE,
  );

  return (
    <>
      {meshes}
      {CLEARING_LANTERNS.map((p, i) => (
        <group key={i} position={[p.x, 0.72, p.z]}>
          <mesh raycast={NO_RAYCAST}>
            <boxGeometry args={[0.11, 0.18, 0.11]} />
            <meshBasicMaterial color="#ffd59a" />
          </mesh>
          <sprite scale={0.9}>
            <spriteMaterial map={getGlowTexture()} color="#ffc477" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
      <Flower
        id="maze-heartsease"
        spec={HEARTSEASE}
        position={[SECRET_FLOWER.x, 0.06, SECRET_FLOWER.z]}
        scale={1.15}
        status={found ? "bloomed" : "waiting"}
        beckon={found && !told}
        interactive
        hovered={hovered}
        onHover={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        onSelect={() => useGardenStore.setState({ notice: MAZE_SECRET })}
        label={<FlowerTag text="Heartsease" note="grows only here" />}
      />
      {found && <Sparkles count={30} scale={[3.5, 1.8, 3.5]} position={[0, 1, 0]} size={3.5} speed={0.3} noise={0.6} color="#e9d6ff" />}
    </>
  );
}
