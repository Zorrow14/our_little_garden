"use client";

import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import Grass, { type GrassField } from "@/components/garden/Grass";
import Ground, { HILLS, type Terrain, TRODDEN } from "@/components/garden/Ground";
import Lights from "@/components/garden/Lights";
import { box, NO_RAYCAST, type Part, PropHoverLight, rod, useMergedParts } from "@/components/garden/props/shared";
import Sky from "@/components/garden/Sky";
import SteppingStones from "@/components/garden/SteppingStones";
import Trees, { type TreeRing } from "@/components/garden/Trees";
import { BENCH_FACES, GAZEBO, GAZEBO_ARCH, GAZEBO_CORNERS, LAWN_RADIUS, lawnHeight, PATH_LANTERNS, RAILED_FACES } from "@/lib/places/gazebo";
import { createRandom, smoothstep } from "@/lib/terrain";
import { getGlowTexture } from "@/lib/textures";
import type { Point } from "@/lib/wander";
import { PlaceCamera, type PlaceView, WayOut } from "./shared";

/**
 * The gazebo: white, eight-sided and open all round, grown over with vines
 * and hung with wisteria, on a round lawn under the night sky. A lantern
 * hangs in the middle; a bench curves round the back. Deliberately simple:
 * a quiet place, kept open for whatever it's for later.
 */

const PALETTE = {
  white: "#ece6dc",
  roof: "#b9848f",
  wood: "#9a7a5e",
  leaf: "#3f7a46",
  leafDark: "#2f5f3a",
  pink: "#f29ab6",
  cream: "#fff1d6",
  wisteria: "#b59ad9",
  post: "#5a4a3e",
};

const PATH: [Point, Point][] = [[{ x: 0, z: LAWN_RADIUS - 0.5 }, { x: 0, z: 2.25 }]];

const TERRAIN: Terrain = {
  height: lawnHeight,
  tint: (x, z, c) => {
    if (Math.abs(x) < 0.6 && z > 1.9 && z < LAWN_RADIUS) c.lerp(TRODDEN, 0.45);
    c.lerp(HILLS, smoothstep(6.5, 16, Math.hypot(x, z)));
  },
};

const FIELD: GrassField = {
  radius: 7.5,
  center: [0, 0],
  height: lawnHeight,
  open: (x, z) => Math.hypot(x, z) > GAZEBO.radius + 0.35 && !(Math.abs(x) < 0.55 && z > 1.8) && PATH_LANTERNS.every((p) => Math.hypot(p.x - x, p.z - z) > 0.2),
};

const RING: TreeRing = { seed: 29, count: 52, inner: 16.5, depth: 7, height: lawnHeight, clearing: () => false };

const VIEW: PlaceView = {
  target: [0, 0.9, 1.4],
  distance: 9.5,
  polar: 1.02,
  azimuth: 0.85,
  zoom: [4, 14],
  tip: [0.45, 1.32],
  follow: "edges",
};

/** The lantern hanging in the middle. */
const LANTERN: [number, number, number] = [0, GAZEBO.eaves - 0.35, 0];

export default function GazeboZone() {
  return (
    <>
      <fog attach="fog" args={["#262a4e", 14, 46]} />
      <Sky />
      <Lights />
      <Ground terrain={TERRAIN} />
      <Grass field={FIELD} />
      <Trees ring={RING} />
      <SteppingStones runs={PATH} height={lawnHeight} seed={31} />
      <Gazebo />
      <PathLanterns />
      <Arch />
      <Sparkles count={40} scale={[11, 2.5, 11]} position-y={1.4} size={3} speed={0.25} noise={0.6} color="#ffe3a0" />
      <PropHoverLight />
      <PlaceCamera view={VIEW} />
    </>
  );
}

const v3 = (p: Point, y: number) => new THREE.Vector3(p.x, y, p.z);
const lerpPoint = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });

function gazeboParts(): Part[] {
  const { floor, eaves, peak, radius } = GAZEBO;
  const parts: Part[] = [];
  const rand = createRandom(37);
  // The floor, with a step up at the open side.
  parts.push({ geometry: new THREE.CylinderGeometry(radius + 0.08, radius + 0.12, floor, 8, 1, false, -Math.PI / 8), material: "white", position: [0, floor / 2, 0] });
  parts.push({ geometry: box(1.1, floor / 2, 0.36), material: "white", position: [0, floor / 4, radius * Math.cos(Math.PI / 8) + 0.2] });
  // Posts, beams round the top, and the roof.
  for (const c of GAZEBO_CORNERS) parts.push({ geometry: box(0.11, eaves - floor, 0.11), material: "white", position: [c.x, (eaves + floor) / 2, c.z] });
  GAZEBO_CORNERS.forEach((a, k) => {
    const b = GAZEBO_CORNERS[(k + 1) % 8];
    parts.push({ geometry: rod(v3(a, eaves), v3(b, eaves), 0.06, 0.06, 4), material: "white", position: [0, 0, 0] });
    // A little bracket in each top corner of the opening.
    parts.push({ geometry: rod(v3(lerpPoint(a, b, 0.22), eaves), v3(a, eaves - 0.3), 0.025, 0.025, 4), material: "white", position: [0, 0, 0] });
    parts.push({ geometry: rod(v3(lerpPoint(a, b, 0.78), eaves), v3(b, eaves - 0.3), 0.025, 0.025, 4), material: "white", position: [0, 0, 0] });
  });
  parts.push({ geometry: new THREE.ConeGeometry(radius + 0.35, peak - eaves, 8, 1, false, -Math.PI / 8), material: "roof", position: [0, eaves + (peak - eaves) / 2 + 0.03, 0] });
  parts.push({ geometry: new THREE.SphereGeometry(0.09, 8, 6), material: "white", position: [0, peak + 0.08, 0] });
  // Railings: a top and bottom rail, and spindles.
  for (const k of RAILED_FACES) {
    const a = GAZEBO_CORNERS[k];
    const b = GAZEBO_CORNERS[(k + 1) % 8];
    for (const y of [floor + 0.12, floor + 0.72]) parts.push({ geometry: rod(v3(a, y), v3(b, y), 0.03, 0.03, 4), material: "white", position: [0, 0, 0] });
    for (let i = 1; i < 6; i++) {
      const p = lerpPoint(a, b, i / 6);
      parts.push({ geometry: box(0.03, 0.6, 0.03), material: "white", position: [p.x, floor + 0.42, p.z] });
    }
  }
  // The bench round the back.
  for (const k of BENCH_FACES) {
    const a = lerpPoint({ x: 0, z: 0 }, GAZEBO_CORNERS[k], 0.78);
    const b = lerpPoint({ x: 0, z: 0 }, GAZEBO_CORNERS[(k + 1) % 8], 0.78);
    const mid = lerpPoint(a, b, 0.5);
    const length = Math.hypot(b.x - a.x, b.z - a.z) + 0.06;
    const yaw = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
    parts.push({ geometry: box(length, 0.05, 0.34), material: "wood", position: [mid.x, floor + 0.42, mid.z], rotation: [0, yaw, 0] });
    for (const t of [0.15, 0.85]) {
      const p = lerpPoint(a, b, t);
      parts.push({ geometry: box(0.05, 0.4, 0.28), material: "wood", position: [p.x, floor + 0.2, p.z], rotation: [0, yaw, 0] });
    }
  }
  // Vines up five of the posts and along the beams, with flowers in them...
  GAZEBO_CORNERS.forEach((c, k) => {
    if (k === 1 || k === 5 || k === 7) return;
    for (let i = 0; i < 7; i++) {
      const y = floor + 0.2 + i * 0.28;
      const a = i * 1.9 + k;
      const at: [number, number, number] = [c.x + Math.cos(a) * 0.09, y, c.z + Math.sin(a) * 0.09];
      parts.push({ geometry: new THREE.IcosahedronGeometry(0.08 + rand() * 0.05, 0), material: i % 2 ? "leaf" : "leafDark", position: at });
      if (i % 3 === 2) parts.push({ geometry: new THREE.IcosahedronGeometry(0.045, 0), material: rand() < 0.5 ? "pink" : "cream", position: [at[0] * 1.06, y + 0.04, at[2] * 1.06] });
    }
  });
  GAZEBO_CORNERS.forEach((a, k) => {
    const b = GAZEBO_CORNERS[(k + 1) % 8];
    for (let i = 0; i < 5; i++) {
      const p = lerpPoint(a, b, (i + 0.5) / 5);
      parts.push({ geometry: new THREE.IcosahedronGeometry(0.09 + rand() * 0.05, 0), material: rand() < 0.5 ? "leaf" : "leafDark", position: [p.x, eaves + 0.04, p.z] });
      // ...and wisteria hanging from them.
      if ((i + k) % 2 === 0) {
        const length = 0.28 + rand() * 0.2;
        const g = new THREE.ConeGeometry(0.06, length, 5);
        g.rotateX(Math.PI);
        parts.push({ geometry: g, material: "wisteria", position: [p.x * 1.02, eaves - length / 2 - 0.02, p.z * 1.02] });
      }
    }
  });
  // The lantern's chain.
  parts.push({ geometry: box(0.015, peak - 0.3 - LANTERN[1], 0.015), material: "post", position: [0, (peak - 0.3 + LANTERN[1]) / 2, 0] });
  return parts;
}

function Gazebo() {
  const meshes = useMergedParts(gazeboParts, PALETTE);
  const light = useRef<THREE.PointLight>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    light.current.intensity = 5 + Math.sin(t * 2.3) * 0.25 + Math.sin(t * 5.1) * 0.15;
  });
  return (
    <>
      {meshes}
      <mesh position={LANTERN} raycast={NO_RAYCAST}>
        <boxGeometry args={[0.16, 0.24, 0.16]} />
        <meshBasicMaterial color="#ffd59a" />
      </mesh>
      <sprite position={LANTERN} scale={1.8}>
        <spriteMaterial map={getGlowTexture()} color="#ffc477" transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <pointLight ref={light} position={LANTERN} color="#ffc477" intensity={5} distance={9} decay={1.5} />
      {/* A soft pool of light on the floor beneath it. */}
      <mesh position={[0, GAZEBO.floor + 0.01, 0]} rotation-x={-Math.PI / 2} raycast={NO_RAYCAST}>
        <planeGeometry args={[3.6, 3.6]} />
        <meshBasicMaterial map={getGlowTexture()} color="#ffcf8a" transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  );
}

/** Low lanterns on posts either side of the path. */
function PathLanterns() {
  const meshes = useMergedParts(
    () =>
      PATH_LANTERNS.flatMap((p): Part[] => {
        const y = lawnHeight(p.x, p.z);
        return [
          { geometry: box(0.07, 0.6, 0.07), material: "post", position: [p.x, y + 0.3, p.z] },
          { geometry: box(0.16, 0.03, 0.16), material: "post", position: [p.x, y + 0.85, p.z] },
        ];
      }),
    PALETTE,
  );
  return (
    <>
      {meshes}
      {PATH_LANTERNS.map((p, i) => {
        const y = lawnHeight(p.x, p.z) + 0.72;
        return (
          <group key={i} position={[p.x, y, p.z]}>
            <mesh raycast={NO_RAYCAST}>
              <boxGeometry args={[0.11, 0.2, 0.11]} />
              <meshBasicMaterial color="#ffd59a" />
            </mesh>
            <sprite scale={0.9}>
              <spriteMaterial map={getGlowTexture()} color="#ffc477" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
            </sprite>
          </group>
        );
      })}
    </>
  );
}

/** The vine arch you came in through, at the edge of the lawn: the way back to the far garden. */
function archParts(): Part[] {
  const parts: Part[] = [];
  const rand = createRandom(43);
  for (const side of [-1, 1]) parts.push({ geometry: box(0.1, 1.9, 0.1), material: "white", position: [side * 0.62, 0.95, 0] });
  parts.push({ geometry: new THREE.TorusGeometry(0.62, 0.05, 5, 14, Math.PI), material: "white", position: [0, 1.9, 0] });
  for (let i = 0; i < 14; i++) {
    const a = (i / 13) * Math.PI;
    const r = 0.62 + (rand() - 0.5) * 0.08;
    const at: [number, number, number] = [Math.cos(a) * r, 1.9 + Math.sin(a) * r, (rand() - 0.5) * 0.12];
    parts.push({ geometry: new THREE.IcosahedronGeometry(0.09 + rand() * 0.05, 0), material: i % 3 ? "leaf" : "leafDark", position: at });
    if (i % 3 === 1) parts.push({ geometry: new THREE.IcosahedronGeometry(0.05, 0), material: "pink", position: [at[0], at[1] - 0.06, at[2] + 0.08] });
  }
  return parts;
}

function Arch() {
  const meshes = useMergedParts(archParts, PALETTE);
  const y = lawnHeight(GAZEBO_ARCH.x, GAZEBO_ARCH.z);
  return (
    <group position={[GAZEBO_ARCH.x, y - 0.02, GAZEBO_ARCH.z]} rotation-y={Math.PI}>
      <WayOut zone="gazebo" tagAt={[0, 2.75, 0]} pool={{ at: [0, 0.04, 0.5], size: 2.2 }} light={[0, 1.6, 0.8]}>
        {meshes}
        <mesh visible={false} position={[0, 1.1, 0]}>
          <boxGeometry args={[1.5, 2.3, 0.5]} />
        </mesh>
      </WayOut>
    </group>
  );
}
