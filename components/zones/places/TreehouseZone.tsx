"use client";

import { Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { box, mergedGeometry, NO_RAYCAST, type Part, plain, PropHoverLight, rod, useMergedParts } from "@/components/garden/props/shared";
import { TREEHOUSE, TREEHOUSE_DOOR, TREEHOUSE_DROP, TREEHOUSE_FURNITURE, TREEHOUSE_WINDOW } from "@/lib/places/treehouse";
import { createRandom } from "@/lib/terrain";
import { getGlowTexture } from "@/lib/textures";
import { wallPanels } from "../walls";
import { boxRoomWalls, PlaceCamera, type PlaceView, WayOut } from "./shared";

/**
 * Inside the treehouse: a little plank room up in the leaves, seen
 * dollhouse-style like the cottage, warm with a candle and a lantern. A nest
 * of cushions, a crate for a table, and a window looking down over the far
 * garden at night. Nothing to do here; it's just for the two of you.
 */

const { halfWidth: W, halfDepth: D, height: H } = TREEHOUSE;
const WARM = "#ffb35c";

const PALETTE = {
  plank: "#a0714f",
  plankDark: "#8a5f42",
  wall: "#b5845e",
  batten: "#7a5238",
  bark: "#4a3628",
  leaf: "#3f7a46",
  leafDark: "#2f5f3a",
  mattress: "#efe6d6",
  blanket: "#d77f93",
  blanketB: "#e2b74f",
  pillow: "#f7efe4",
  crate: "#9a7650",
  mug: "#e8dcc8",
  mugB: "#8fb6d8",
  rug: "#7f9a6e",
  rope: "#d9c9a6",
  ground: "#16271f",
};

export default function TreehouseZone() {
  return (
    <>
      <color attach="background" args={["#0a0d1e"]} />
      <Stars radius={60} depth={30} count={900} factor={2.6} saturation={0} fade />
      <TreehouseLights />
      <Room />
      <Furnishings />
      <Window />
      <TheWayOut />
      <PropHoverLight />
      <PlaceCamera view={VIEW} />
    </>
  );
}

const VIEW: PlaceView = {
  target: [0.05, 0.55, -0.15],
  distance: 6.8,
  polar: 0.98,
  azimuth: 0.62,
  zoom: [3.5, 9.5],
  tip: [0.55, 1.22],
  turn: [0.08, 1.2],
  follow: "still",
};

const LANTERN: [number, number, number] = [1.0, 1.45, 0.15];
const CANDLE: [number, number, number] = [TREEHOUSE_FURNITURE.crate.x + 0.08, 0.52, TREEHOUSE_FURNITURE.crate.z + 0.05];

function TreehouseLights() {
  const candle = useRef<THREE.PointLight>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    candle.current.intensity = 2 + Math.sin(t * 7.3) * 0.18 + Math.sin(t * 3.1) * 0.22;
  });
  return (
    <>
      <hemisphereLight args={["#ffe3c2", "#2a1f18", 0.8]} />
      <directionalLight position={[TREEHOUSE_WINDOW.x + 1, 4, -8]} color="#9fb2ff" intensity={0.5} />
      <pointLight position={LANTERN} color={WARM} intensity={6} decay={1.6} />
      <pointLight ref={candle} position={CANDLE} color="#ffcf80" intensity={2} decay={1.8} />
    </>
  );
}

const WALLS = boxRoomWalls(W, D, TREEHOUSE_DOOR, TREEHOUSE_WINDOW);

/** The floor, the plank walls, and what holds it all up in the tree. */
function Room() {
  const meshes = useMergedParts(roomParts, PALETTE, plain);
  const wall = useMemo(() => plain(PALETTE.wall), []);
  useEffect(() => () => wall.dispose(), [wall]);
  return (
    <>
      {meshes}
      {WALLS.map((spec, i) => (
        <group key={i} position={spec.position} rotation-y={spec.rotation}>
          {wallPanels(spec.length, H, spec.holes).map((p, j) => (
            <mesh key={j} material={wall} position={[p.x + p.w / 2, p.y + p.h / 2, 0]}>
              <planeGeometry args={[p.w, p.h]} />
            </mesh>
          ))}
        </group>
      ))}
      <Canopy />
    </>
  );
}

function roomParts(): Part[] {
  const parts: Part[] = [];
  // Floorboards, running across the room, on a thick platform.
  const count = 10;
  const width = (D * 2) / count;
  for (let i = 0; i < count; i++) {
    parts.push({ geometry: box(W * 2, 0.1, width - 0.012), material: i % 2 ? "plank" : "plankDark", position: [0, -0.05, -D + width * (i + 0.5)] });
  }
  parts.push({ geometry: box(W * 2 + 0.3, 0.16, D * 2 + 0.3), material: "batten", position: [0, -0.18, 0] });
  // Battens along the back and left walls, so they read as planks, and corner posts.
  for (let y = 0.3; y < H; y += 0.3) {
    parts.push({ geometry: box(W * 2, 0.025, 0.02), material: "batten", position: [0, y, -D + 0.012] });
    const runs =
      y > TREEHOUSE_DOOR.height
        ? [[-D, D]]
        : [
            [-D, TREEHOUSE_DOOR.z - TREEHOUSE_DOOR.width / 2],
            [TREEHOUSE_DOOR.z + TREEHOUSE_DOOR.width / 2, D],
          ];
    for (const [from, to] of runs) parts.push({ geometry: box(0.02, 0.025, to - from), material: "batten", position: [-W + 0.012, y, (from + to) / 2] });
  }
  for (const [x, z] of [
    [-W, -D],
    [W, -D],
    [-W, D],
  ]) {
    parts.push({ geometry: box(0.12, H + 0.1, 0.12), material: "batten", position: [x, H / 2, z] });
  }
  parts.push({ geometry: box(W * 2 + 0.12, 0.1, 0.12), material: "batten", position: [0, H, -D] });
  parts.push({ geometry: box(0.12, 0.1, D * 2), material: "batten", position: [-W, H, 0] });

  // The trunk, from the ground far below, up through the floor and out the top, with a branch.
  const { trunk } = TREEHOUSE_FURNITURE;
  parts.push({ geometry: new THREE.CylinderGeometry(trunk.r * 0.85, trunk.r * 1.5, TREEHOUSE_DROP + H + 1.2, 9), material: "bark", position: [trunk.x, (H + 1.2 - TREEHOUSE_DROP) / 2, trunk.z] });
  parts.push({ geometry: rod(new THREE.Vector3(trunk.x, 1.4, trunk.z), new THREE.Vector3(trunk.x + 0.9, 2.4, trunk.z - 0.5), 0.11, 0.06, 6), material: "bark", position: [0, 0, 0] });
  // Beams under the floor, braced to the trunk.
  for (const z of [-D + 0.3, 0, D - 0.3]) parts.push({ geometry: box(W * 2 + 0.4, 0.14, 0.14), material: "bark", position: [0, -0.33, z] });
  for (const [x, z] of [
    [W - 0.3, D - 0.3],
    [W - 0.3, -D + 0.3],
    [-W + 0.4, D - 0.3],
  ]) {
    parts.push({ geometry: rod(new THREE.Vector3(trunk.x, -2.2, trunk.z), new THREE.Vector3(x, -0.38, z), 0.07, 0.07, 5), material: "bark", position: [0, 0, 0] });
  }
  // The ground, far below.
  parts.push({ geometry: new THREE.CylinderGeometry(9, 9, 0.1, 24), material: "ground", position: [0, -TREEHOUSE_DROP, 0] });
  return parts;
}

/** Leaves all round outside, and a few branches, so the room sits up in the tree. */
function Canopy() {
  const meshes = useMergedParts(() => {
    const parts: Part[] = [];
    const rand = createRandom(41);
    for (let i = 0; i < 26; i++) {
      // Behind and to either side, never in front, where they'd hide the room.
      const a = -Math.PI * 0.15 - rand() * Math.PI * 0.95;
      const r = 2.9 + rand() * 1.4;
      parts.push({
        geometry: new THREE.IcosahedronGeometry(0.6 + rand() * 0.5, 1),
        material: rand() < 0.5 ? "leaf" : "leafDark",
        position: [Math.cos(a) * r * 1.1, 0.4 + rand() * 2.6, Math.sin(a) * r * 0.9 - 0.4],
      });
    }
    for (let i = 0; i < 8; i++) {
      const x = -W - 0.6 + rand() * (W * 2 + 1.2);
      parts.push({ geometry: new THREE.IcosahedronGeometry(0.55 + rand() * 0.3, 1), material: "leafDark", position: [x, -1 - rand() * 1.6, -D - 0.6 - rand()] });
    }
    return parts;
  }, PALETTE);
  return <>{meshes}</>;
}

function furnishingParts(): Part[] {
  const { nest, crate } = TREEHOUSE_FURNITURE;
  const parts: Part[] = [];
  // A rug in the middle.
  parts.push({ geometry: new THREE.CylinderGeometry(0.85, 0.85, 0.02, 14), material: "rug", position: [-0.1, 0.01, 0.25] });
  // The nest: a low mattress heaped with blankets and pillows.
  parts.push({ geometry: box(nest.halfX * 2, 0.18, nest.halfZ * 2), material: "mattress", position: [nest.x, 0.09, nest.z] });
  parts.push({ geometry: box(nest.halfX * 2 - 0.1, 0.07, nest.halfZ * 1.2), material: "blanket", position: [nest.x, 0.21, nest.z + 0.22], rotation: [0, 0.05, 0] });
  parts.push({ geometry: box(0.7, 0.06, 0.5), material: "blanketB", position: [nest.x - 0.25, 0.27, nest.z + 0.1], rotation: [0, -0.3, 0.04] });
  parts.push({ geometry: box(0.5, 0.15, 0.3), material: "pillow", position: [nest.x - 0.3, 0.27, nest.z - 0.45], rotation: [-0.2, 0.1, 0] });
  parts.push({ geometry: box(0.5, 0.15, 0.3), material: "pillow", position: [nest.x + 0.3, 0.27, nest.z - 0.45], rotation: [-0.2, -0.1, 0] });
  parts.push({ geometry: box(0.36, 0.12, 0.26), material: "blanket", position: [nest.x + 0.55, 0.3, nest.z - 0.2], rotation: [-0.1, -0.5, 0] });
  // The crate, upturned, with two mugs on it, and two floor cushions.
  parts.push({ geometry: box(0.48, 0.42, 0.42), material: "crate", position: [crate.x, 0.21, crate.z] });
  for (let k = 0; k < 3; k++) parts.push({ geometry: box(0.5, 0.03, 0.44), material: "batten", position: [crate.x, 0.08 + k * 0.14, crate.z] });
  parts.push({ geometry: new THREE.CylinderGeometry(0.04, 0.035, 0.08, 8), material: "mug", position: [crate.x - 0.12, 0.46, crate.z - 0.06] });
  parts.push({ geometry: new THREE.CylinderGeometry(0.04, 0.035, 0.08, 8), material: "mugB", position: [crate.x - 0.02, 0.46, crate.z - 0.14] });
  parts.push({ geometry: new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), material: "pillow", position: [CANDLE[0], 0.47, CANDLE[2]] });
  parts.push({ geometry: new THREE.CylinderGeometry(0.24, 0.26, 0.1, 10), material: "blanket", position: [crate.x - 0.6, 0.05, crate.z + 0.25] });
  parts.push({ geometry: new THREE.CylinderGeometry(0.24, 0.26, 0.1, 10), material: "blanketB", position: [crate.x + 0.55, 0.05, crate.z + 0.45] });
  // The lantern, hung from a branch through the roof, and fairy lights along the back wall.
  parts.push({ geometry: new THREE.CylinderGeometry(0.008, 0.008, H + 0.3 - LANTERN[1], 4), material: "rope", position: [LANTERN[0], (H + 0.3 + LANTERN[1]) / 2, LANTERN[2]] });
  parts.push({ geometry: box(0.16, 0.03, 0.16), material: "batten", position: [LANTERN[0], LANTERN[1] + 0.12, LANTERN[2]] });
  parts.push({ geometry: box(0.16, 0.03, 0.16), material: "batten", position: [LANTERN[0], LANTERN[1] - 0.12, LANTERN[2]] });
  return parts;
}

function Furnishings() {
  const meshes = useMergedParts(furnishingParts, PALETTE, plain);
  const bulbs = useMemo(() => {
    return mergedGeometry(
      Array.from({ length: 15 }, (_, i) => {
        const t = i / 14;
        return new THREE.SphereGeometry(0.025, 5, 4).translate(-W + 0.15 + t * (W * 2 - 0.3), H - 0.15 - Math.sin(t * Math.PI * 3) ** 2 * 0.14, -D + 0.05);
      }),
    );
  }, []);
  useEffect(() => () => bulbs.dispose(), [bulbs]);
  return (
    <>
      {meshes}
      <mesh geometry={bulbs} raycast={NO_RAYCAST}>
        <meshBasicMaterial color="#ffe2a8" />
      </mesh>
      <mesh position={LANTERN} raycast={NO_RAYCAST}>
        <boxGeometry args={[0.12, 0.2, 0.12]} />
        <meshBasicMaterial color="#ffd59a" />
      </mesh>
      <sprite position={LANTERN} scale={1.3}>
        <spriteMaterial map={getGlowTexture()} color={WARM} transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite position={[CANDLE[0], CANDLE[1] + 0.06, CANDLE[2]]} scale={0.32}>
        <spriteMaterial map={getGlowTexture()} color="#ffd38a" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </>
  );
}

/** The window in the back wall, looking down over the far garden below. */
function Window() {
  const { x, y, width, height } = TREEHOUSE_WINDOW;
  const view = useFarGardenView();
  const frame = useMergedParts(
    () => [
      [0, height / 2 + 0.03, width + 0.12, 0.06],
      [0, -height / 2 - 0.03, width + 0.12, 0.06],
      [-width / 2 - 0.03, 0, 0.06, height],
      [width / 2 + 0.03, 0, 0.06, height],
      [0, 0, 0.04, height],
    ].map(([bx, by, bw, bh]): Part => ({ geometry: box(bw, bh, 0.05), material: "batten", position: [bx, by, 0.02] })),
    PALETTE,
    plain,
  );
  return (
    <group position={[x, y, -D]}>
      <mesh position={[0, 0, -0.02]} raycast={NO_RAYCAST}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={view} />
      </mesh>
      {frame}
      <mesh position={[0, -height / 2 - 0.08, 0.08]} raycast={NO_RAYCAST}>
        <boxGeometry args={[width + 0.24, 0.05, 0.18]} />
        <meshLambertMaterial color={PALETTE.plank} flatShading />
      </mesh>
    </group>
  );
}

/**
 * The view from the window, painted: the far garden at night, seen from up in
 * the tree. The meadow below, its signpost lantern, the lights of the other
 * places round it, the lighthouse's beam sweeping, the brook, and leaves.
 */
function useFarGardenView() {
  const texture = useMemo(() => {
    const W = 512;
    const H = 400;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    const rand = createRandom(23);

    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.45);
    sky.addColorStop(0, "#0b1230");
    sky.addColorStop(1, "#2a3570");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(235, 238, 255, ${0.3 + rand() * 0.6})`;
      ctx.fillRect(rand() * W, rand() * H * 0.3, 1.6, 1.6);
    }
    // Far hills and trees along the horizon.
    ctx.fillStyle = "#16263a";
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 48; x += 48) ctx.lineTo(x, H * 0.36 - rand() * 26);
    ctx.lineTo(W, H);
    ctx.fill();
    ctx.fillStyle = "#13221f";
    for (let i = 0; i < 12; i++) {
      const x = rand() * W;
      const y = H * 0.4 - rand() * 12;
      const s = 16 + rand() * 18;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.6, y + 4);
      ctx.lineTo(x, y - s * 1.3);
      ctx.lineTo(x + s * 0.6, y + 4);
      ctx.fill();
    }
    // The meadow, seen from above: a wide oval, and the brook curving across the near side.
    ctx.fillStyle = "#1f3a2c";
    ctx.fillRect(0, H * 0.42, W, H);
    ctx.fillStyle = "#284a36";
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.66, W * 0.46, H * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(170, 196, 255, 0.55)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-10, H * 0.93);
    ctx.quadraticCurveTo(W / 2, H * 0.84, W + 10, H * 0.95);
    ctx.stroke();
    // The paths out from the middle, and the lights of the places round it.
    const glow = (x: number, y: number, r: number, color: string) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const centre = { x: W / 2, y: H * 0.66 };
    const places = [
      { a: -0.35, color: "rgba(255, 210, 140, 0.9)" },
      { a: 0.9, color: "rgba(244, 166, 196, 0.9)" },
      { a: 1.57, color: "rgba(255, 230, 160, 1)" },
      { a: 2.25, color: "rgba(140, 220, 150, 0.8)" },
    ];
    ctx.strokeStyle = "rgba(90, 100, 80, 0.7)";
    ctx.lineWidth = 3;
    for (const p of places) {
      const x = centre.x + Math.cos(p.a + Math.PI) * W * 0.36;
      const y = centre.y + Math.sin(p.a + Math.PI) * H * 0.15;
      ctx.beginPath();
      ctx.moveTo(centre.x, centre.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      glow(x, y, 26, p.color);
    }
    // The lighthouse at the back, and its beam.
    const lx = centre.x;
    const ly = centre.y - H * 0.15;
    ctx.fillStyle = "rgba(255, 236, 190, 0.18)";
    ctx.beginPath();
    ctx.moveTo(lx, ly - 34);
    ctx.lineTo(lx + 230, ly - 70);
    ctx.lineTo(lx + 230, ly - 18);
    ctx.fill();
    ctx.fillStyle = "#e9e4da";
    ctx.fillRect(lx - 5, ly - 34, 10, 34);
    ctx.fillStyle = "#c4534a";
    ctx.fillRect(lx - 5, ly - 22, 10, 8);
    glow(lx, ly - 36, 22, "rgba(255, 230, 160, 1)");
    glow(centre.x, centre.y, 18, "rgba(255, 201, 120, 0.9)");
    // Leaves framing the view.
    for (let i = 0; i < 22; i++) {
      const corner = i % 3;
      const x = corner === 0 ? rand() * 110 : corner === 1 ? W - rand() * 110 : rand() * W;
      const y = corner === 2 ? rand() * 40 : rand() * H * 0.5;
      ctx.fillStyle = rand() < 0.5 ? "#173322" : "#1e3f2a";
      ctx.beginPath();
      const s = 22 + rand() * 30;
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.9, y - s * 0.2);
      ctx.lineTo(x + s * 0.4, y + s * 0.8);
      ctx.lineTo(x - s * 0.7, y + s * 0.4);
      ctx.fill();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** The door in the left wall, out to the top of the ladder. */
function TheWayOut() {
  const { z, width, height } = TREEHOUSE_DOOR;
  const ladder = useMergedParts(
    () => {
      const parts: Part[] = [];
      for (const side of [-1, 1]) {
        parts.push({ geometry: new THREE.CylinderGeometry(0.015, 0.015, 2.6, 4), material: "rope", position: [-0.35, -1.1, side * 0.2] });
      }
      for (let k = 0; k < 6; k++) parts.push({ geometry: box(0.05, 0.035, 0.46), material: "plank", position: [-0.35, 0.05 - k * 0.38, 0] });
      // A little landing outside the door.
      parts.push({ geometry: box(0.5, 0.08, width + 0.3), material: "plankDark", position: [-0.25, -0.04, 0] });
      return parts;
    },
    PALETTE,
    plain,
  );
  return (
    <group position={[-W, 0, z]}>
      {ladder}
      {/* The frame. */}
      {[
        [height + 0.04, 0, width + 0.16, 0.08],
        [height / 2, -width / 2 - 0.04, 0.08, height],
        [height / 2, width / 2 + 0.04, 0.08, height],
      ].map(([fy, fz, fw, fh], i) => (
        <mesh key={i} position={[0.03, fy, fz]} rotation-y={Math.PI / 2} raycast={NO_RAYCAST}>
          <boxGeometry args={[fw, fh, 0.06]} />
          <meshLambertMaterial color={PALETTE.batten} flatShading />
        </mesh>
      ))}
      <WayOut zone="treehouse" tagAt={[0.3, height + 0.35, 0]} pool={{ at: [0.55, 0.02, 0], size: 1.6 }} light={[0.5, 1.2, 0]}>
        <mesh visible={false} position={[0, height / 2, 0]}>
          <boxGeometry args={[0.3, height, width]} />
        </mesh>
      </WayOut>
    </group>
  );
}
