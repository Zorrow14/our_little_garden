"use client";

import { Html, useCursor } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import FlowerTag from "@/components/ui/FlowerTag";
import { useGardenStore } from "@/lib/gardenStore";
import { usePlantStore } from "@/lib/plantStore";
import { createRandom, groundHeight } from "@/lib/terrain";
import { getGlowTexture } from "@/lib/textures";
import { landPlants, nearestWalkable, planWander, type Point } from "@/lib/wander";
import GardenerBody, { DROPLET_COUNT, type GardenerLook, type GardenerRig } from "./GardenerBody";

interface GardenerProfile {
  id: string;
  name: string;
  /** Shown under the name on the hover tag. */
  note: string;
  look: GardenerLook;
  start: Point;
  /** Walking pace in units per second, and the distance covered by one step. */
  speed: number;
  stride: number;
  seed: number;
}

const CREW: GardenerProfile[] = [
  {
    id: "zorrow",
    name: "Zorrow",
    note: "watering the garden",
    look: {
      scale: 1.05,
      build: "lean",
      skin: "#d9a47c",
      hair: "#26222a",
      top: "#363b52",
      bottom: "#43557a",
      shoes: "#e4e1dc",
      hairStyle: "short-tousled",
      carry: "watering-can",
      watch: true,
    },
    start: { x: -5.4, z: 3.6 },
    speed: 0.6,
    stride: 0.34,
    seed: 3,
  },
  {
    id: "skelly",
    name: "Skelly",
    note: "gathering flowers",
    look: {
      scale: 0.95,
      build: "petite",
      skin: "#e8b995",
      hair: "#2f2226",
      top: "#f5d3ad",
      bottom: "#e59a86",
      shoes: "#8c5a45",
      hairStyle: "long-bangs",
      carry: "basket",
      blush: true,
    },
    start: { x: 4.6, z: -2.2 },
    speed: 0.5,
    stride: 0.28,
    seed: 9,
  },
];

/** Where each gardener is and where they're heading, so they can keep out of each other's way. */
type Whereabouts = Map<string, { pos: Point; target: Point | null }>;

/** Two little gardeners who wander the garden, tend its flowers, and wave when you tap them. */
export default function Gardeners() {
  const whereabouts = useMemo<Whereabouts>(() => new Map(), []);
  const shadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ map: getGlowTexture(), color: "#000000", transparent: true, opacity: 0.5, depthWrite: false }),
    [],
  );
  useEffect(() => () => shadowMaterial.dispose(), [shadowMaterial]);

  return CREW.map((profile, i) => (
    <Gardener key={profile.id} profile={profile} yieldsFirst={i > 0} whereabouts={whereabouts} shadowMaterial={shadowMaterial} />
  ));
}

type Mode = "idle" | "walk" | "greet";

interface Walker {
  mode: Mode;
  pos: Point;
  yaw: number;
  target: Point | null;
  /** The flower being walked to or tended, if any. */
  tend: Point | null;
  /** Seconds left in the current pause or greeting, or seconds spent on the current walk. */
  timer: number;
  /** Seconds spent waiting for the other gardener to get out of the way. */
  waited: number;
  /** Walk cycle, in radians. */
  phase: number;
  /** 0..1 blends from standing still into walking, tending and waving. */
  moving: number;
  tending: number;
  greeting: number;
  greetTime: number;
  look: number;
  lookTarget: number;
  lookTimer: number;
}

const shortestTurn = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const damp = THREE.MathUtils.damp;

function Gardener({
  profile,
  yieldsFirst,
  whereabouts,
  shadowMaterial,
}: {
  profile: GardenerProfile;
  /** When the two meet head-on, this one steps aside first. */
  yieldsFirst: boolean;
  whereabouts: Whereabouts;
  shadowMaterial: THREE.Material;
}) {
  const { id, look, speed, stride, seed } = profile;
  const root = useRef<THREE.Group>(null!);
  const rig = useMemo(() => ({}) as GardenerRig, []);
  const fadeCenter = useMemo(() => ({ value: new THREE.Vector3() }), []);
  const rand = useMemo(() => createRandom(seed), [seed]);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const interactive = useGardenStore((s) => s.stage === "garden" && !s.activeId && !s.celebrating);
  const [hovered, setHovered] = useState(false);
  const hoveredRef = useRef(false);
  const setHover = (on: boolean) => {
    hoveredRef.current = on;
    setHovered(on);
  };
  const [greetings, setGreetings] = useState(0);
  useCursor(hovered && interactive);

  const [walker] = useState<Walker>(() => ({
    mode: "idle",
    pos: nearestWalkable(profile.start, []),
    yaw: rand() * Math.PI * 2,
    target: null,
    tend: null,
    timer: 0.5 + rand() * 2,
    waited: 0,
    phase: 0,
    moving: 0,
    tending: 0,
    greeting: 0,
    greetTime: 0,
    look: 0,
    lookTarget: 0,
    lookTimer: 0,
  }));

  // Which arm is free to wave, swing and reach: the one not carrying anything. The character's left is +x.
  const carriesLeft = look.carry === "basket";
  const freeSide = carriesLeft ? -1 : 1;

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    const w = walker;
    const other = [...whereabouts.entries()].find(([key]) => key !== id)?.[1];

    let pace = 0;
    let facing: number | null = null;

    if (w.mode === "greet") {
      w.timer -= dt;
      w.greetTime += dt;
      facing = Math.atan2(state.camera.position.x - w.pos.x, state.camera.position.z - w.pos.z);
      if (w.timer <= 0) {
        w.mode = "idle";
        w.timer = 0.6 + rand();
      }
    } else if (w.mode === "idle") {
      w.timer -= dt;
      if (w.tend) facing = Math.atan2(w.tend.x - w.pos.x, w.tend.z - w.pos.z);
      if (w.timer <= 0) {
        const plants = landPlants(usePlantStore.getState().plants);
        const claimed = other ? [other.pos, ...(other.target ? [other.target] : [])] : [];
        const plan = planWander(w.pos, claimed, other ? [other.pos] : [], plants, rand);
        if (plan) {
          // The scene only notices the pointer leaving when the mouse moves, so drop the tag as they walk off.
          if (hoveredRef.current) setHover(false);
          w.mode = "walk";
          w.target = plan.target;
          w.tend = plan.tend;
          w.timer = 0;
          w.waited = 0;
        } else {
          w.timer = 1.5;
        }
      }
    } else if (w.target) {
      const dx = w.target.x - w.pos.x;
      const dz = w.target.z - w.pos.z;
      const distance = Math.hypot(dx, dz);
      w.timer += dt;
      if (distance < 0.05 || w.timer > 25) {
        // Arrived (or gave up): pause a while, longer if there's a flower to tend.
        w.mode = "idle";
        w.target = null;
        w.timer = w.tend ? 4 + rand() * 3 : 2 + rand() * 4;
        if (distance >= 0.05) w.tend = null;
      } else {
        facing = Math.atan2(dx, dz);
        // Turn toward the next spot before setting off.
        const turnedToward = THREE.MathUtils.clamp(1 - Math.abs(shortestTurn(w.yaw, facing)) / 1.1, 0, 1);
        const toOther = other ? { x: other.pos.x - w.pos.x, z: other.pos.z - w.pos.z } : null;
        const inTheWay =
          toOther !== null &&
          Math.hypot(toOther.x, toOther.z) < 0.95 &&
          (toOther.x * dx + toOther.z * dz) / (Math.hypot(toOther.x, toOther.z) * distance) > 0.2;
        if (inTheWay) {
          // Let the other pass; if they don't, find somewhere else to go.
          w.waited += dt;
          if (w.waited > (yieldsFirst ? 1.2 : 2.5)) {
            w.mode = "idle";
            w.target = null;
            w.tend = null;
            w.timer = 0.3;
          }
        } else {
          w.waited = 0;
          pace = speed * turnedToward;
          const step = Math.min(pace * dt, distance);
          w.pos = { x: w.pos.x + (dx / distance) * step, z: w.pos.z + (dz / distance) * step };
        }
      }
    }
    whereabouts.set(id, { pos: w.pos, target: w.target });

    if (facing !== null) w.yaw += shortestTurn(w.yaw, facing) * (1 - Math.exp(-(w.mode === "walk" ? 6 : 3.5) * dt));

    // Blend between poses.
    w.moving = damp(w.moving, pace > 0.01 ? 1 : 0, 8, dt);
    w.tending = damp(w.tending, w.mode === "idle" && w.tend ? 1 : 0, 2.5, dt);
    w.greeting = damp(w.greeting, w.mode === "greet" ? 1 : 0, 7, dt);
    w.phase += ((pace * dt) / stride) * Math.PI;
    const swing = Math.sin(w.phase) * w.moving;
    const still = 1 - w.moving;

    // Idle: look around now and then, or down at the flower being tended.
    w.lookTimer -= dt;
    if (w.lookTimer <= 0) {
      w.lookTarget = w.mode === "idle" && !w.tend ? (rand() - 0.5) * 1.3 : 0;
      w.lookTimer = 1.2 + rand() * 2.5;
    }
    w.look = damp(w.look, w.mode === "walk" ? 0 : w.lookTarget, 3, dt);

    const hop = w.mode === "greet" && w.greetTime < 0.9 ? Math.abs(Math.sin((w.greetTime / 0.45) * Math.PI)) * 0.13 : 0;
    const y = groundHeight(w.pos.x, w.pos.z);
    root.current.position.set(w.pos.x, y, w.pos.z);
    root.current.rotation.y = w.yaw;
    fadeCenter.value.set(w.pos.x, y + 0.6, w.pos.z);

    if (!rig.bounce) return;
    rig.bounce.position.y = Math.abs(Math.sin(w.phase)) * 0.035 * w.moving + hop;
    rig.leftLeg.rotation.x = swing * 0.45;
    rig.rightLeg.rotation.x = -swing * 0.45;

    const watering = look.carry === "watering-can";
    // Skelly leans in to pick; Zorrow stays upright to pour.
    const lean = 0.07 * w.moving + (watering ? 0.05 : 0.32) * w.tending;
    rig.upper.rotation.x = lean;
    rig.upper.rotation.z = Math.sin(w.phase) * 0.04 * w.moving + Math.sin(t * 1.1 + seed) * 0.022 * still;
    rig.upper.scale.y = 1 + Math.sin(t * 2.2 + seed) * 0.012 * still;

    rig.head.rotation.y = w.look * (1 - w.greeting);
    rig.head.rotation.x = (watering ? 0.3 : 0.45) * w.tending - 0.12 * w.greeting;
    rig.head.rotation.z = 0.18 * w.greeting * freeSide;

    const free = freeSide === 1 ? rig.leftArm : rig.rightArm;
    const carrying = freeSide === 1 ? rig.rightArm : rig.leftArm;
    // Arms swing against the leg on their own side; the carrying arm barely moves.
    const freeSwing = -swing * 0.5 * freeSide;
    const wave = Math.sin(t * 13) * 0.35;
    free.rotation.x = freeSwing * (1 - w.greeting) - (watering ? 0 : 1.1 + Math.sin(t * 3) * 0.08) * w.tending;
    free.rotation.z = freeSide * (0.1 + (2.45 + wave) * w.greeting);
    carrying.rotation.x = swing * 0.15 * freeSide - (watering ? 0.9 : 0) * w.tending;
    // Held a little away from the body, the basket clear of the skirt.
    carrying.rotation.z = -freeSide * ((watering ? 0.2 : 0.34) + Math.sin(t * 1.3 + seed) * 0.02 * still);
    // The can tips forward to pour, then settles back; the basket sways with each step.
    rig.prop.rotation.x = watering ? 1.9 * w.tending : Math.sin(w.phase) * 0.12 * w.moving;

    if (rig.water && rig.spout) {
      const pouring = w.tending > 0.8;
      rig.water.visible = pouring;
      if (pouring) {
        const spout = root.current.worldToLocal(rig.spout.getWorldPosition(scratch));
        rig.water.children.forEach((drop, i) => {
          const fall = (t * 1.7 + i / DROPLET_COUNT) % 1;
          drop.position.set(
            spout.x + Math.sin(i * 2.3) * 0.02,
            THREE.MathUtils.lerp(spout.y, 0.02, fall * fall),
            spout.z + 0.03 + fall * 0.04,
          );
        });
      }
    }
  });

  const greet = (e: ThreeEvent<MouseEvent>) => {
    // Ignore the release at the end of a drag to look around.
    if (!interactive || e.delta > 8) return;
    e.stopPropagation();
    const w = walker;
    w.mode = "greet";
    w.timer = 2.4;
    w.greetTime = 0;
    setGreetings((n) => n + 1);
  };

  return (
    <group ref={root} scale={look.scale}>
      <GardenerBody look={look} rig={rig} fadeCenter={fadeCenter} />
      <mesh material={shadowMaterial} position-y={0.015} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.8, 0.8]} />
      </mesh>
      <mesh
        visible={false}
        position-y={0.6}
        onPointerOver={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        onClick={greet}
      >
        <capsuleGeometry args={[0.38, 0.6, 2, 8]} />
      </mesh>
      {hovered && interactive && (
        <Html position={[0, 1.45, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <FlowerTag text={profile.name} note={profile.note} />
        </Html>
      )}
      {greetings > 0 && (
        <Html key={greetings} position={[0, 1.8, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <motion.svg
            viewBox="0 0 24 24"
            className="h-7 w-7 fill-rose [filter:drop-shadow(0_2px_6px_rgb(3_5_18/0.6))]"
            aria-hidden="true"
            initial={{ y: 0, opacity: 0, scale: 0.4 }}
            animate={{ y: -46, opacity: [0, 1, 1, 0], scale: 1 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
          >
            <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z" />
          </motion.svg>
        </Html>
      )}
    </group>
  );
}
