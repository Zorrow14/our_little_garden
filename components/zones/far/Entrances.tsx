"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { box, NO_RAYCAST, type Part, PropHover, useMergedParts } from "@/components/garden/props/shared";
import { countdownNote, useCountdown } from "@/lib/countdown";
import { type Entrance, entranceById, type EntranceId, ENTRANCES, farHeight, LIGHTHOUSE_TOWER } from "@/lib/farGarden";
import { toWorld } from "@/lib/frame";
import { useGardenStore } from "@/lib/gardenStore";
import { createRandom } from "@/lib/terrain";
import { getGlowTexture } from "@/lib/textures";
import { CountdownWhenNear } from "../places/shared";
import { takeExit } from "../registry";

/**
 * The five entrances round the far garden, each the way into a place of its
 * own: a greenhouse door, a white gazebo arch, the lighthouse (a tower you can
 * see from all over the meadow, its lamp turning), a hedge arch into the
 * maze, and a ladder up to a treehouse. Each is built in its own space, facing
 * the signpost (+z), its doorway at the origin. Clicking one (or walking into
 * its doorway) goes in; an entrance with no `to` says it's still being built.
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
  dark: "#1d1b22",
  roof: "#7a4a3a",
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
  /** A tall lighthouse, striped red and white, its door at the foot facing the signpost. */
  lighthouse: () => {
    const { radius, top, height } = LIGHTHOUSE_TOWER;
    const cz = -radius - 0.1;
    const parts: Part[] = [];
    parts.push({ geometry: new THREE.CylinderGeometry(radius + 0.18, radius + 0.25, 0.3, 14), material: "stoneDark", position: [0, 0.15, cz] });
    // The tower in bands, narrowing as it rises.
    const bands = 5;
    for (let k = 0; k < bands; k++) {
      const r0 = THREE.MathUtils.lerp(radius, top, k / bands);
      const r1 = THREE.MathUtils.lerp(radius, top, (k + 1) / bands);
      const h = height / bands;
      parts.push({ geometry: new THREE.CylinderGeometry(r1, r0, h, 14), material: k % 2 ? "red" : "white", position: [0, h * (k + 0.5), cz] });
    }
    // The door at the foot, in a stone surround, and two small windows up the front.
    parts.push({ geometry: box(0.62, 1.25, 0.08), material: "dark", position: [0, 0.92, cz + radius - 0.01] });
    parts.push({ geometry: box(0.82, 0.12, 0.14), material: "stone", position: [0, 1.6, cz + radius] });
    for (const side of [-1, 1]) parts.push({ geometry: box(0.1, 1.35, 0.14), material: "stone", position: [side * 0.36, 0.95, cz + radius - 0.02] });
    for (const y of [2.6, 4.3]) {
      const r = THREE.MathUtils.lerp(radius, top, y / height);
      parts.push({ geometry: box(0.2, 0.3, 0.06), material: "dark", position: [0, y, cz + r - 0.01] });
    }
    // The gallery round the top, with its railing, and the cap over the lamp room.
    parts.push({ geometry: new THREE.CylinderGeometry(top + 0.3, top + 0.22, 0.12, 14), material: "stoneDark", position: [0, height + 0.06, cz] });
    const ring = new THREE.TorusGeometry(top + 0.26, 0.025, 4, 20);
    ring.rotateX(Math.PI / 2);
    parts.push({ geometry: ring, material: "white", position: [0, height + 0.42, cz] });
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      parts.push({ geometry: box(0.03, 0.36, 0.03), material: "white", position: [Math.cos(a) * (top + 0.26), height + 0.24, cz + Math.sin(a) * (top + 0.26)] });
    }
    parts.push({ geometry: new THREE.ConeGeometry(top - 0.02, 0.5, 14), material: "red", position: [0, LIGHTHOUSE_TOWER.lamp + 0.55, cz] });
    parts.push({ geometry: new THREE.SphereGeometry(0.07, 6, 5), material: "white", position: [0, LIGHTHOUSE_TOWER.lamp + 0.84, cz] });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      parts.push({ geometry: box(0.04, 0.62, 0.04), material: "white", position: [Math.cos(a) * 0.46, LIGHTHOUSE_TOWER.lamp, cz + Math.sin(a) * 0.46] });
    }
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
  /** A tree with a rope ladder up to a little hut on a platform, peeking out of the leaves. */
  treehouse: () => {
    const parts: Part[] = [];
    parts.push({ geometry: new THREE.CylinderGeometry(0.28, 0.42, 4.4, 8), material: "bark", position: [0, 2.2, -0.62] });
    parts.push({ geometry: box(1.6, 0.08, 1.4), material: "wood", position: [0, 2.45, -0.45] });
    // The hut: plank walls, a dark doorway at the top of the ladder, a pitched roof.
    parts.push({ geometry: box(1.2, 0.85, 0.9), material: "wood", position: [0, 2.92, -0.62] });
    parts.push({ geometry: box(0.36, 0.6, 0.04), material: "dark", position: [0, 2.8, -0.15] });
    const roof = new THREE.ConeGeometry(0.98, 0.55, 4, 1, false, Math.PI / 4);
    roof.scale(1, 1, 0.8);
    parts.push({ geometry: roof, material: "roof", position: [0, 3.62, -0.62] });
    parts.push({ geometry: box(0.3, 0.24, 0.04), material: "glass", position: [0.38, 3.0, -0.15] });
    // A railing along the front of the platform, either side of the ladder.
    for (const side of [-1, 1]) {
      parts.push({ geometry: box(0.5, 0.04, 0.04), material: "wood", position: [side * 0.55, 2.78, 0.22] });
      parts.push({ geometry: box(0.04, 0.34, 0.04), material: "wood", position: [side * 0.78, 2.62, 0.22] });
    }
    const rand = createRandom(95);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      parts.push({
        geometry: new THREE.IcosahedronGeometry(0.75 + rand() * 0.3, 1),
        material: i % 2 ? "leaf" : "leafDark",
        // Round the back and sides of the hut, and over the top, leaving its front clear.
        position: [Math.cos(a) * 0.85, 4.05 + rand() * 0.45, -0.95 + Math.sin(a) * 0.55],
      });
    }
    // The rope ladder, hanging from the platform to the ground.
    for (const side of [-1, 1]) parts.push({ geometry: new THREE.CylinderGeometry(0.015, 0.015, 2.45, 4), material: "rope", position: [side * 0.2, 1.22, 0.1] });
    for (let k = 0; k < 7; k++) parts.push({ geometry: box(0.46, 0.035, 0.05), material: "wood", position: [0, 0.25 + k * 0.32, 0.1] });
    return parts;
  },
};

/** Where each entrance's tag sits, and the box you click (or hover) it by. */
const LOOKS: Record<EntranceId, { tagAt: [number, number, number]; hit: { at: [number, number, number]; size: [number, number, number] } }> = {
  greenhouse: { tagAt: [0, 2.6, 0.2], hit: { at: [0, 1.1, 0], size: [1.8, 2.3, 0.7] } },
  gazebo: { tagAt: [0, 2.6, 0.2], hit: { at: [0, 1.1, 0], size: [1.8, 2.3, 0.7] } },
  lighthouse: { tagAt: [0, 2.3, 0.4], hit: { at: [0, 1.2, -1.15], size: [2.1, 2.4, 2.1] } },
  maze: { tagAt: [0, 2.6, 0.2], hit: { at: [0, 1.1, 0], size: [2.6, 2.3, 0.8] } },
  treehouse: { tagAt: [0, 3.2, 0.2], hit: { at: [0, 1.4, -0.3], size: [1.6, 2.8, 1.2] } },
};

function EntranceMarker({ entrance }: { entrance: Entrance }) {
  const meshes = useMergedParts(BUILDS[entrance.id], PALETTE);
  const ground = useMemo(() => farHeight(entrance.x, entrance.z), [entrance]);
  const clock = useCountdown();
  const enter = () => {
    if (entrance.to) takeExit("far-garden", entrance.id);
    else useGardenStore.setState({ notice: `${entrance.label} isn't open yet. Something is being built here.` });
  };
  const look = LOOKS[entrance.id];
  const note = !entrance.to ? "still being built" : entrance.id === "lighthouse" && clock.state !== "unset" ? countdownNote(clock) : "step inside";

  return (
    <group position={[entrance.x, ground - 0.02, entrance.z]} rotation-y={entrance.yaw}>
      <PropHover tag={entrance.label} note={note} tagAt={look.tagAt} pool={{ at: [0, 0.04, 0.4], size: 2.6 }} light={[0, 1.6, 1.0]} onSelect={enter}>
        {meshes}
        <mesh visible={false} position={look.hit.at}>
          <boxGeometry args={look.hit.size} />
        </mesh>
      </PropHover>
      {entrance.id === "lighthouse" && <LighthouseLamp />}
    </group>
  );
}

/**
 * The lighthouse's lamp, high up, and its two beams sweeping slowly round over
 * the meadow. Brighter and warmer once the day the countdown counts to comes.
 */
function LighthouseLamp() {
  const { radius, lamp } = LIGHTHOUSE_TOWER;
  const at: [number, number, number] = [0, lamp, -radius - 0.1];
  const turn = useRef<THREE.Group>(null!);
  const glow = useRef<THREE.SpriteMaterial>(null!);
  const arrived = useCountdown().state === "arrived";
  const beam = useMemo(() => {
    const length = 15;
    const g = new THREE.ConeGeometry(1.5, length, 20, 1, true);
    // Point from the lamp outward along -x, the narrow end at the lamp.
    g.rotateZ(-Math.PI / 2);
    g.translate(-length / 2, 0, 0);
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color("#ffe9b8") }, uLevel: { value: 0.3 } },
        vertexShader: /* glsl */ `
          varying float vAlong;
          void main() {
            vAlong = uv.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uLevel;
          varying float vAlong;
          void main() {
            gl_FragColor = vec4(uColor, pow(vAlong, 1.6) * uLevel);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(() => {
    material.uniforms.uColor.value.set(arrived ? "#ffd27a" : "#ffe9b8");
    material.uniforms.uLevel.value = arrived ? 0.45 : 0.3;
  }, [material, arrived]);
  useEffect(
    () => () => {
      beam.dispose();
      material.dispose();
    },
    [beam, material],
  );
  useFrame(({ clock }, delta) => {
    turn.current.rotation.y += delta * (arrived ? 0.9 : 0.55);
    glow.current.opacity = (arrived ? 0.85 : 0.65) + 0.2 * Math.max(0, Math.sin(clock.elapsedTime * 0.9));
  });
  return (
    <group position={at}>
      <mesh raycast={NO_RAYCAST}>
        <cylinderGeometry args={[0.4, 0.4, 0.55, 12]} />
        <meshBasicMaterial color="#ffe3a0" />
      </mesh>
      <sprite scale={arrived ? 4.2 : 3.2} raycast={NO_RAYCAST}>
        <spriteMaterial ref={glow} map={getGlowTexture()} color="#ffd88a" transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
      <group ref={turn}>
        <group rotation-z={0.07}>
          <mesh geometry={beam} material={material} raycast={NO_RAYCAST} />
        </group>
        <group rotation-y={Math.PI}>
          <group rotation-z={0.07}>
            <mesh geometry={beam} material={material} raycast={NO_RAYCAST} />
          </group>
        </group>
      </group>
    </group>
  );
}

export default function Entrances() {
  const tower = entranceById("lighthouse");
  return (
    <>
      {ENTRANCES.map((e) => (
        <EntranceMarker key={e.id} entrance={e} />
      ))}
      {/* Coming up to the lighthouse, it tells you the countdown, if there is one. */}
      <CountdownWhenNear at={toWorld(tower, 0, 0.4)} radius={3} />
    </>
  );
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
