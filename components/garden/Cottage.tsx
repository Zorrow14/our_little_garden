"use client";

import { Html, useCursor } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGardenStore } from "@/lib/gardenStore";
import { withCameraFade, withGrowth } from "@/lib/growth";
import { COTTAGE, OFF_DOORSTEP, PROCESSION, PROCESSION_LENGTH, procession } from "@/lib/procession";
import { createRandom, groundHeight } from "@/lib/terrain";
import { getGlowTexture } from "@/lib/textures";
import { useZone } from "@/lib/zones";
import FlowerTag from "@/components/ui/FlowerTag";
import { takeExit } from "@/components/zones/registry";

const { width: W, depth: D, wallHeight: H, doorWidth: DW, doorHeight: DH } = COTTAGE;
const WALL = 0.09;
const PITCH = THREE.MathUtils.degToRad(38);
const RISE = (D / 2) * Math.tan(PITCH);
const EAVE = 0.22;
/** Seconds for the door to swing fully open or shut. */
const DOOR_SWING = 1.1;
const DOOR_OPEN_ANGLE = 1.75;

const PALETTE = {
  plaster: "#e6d6bb",
  roof: "#a4523f",
  stone: "#8a847b",
  timber: "#5d4230",
  door: "#7b4a2f",
  brass: "#d8b25a",
  pink: "#f29ab6",
  yellow: "#ffe08a",
};
const WARM_GLASS = "#ffc978";
const WARM_ROOM = "#ffb35c";

type MaterialKey = keyof typeof PALETTE | "glass" | "room";

interface Part {
  geometry: THREE.BufferGeometry;
  material: MaterialKey;
  position: [number, number, number];
  rotation?: [number, number, number];
}

/** From the cottage's own space (origin at floor level in the middle, door toward +z) to world space. */
function toWorld(x: number, z: number) {
  const c = Math.cos(COTTAGE.yaw);
  const s = Math.sin(COTTAGE.yaw);
  return { x: COTTAGE.x + x * c + z * s, z: COTTAGE.z - x * s + z * c };
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

interface WindowPart {
  geometry: THREE.BufferGeometry;
  material: MaterialKey;
  offset: [number, number, number];
}

/** A window with a warm lit pane, a cross of glazing bars and a sill, facing +z at the origin. */
function windowParts(): WindowPart[] {
  return [
    { geometry: box(0.42, 0.38, 0.04), material: "glass", offset: [0, 0, 0] },
    { geometry: box(0.035, 0.4, 0.06), material: "timber", offset: [0, 0, 0.005] },
    { geometry: box(0.44, 0.035, 0.06), material: "timber", offset: [0, 0, 0.005] },
    { geometry: box(0.52, 0.05, 0.1), material: "timber", offset: [0, -0.215, 0.03] },
  ];
}

/** Every static piece of the cottage, in its own space. */
function buildParts(): Part[] {
  const parts: Part[] = [];
  const add = (geometry: THREE.BufferGeometry, material: MaterialKey, position: Part["position"], rotation?: Part["rotation"]) =>
    parts.push({ geometry, material, position, rotation });

  // A stone base deep enough to meet the slope on every side.
  const baseDepth = COTTAGE.floorY - COTTAGE.lowestGround + 0.37;
  add(box(W + 0.16, baseDepth, D + 0.16), "stone", [0, 0.02 - baseDepth / 2, 0]);
  // A doorstep down to the path.
  const step = toWorld(0, D / 2 + 0.24);
  const stepDrop = Math.max(0.15, COTTAGE.floorY - groundHeight(step.x, step.z) + 0.2);
  add(box(0.86, stepDrop, 0.46), "stone", [0, -0.05 - stepDrop / 2, D / 2 + 0.24]);

  // Walls, with a doorway in the front.
  const side = (W - DW) / 2;
  add(box(W, H, WALL), "plaster", [0, H / 2, -D / 2 + WALL / 2]);
  add(box(WALL, H, D), "plaster", [-W / 2 + WALL / 2, H / 2, 0]);
  add(box(WALL, H, D), "plaster", [W / 2 - WALL / 2, H / 2, 0]);
  add(box(side, H, WALL), "plaster", [-(DW / 2 + side / 2), H / 2, D / 2 - WALL / 2]);
  add(box(side, H, WALL), "plaster", [DW / 2 + side / 2, H / 2, D / 2 - WALL / 2]);
  add(box(DW, H - DH, WALL), "plaster", [0, DH + (H - DH) / 2, D / 2 - WALL / 2]);
  // Timber at the corners and around the door.
  for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
    add(box(0.1, H, 0.1), "timber", [x * (W / 2 - 0.03), H / 2, z * (D / 2 - 0.03)]);
  }
  add(box(0.07, DH + 0.06, 0.13), "timber", [-(DW / 2 + 0.035), (DH + 0.06) / 2, D / 2]);
  add(box(0.07, DH + 0.06, 0.13), "timber", [DW / 2 + 0.035, (DH + 0.06) / 2, D / 2]);
  add(box(DW + 0.14, 0.07, 0.13), "timber", [0, DH + 0.06, D / 2]);

  // Gable ends: a triangle of wall above each side wall, under the roof.
  const gable = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, RISE)]);
  const gableGeometry = new THREE.ExtrudeGeometry(gable, { depth: W - 0.02, bevelEnabled: false }).translate(0, 0, -(W - 0.02) / 2);
  add(gableGeometry, "plaster", [0, H, 0], [0, Math.PI / 2, 0]);

  // Two roof slopes meeting at a ridge, overhanging the walls a little.
  const slope = (D / 2 + EAVE) / Math.cos(PITCH);
  const thickness = 0.08;
  for (const dir of [1, -1]) {
    const run = (D / 2 + EAVE) / 2;
    const y = H + RISE - run * Math.tan(PITCH) + (thickness / 2) * Math.cos(PITCH);
    const z = dir * (run + (thickness / 2) * Math.sin(PITCH));
    add(box(W + 0.3, thickness, slope), "roof", [0, y, z], [dir * PITCH, 0, 0]);
  }
  add(box(W + 0.34, 0.07, 0.12), "timber", [0, H + RISE + 0.06, 0]);

  // A chimney poking up through the back slope.
  add(box(0.3, 0.8, 0.3), "stone", [W * 0.27, H + RISE - 0.08, -D * 0.22]);
  add(box(0.38, 0.06, 0.38), "timber", [W * 0.27, H + RISE + 0.34, -D * 0.22]);

  // Windows: two at the front with flower boxes, one on each side, one at the back.
  const windows: { at: [number, number, number]; turn: number; flowers?: boolean }[] = [
    { at: [-(DW / 2 + side / 2), 0.82, D / 2 + 0.005], turn: 0, flowers: true },
    { at: [DW / 2 + side / 2, 0.82, D / 2 + 0.005], turn: 0, flowers: true },
    { at: [W / 2 + 0.005, 0.82, 0], turn: Math.PI / 2 },
    { at: [-W / 2 - 0.005, 0.82, 0], turn: -Math.PI / 2 },
    { at: [0, 0.82, -D / 2 - 0.005], turn: Math.PI },
  ];
  const rand = createRandom(17);
  for (const w of windows) {
    const c = Math.cos(w.turn);
    const s = Math.sin(w.turn);
    const place = (ox: number, oy: number, oz: number): [number, number, number] => [
      w.at[0] + ox * c + oz * s,
      w.at[1] + oy,
      w.at[2] - ox * s + oz * c,
    ];
    for (const p of windowParts()) add(p.geometry, p.material, place(...p.offset), [0, w.turn, 0]);
    if (w.flowers) {
      add(box(0.48, 0.1, 0.13), "timber", place(0, -0.3, 0.08), [0, w.turn, 0]);
      for (let i = 0; i < 4; i++) {
        const blossom = new THREE.IcosahedronGeometry(0.045 + rand() * 0.015, 0);
        add(blossom, i % 2 ? "yellow" : "pink", place(-0.16 + i * 0.105, -0.22, 0.08 + (rand() - 0.5) * 0.04));
      }
    }
  }

  // A warm lit room, seen through the doorway.
  add(new THREE.PlaneGeometry(W - WALL * 2 - 0.02, H - 0.05), "room", [0, H / 2, -D / 2 + WALL + 0.005]);

  // A lantern by the door, on a little bracket.
  add(box(0.03, 0.03, 0.14), "timber", [DW / 2 + 0.24, 1.3, D / 2 + 0.07]);
  add(box(0.1, 0.14, 0.1), "glass", [DW / 2 + 0.24, 1.2, D / 2 + 0.12]);
  add(box(0.13, 0.03, 0.13), "timber", [DW / 2 + 0.24, 1.285, D / 2 + 0.12]);

  return parts;
}

/**
 * A little cottage just outside the gate, where the gardeners live. Its static
 * pieces are merged into one mesh per material; only the door moves. Walking
 * up to the door, or clicking it, goes inside (the house zone).
 */
export default function Cottage() {
  const door = useRef<THREE.Group>(null!);
  const spill = useRef<THREE.MeshBasicMaterial>(null!);
  const lantern = useRef<THREE.SpriteMaterial>(null!);
  /** Linear 0..1 swing progress, eased when applied. */
  const swing = useRef(0);
  const interactive = useGardenStore((s) => s.stage === "garden" && !s.activeId && !s.celebrating);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && interactive);

  const fadeCenter = useMemo(() => ({ value: new THREE.Vector3(COTTAGE.x, COTTAGE.floorY + 1, COTTAGE.z) }), []);
  const materials = useMemo(() => {
    const matte = (color: string) =>
      withCameraFade(withGrowth(new THREE.MeshLambertMaterial({ color, flatShading: true })), 1.8, 3.6, fadeCenter);
    const lit = (color: string) => withCameraFade(new THREE.MeshBasicMaterial({ color }), 1.8, 3.6, fadeCenter);
    const all: Partial<Record<MaterialKey, THREE.Material>> = { glass: lit(WARM_GLASS), room: lit(WARM_ROOM) };
    for (const [key, color] of Object.entries(PALETTE)) all[key as keyof typeof PALETTE] = matte(color);
    return all as Record<MaterialKey, THREE.Material>;
  }, [fadeCenter]);

  const meshes = useMemo(() => {
    const byMaterial = new Map<MaterialKey, THREE.BufferGeometry[]>();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (const part of buildParts()) {
      q.setFromEuler(new THREE.Euler(...(part.rotation ?? [0, 0, 0])));
      m.compose(new THREE.Vector3(...part.position), q, new THREE.Vector3(1, 1, 1));
      // Merging needs every piece in the same (non-indexed) form.
      const g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
      if (g !== part.geometry) part.geometry.dispose();
      g.applyMatrix4(m);
      byMaterial.set(part.material, [...(byMaterial.get(part.material) ?? []), g]);
    }
    return [...byMaterial].map(([material, geometries]) => {
      const merged = mergeGeometries(geometries)!;
      geometries.forEach((g) => g.dispose());
      return { material, geometry: merged };
    });
  }, []);

  useEffect(
    () => () => {
      meshes.forEach((m) => m.geometry.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    },
    [meshes, materials],
  );

  // Ground in front of the door, for the pool of light that spills out when it opens.
  const spillY = useMemo(() => {
    const p = toWorld(0, D / 2 + 0.9);
    return groundHeight(p.x, p.z) - COTTAGE.floorY + 0.04;
  }, []);

  useFrame((state, delta) => {
    // Shut the door behind the intro walk once everyone's well clear of it.
    const walkers = [...procession.walkers.values()];
    if (useGardenStore.getState().introSkipped || (walkers.length > 0 && walkers.every((w) => w.s > OFF_DOORSTEP + 1.4))) {
      procession.doorWanted = false;
    }
    // Afterwards it opens for anyone who comes up to it, and as you step inside.
    const open = procession.doorWanted || procession.nearDoor.size > 0 || useZone.getState().leaving !== null;
    const target = open ? 1 : 0;
    swing.current = THREE.MathUtils.clamp(swing.current + Math.sign(target - swing.current) * (delta / DOOR_SWING), 0, 1);
    procession.door = swing.current;
    const eased = swing.current * swing.current * (3 - 2 * swing.current);
    door.current.rotation.y = eased * DOOR_OPEN_ANGLE;
    spill.current.opacity = 0.55 * eased;
    lantern.current.opacity = 0.55 + Math.sin(state.clock.elapsedTime * 7.3) * 0.04 + Math.sin(state.clock.elapsedTime * 3.1) * 0.05;
  });

  /** Clicking the door goes straight in, as if you'd walked up to it. */
  const goInside = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive || e.delta > 8) return;
    e.stopPropagation();
    takeExit("garden", "cottage-door");
  };

  return (
    <>
      <group position={[COTTAGE.x, COTTAGE.floorY, COTTAGE.z]} rotation-y={COTTAGE.yaw}>
        {meshes.map(({ material, geometry }) => (
          <mesh key={material} geometry={geometry} material={materials[material]} />
        ))}
        {/* The door swings inward on hinges at its left edge. */}
        <group ref={door} position={[-DW / 2, 0, D / 2 - WALL / 2]}>
          <mesh
            material={materials.door}
            position={[DW / 2, DH / 2, 0]}
            onPointerOver={(e) => {
              if (!interactive) return;
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={() => setHovered(false)}
            onClick={goInside}
          >
            <boxGeometry args={[DW - 0.02, DH - 0.01, 0.05]} />
          </mesh>
          <mesh material={materials.brass} position={[DW - 0.1, DH * 0.48, 0.035]}>
            <sphereGeometry args={[0.025, 6, 5]} />
          </mesh>
        </group>
        <mesh position={[0, spillY, D / 2 + 0.9]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[1.8, 1.8]} />
          <meshBasicMaterial
            ref={spill}
            map={getGlowTexture()}
            color={WARM_ROOM}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {hovered && interactive && (
          <Html position={[0, DH + 0.45, D / 2 + 0.2]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
            <FlowerTag text="Into the cottage" />
          </Html>
        )}
        <sprite position={[DW / 2 + 0.24, 1.2, D / 2 + 0.14]} scale={0.9}>
          <spriteMaterial ref={lantern} map={getGlowTexture()} color={WARM_GLASS} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
      <CottagePath />
    </>
  );
}

const STONE_SPACING = 0.72;

/** Stepping stones from the doorstep down to the gate, matching the garden path. */
function CottagePath() {
  const stones = useMemo(() => {
    const rand = createRandom(29);
    const start = OFF_DOORSTEP - 0.2;
    const count = Math.floor((PROCESSION_LENGTH - start) / STONE_SPACING);
    return Array.from({ length: count }, (_, i) => {
      const u = (start + (i + 0.5) * STONE_SPACING) / PROCESSION_LENGTH;
      const p = PROCESSION.getPointAt(u);
      const t = PROCESSION.getTangentAt(u);
      const sideways = (rand() - 0.5) * 0.24;
      return { x: p.x - t.z * sideways, z: p.z + t.x * sideways, size: 0.8 + rand() * 0.35, spin: rand() * Math.PI, tilt: (rand() - 0.5) * 0.08 };
    });
  }, []);

  const geometry = useMemo(() => new THREE.CylinderGeometry(0.3, 0.34, 0.08, 7), []);
  const material = useMemo(() => withGrowth(new THREE.MeshLambertMaterial({ color: "#857f76", flatShading: true })), []);
  const mesh = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    stones.forEach((s, i) => {
      m.position.set(s.x, groundHeight(s.x, s.z) + 0.015, s.z);
      m.rotation.set(s.tilt, s.spin, s.tilt);
      m.scale.set(s.size, 1, s.size * 0.85);
      m.updateMatrix();
      mesh.current.setMatrixAt(i, m.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [stones]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <instancedMesh ref={mesh} args={[geometry, material, stones.length]} />;
}
