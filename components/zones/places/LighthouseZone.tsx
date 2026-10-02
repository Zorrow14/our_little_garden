"use client";

import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { box, mergedGeometry, NO_RAYCAST, type Part, plain, PropHover, PropHoverLight, rod, useMergedParts } from "@/components/garden/props/shared";
import { announceCountdown, countdownNote, useCountdown } from "@/lib/countdown";
import { LAMP, LAMP_NEAR, LIGHTHOUSE_DOOR, LIGHTHOUSE_FURNITURE, LIGHTHOUSE_ROOM, STAIR, stairStep } from "@/lib/places/lighthouse";
import { getGlowTexture } from "@/lib/textures";
import { CountdownWhenNear, PlaceCamera, type PlaceView, WayOut } from "./shared";

/**
 * Inside the foot of the lighthouse: a round stone room, a stair spiralling up
 * the wall toward the light, a keeper's desk. In the middle, on a pedestal,
 * the spare lamp that keeps the countdown to your next visit: dark while
 * there's no date (`lib/countdown.ts`), lit and gently pulsing while it
 * counts, and blazing gold with sparkles once the day comes. Walk up to it, or
 * click it, to hear how long there is to go.
 *
 * The wall is a cylinder seen from inside only, so the half nearest the
 * camera is see-through from any side, like the cottage's walls.
 */

const { radius: R, height: H } = LIGHTHOUSE_ROOM;

const PALETTE = {
  floor: "#7c7266",
  floorEdge: "#4f4842",
  stone: "#a59886",
  step: "#8a6a52",
  rail: "#5a4a3e",
  brass: "#c9a45a",
  pedestal: "#8f8577",
  desk: "#7a5a42",
  book: "#a8463f",
  paper: "#efe6d6",
  barrel: "#8a6040",
  hoop: "#4a4440",
  rope: "#d9c9a6",
};

const VIEW: PlaceView = {
  target: [0, 0.85, -0.1],
  distance: 7.8,
  polar: 0.95,
  azimuth: 0.55,
  zoom: [3.5, 10],
  tip: [0.5, 1.2],
  turn: [-0.6, 1.6],
  follow: "still",
};

/** The oil lamp on the keeper's desk. */
const DESK_LAMP: [number, number, number] = [LIGHTHOUSE_FURNITURE.desk.x + 0.12, 0.92, LIGHTHOUSE_FURNITURE.desk.z + 0.05];

export default function LighthouseZone() {
  return (
    <>
      <color attach="background" args={["#0a0d1e"]} />
      <hemisphereLight args={["#ffe3c2", "#2a2420", 0.75]} />
      <directionalLight position={[2, 6, 5]} color="#9fb2ff" intensity={0.35} />
      <pointLight position={DESK_LAMP} color="#ffb35c" intensity={3} decay={1.7} />
      <Room />
      <Stair />
      <Furnishings />
      <Lamp />
      <TheWayOut />
      <CountdownWhenNear at={LAMP} radius={LAMP_NEAR} />
      <PropHoverLight />
      <PlaceCamera view={VIEW} />
    </>
  );
}

/** The cylinder's angle for a point at `angle` round the room (as `atan2(z, x)`). */
const thetaOf = (angle: number) => Math.atan2(Math.cos(angle), Math.sin(angle));

function Room() {
  const floor = useMergedParts(
    () => [
      { geometry: new THREE.CylinderGeometry(R, R, 0.1, 28), material: "floor", position: [0, -0.05, 0] },
      { geometry: new THREE.CylinderGeometry(R + 0.25, R + 0.3, 0.2, 28), material: "floorEdge", position: [0, -0.2, 0] },
    ],
    PALETTE,
    plain,
  );
  const { wall, overDoor, skirting, material, dark } = useMemo(() => {
    const half = LIGHTHOUSE_DOOR.width / 2 / R;
    const door = thetaOf(LIGHTHOUSE_DOOR.angle);
    const above = H - LIGHTHOUSE_DOOR.height;
    return {
      wall: new THREE.CylinderGeometry(R, R, H, 32, 1, true, door + half, Math.PI * 2 - half * 2),
      overDoor: new THREE.CylinderGeometry(R, R, above, 4, 1, true, door - half, half * 2).translate(0, LIGHTHOUSE_DOOR.height + above / 2, 0),
      skirting: new THREE.CylinderGeometry(R - 0.01, R - 0.01, 0.3, 32, 1, true, door + half, Math.PI * 2 - half * 2),
      material: new THREE.MeshLambertMaterial({ color: PALETTE.stone, flatShading: true, side: THREE.BackSide }),
      dark: new THREE.MeshLambertMaterial({ color: PALETTE.floorEdge, flatShading: true, side: THREE.BackSide }),
    };
  }, []);
  useEffect(
    () => () => {
      [wall, overDoor, skirting, material, dark].forEach((x) => x.dispose());
    },
    [wall, overDoor, skirting, material, dark],
  );
  return (
    <>
      {floor}
      <mesh geometry={wall} material={material} position-y={H / 2} raycast={NO_RAYCAST} />
      <mesh geometry={overDoor} material={material} raycast={NO_RAYCAST} />
      <mesh geometry={skirting} material={dark} position-y={0.15} raycast={NO_RAYCAST} />
    </>
  );
}

/** Steps round the wall, each set into it, with a rope handrail along their open side. */
function stairParts(): Part[] {
  const parts: Part[] = [];
  const mid = (STAIR.inner + R) / 2;
  const depth = R - STAIR.inner;
  const width = (Math.abs(STAIR.sweep) / STAIR.steps) * mid + 0.04;
  const rail: THREE.Vector3[] = [];
  for (let i = 0; i < STAIR.steps; i++) {
    const { angle, y } = stairStep(i);
    const yaw = Math.atan2(Math.cos(angle), Math.sin(angle));
    parts.push({ geometry: box(width, 0.09, depth), material: "step", position: [Math.cos(angle) * mid, y - 0.045, Math.sin(angle) * mid], rotation: [0, yaw, 0] });
    // A riser under each, down to the one below, so the stair reads as solid.
    parts.push({ geometry: box(width - 0.02, STAIR.rise, depth - 0.04), material: "stone", position: [Math.cos(angle) * (mid + 0.02), y - 0.09 - STAIR.rise / 2, Math.sin(angle) * (mid + 0.02)], rotation: [0, yaw, 0] });
    const post = new THREE.Vector3(Math.cos(angle) * (STAIR.inner + 0.06), y, Math.sin(angle) * (STAIR.inner + 0.06));
    if (i % 2 === 0) parts.push({ geometry: box(0.035, 0.7, 0.035), material: "rail", position: [post.x, y + 0.35, post.z] });
    rail.push(post.clone().setY(y + 0.68));
  }
  for (let i = 0; i < rail.length - 2; i += 2) parts.push({ geometry: rod(rail[i], rail[i + 2], 0.02, 0.02, 4), material: "rope", position: [0, 0, 0] });
  return parts;
}

function Stair() {
  const meshes = useMergedParts(stairParts, PALETTE, plain);
  return <>{meshes}</>;
}

function furnishingParts(): Part[] {
  const { desk, barrel } = LIGHTHOUSE_FURNITURE;
  const parts: Part[] = [];
  const toWall = Math.atan2(desk.x, desk.z);
  // The keeper's desk, with an open logbook and a stack of charts.
  parts.push({ geometry: box(0.85, 0.05, 0.5), material: "desk", position: [desk.x, 0.74, desk.z], rotation: [0, toWall, 0] });
  for (const [sx, sz] of [
    [-0.36, -0.2],
    [0.36, -0.2],
    [-0.36, 0.2],
    [0.36, 0.2],
  ]) {
    const c = Math.cos(toWall);
    const s = Math.sin(toWall);
    parts.push({ geometry: box(0.05, 0.72, 0.05), material: "desk", position: [desk.x + sx * c + sz * s, 0.36, desk.z - sx * s + sz * c] });
  }
  parts.push({ geometry: box(0.36, 0.03, 0.26), material: "paper", position: [desk.x - 0.12, 0.78, desk.z + 0.02], rotation: [0, toWall + 0.2, 0] });
  parts.push({ geometry: box(0.38, 0.02, 0.28), material: "book", position: [desk.x - 0.12, 0.765, desk.z + 0.02], rotation: [0, toWall + 0.2, 0] });
  parts.push({ geometry: box(0.24, 0.06, 0.3), material: "paper", position: [desk.x + 0.22, 0.79, desk.z - 0.04], rotation: [0, toWall - 0.15, 0] });
  // The oil lamp's base.
  parts.push({ geometry: new THREE.CylinderGeometry(0.06, 0.08, 0.06, 8), material: "brass", position: [DESK_LAMP[0], 0.8, DESK_LAMP[2]] });
  // A barrel, and a coil of rope on the floor.
  parts.push({ geometry: new THREE.CylinderGeometry(barrel.r * 0.9, barrel.r * 0.9, 0.7, 10), material: "barrel", position: [barrel.x, 0.35, barrel.z] });
  parts.push({ geometry: new THREE.CylinderGeometry(barrel.r, barrel.r, 0.06, 10), material: "hoop", position: [barrel.x, 0.15, barrel.z] });
  parts.push({ geometry: new THREE.CylinderGeometry(barrel.r, barrel.r, 0.06, 10), material: "hoop", position: [barrel.x, 0.55, barrel.z] });
  for (let k = 0; k < 3; k++) {
    const coil = new THREE.TorusGeometry(0.2 - k * 0.04, 0.03, 4, 14);
    coil.rotateX(Math.PI / 2);
    parts.push({ geometry: coil, material: "rope", position: [-0.75, 0.03 + k * 0.05, 1.45] });
  }
  return parts;
}

function Furnishings() {
  const meshes = useMergedParts(furnishingParts, PALETTE, plain);
  return (
    <>
      {meshes}
      <mesh position={DESK_LAMP} raycast={NO_RAYCAST}>
        <cylinderGeometry args={[0.045, 0.045, 0.14, 8]} />
        <meshBasicMaterial color="#ffd59a" />
      </mesh>
      <sprite position={DESK_LAMP} scale={0.7}>
        <spriteMaterial map={getGlowTexture()} color="#ffb35c" transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </>
  );
}

/** How the lamp looks in each state of the countdown. */
const LAMP_LOOKS = {
  unset: { bulb: "#4d4a52", glass: "#7f8fa0", glow: 0.06, light: 0 },
  counting: { bulb: "#ffe1a0", glass: "#ffe9c0", glow: 0.6, light: 4 },
  arrived: { bulb: "#fff1c8", glass: "#ffd27a", glow: 0.95, light: 7.5 },
};

/** The spare lamp on its pedestal: a stack of glass rings round a bulb. Click it for the countdown. */
function Lamp() {
  const clock = useCountdown();
  const look = LAMP_LOOKS[clock.state];
  const top = 0.78;
  const pedestal = useMergedParts(
    () => [
      { geometry: new THREE.CylinderGeometry(0.3, LAMP.r, top, 10), material: "pedestal", position: [0, top / 2, 0] },
      { geometry: new THREE.CylinderGeometry(0.34, 0.34, 0.06, 12), material: "brass", position: [0, top + 0.03, 0] },
      { geometry: new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12), material: "brass", position: [0, top + 0.82, 0] },
    ],
    PALETTE,
    plain,
  );
  const rings = useMemo(() => {
    return mergedGeometry(
      Array.from({ length: 5 }, (_, k) => {
        const r = 0.27 - Math.abs(k - 2) * 0.035;
        return new THREE.CylinderGeometry(r, r, 0.1, 14, 1, true).translate(0, top + 0.16 + k * 0.13, 0);
      }),
    );
  }, []);
  useEffect(() => () => rings.dispose(), [rings]);

  const light = useRef<THREE.PointLight>(null!);
  const glow = useRef<THREE.SpriteMaterial>(null!);
  useFrame(({ clock: c }) => {
    // A slow breath while it counts; steadier and brighter once the day comes.
    const breathe = clock.state === "counting" ? 0.75 + 0.25 * Math.sin(c.elapsedTime * 1.2) : 1;
    light.current.intensity = look.light * breathe;
    glow.current.opacity = look.glow * breathe;
  });

  const bulbY = top + 0.42;
  return (
    <group position={[LAMP.x, 0, LAMP.z]}>
      <PropHover
        tag="The lamp"
        note={countdownNote(clock)}
        tagAt={[0, 1.95, 0]}
        pool={{ at: [0, 0.02, 0], size: 2.4 }}
        light={[0.6, 1.4, 0.6]}
        onSelect={announceCountdown}
      >
        {pedestal}
        <mesh geometry={rings} raycast={NO_RAYCAST}>
          <meshBasicMaterial color={look.glass} transparent opacity={clock.state === "unset" ? 0.35 : 0.55} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position-y={bulbY} raycast={NO_RAYCAST}>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshBasicMaterial color={look.bulb} />
        </mesh>
        <mesh visible={false} position-y={0.85}>
          <cylinderGeometry args={[0.45, 0.45, 1.7, 8]} />
        </mesh>
      </PropHover>
      <sprite position-y={bulbY} scale={clock.state === "arrived" ? 3.4 : 2.4} raycast={NO_RAYCAST}>
        <spriteMaterial ref={glow} map={getGlowTexture()} color="#ffd88a" transparent opacity={look.glow} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <pointLight ref={light} position-y={bulbY} color="#ffcf80" intensity={look.light} distance={7} decay={1.5} />
      {clock.state === "arrived" && <Sparkles count={50} scale={[2.4, 2.2, 2.4]} position-y={1.4} size={4} speed={0.4} noise={0.6} color="#ffe3a0" />}
    </group>
  );
}

/** The door, and the night outside it. */
function TheWayOut() {
  const { x, z, angle, width, height } = LIGHTHOUSE_DOOR;
  const frame = useMergedParts(
    () => [
      { geometry: box(0.14, 0.14, width + 0.3), material: "floorEdge", position: [0, height + 0.07, 0] },
      { geometry: box(0.14, height, 0.14), material: "floorEdge", position: [0, height / 2, -width / 2 - 0.07] },
      { geometry: box(0.14, height, 0.14), material: "floorEdge", position: [0, height / 2, width / 2 + 0.07] },
    ],
    PALETTE,
    plain,
  );
  // Turned so local +x points into the room, the doorway across local z.
  return (
    <group position={[x, 0, z]} rotation-y={-angle + Math.PI}>
      {frame}
      <mesh position={[-0.08, height / 2, 0]} rotation-y={Math.PI / 2} raycast={NO_RAYCAST}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#141a33" />
      </mesh>
      <WayOut zone="lighthouse" tagAt={[0.4, height + 0.4, 0]} pool={{ at: [0.6, 0.02, 0], size: 1.8 }} light={[0.6, 1.2, 0]}>
        <mesh visible={false} position={[0, height / 2, 0]}>
          <boxGeometry args={[0.3, height, width]} />
        </mesh>
      </WayOut>
    </group>
  );
}
