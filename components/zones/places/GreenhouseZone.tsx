"use client";

import { Html } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import Flower from "@/components/garden/Flower";
import { box, mergedGeometry, NO_RAYCAST, type Part, plain, PropHover, PropHoverLight, rod, useMergedParts } from "@/components/garden/props/shared";
import FlowerTag from "@/components/ui/FlowerTag";
import { FLOWER_REGISTRY, type FlowerType } from "@/lib/flowerSpecs";
import { CATALOG, CATALOG_SPACING, GREENHOUSE, GREENHOUSE_DOOR, GREENHOUSE_FURNITURE } from "@/lib/places/greenhouse";
import { usePlantStore } from "@/lib/plantStore";
import { getGlowTexture } from "@/lib/textures";
import { PlaceCamera, type PlaceView, WayOut } from "./shared";

/**
 * Inside the greenhouse: white-framed glass on a low brick wall, lit warm
 * from inside. Along the back, a stand with one of every flower there is, each
 * labelled, to look at (hover one for what it means). On the right, the
 * potting bench: click it to plant something, as with the button in the garden.
 */

const { halfWidth: W, halfDepth: D, eaves: EAVES, ridge: RIDGE } = GREENHOUSE;
const KNEE = 0.45;
const WARM = "#ffc477";

const PALETTE = {
  floor: "#8c7b68",
  edge: "#5d4c3f",
  brick: "#9c5b45",
  white: "#e9e4da",
  wood: "#8a6a52",
  woodDark: "#6b4f3c",
  pot: "#b4674a",
  soil: "#3b2a21",
  leaf: "#4f8a55",
  leafDark: "#3b6d45",
  water: "#3d6d8a",
  sack: "#c8b48c",
  seeds: "#d77f93",
  seedsB: "#e2b74f",
  metal: "#7f9a9e",
};

export default function GreenhouseZone() {
  return (
    <>
      <color attach="background" args={["#0a0d1e"]} />
      <GreenhouseLights />
      <Outside />
      <Structure />
      <Catalog />
      <PottingBench />
      <TheWayOut />
      <PropHoverLight />
      <PlaceCamera view={VIEW} />
    </>
  );
}

const VIEW: PlaceView = {
  target: [0.1, 0.7, -0.35],
  distance: 9.4,
  polar: 0.95,
  azimuth: 0.55,
  zoom: [3.5, 12],
  tip: [0.45, 1.25],
  turn: [-0.35, 1.35],
  follow: "still",
};

const LAMPS: [number, number, number][] = [
  [-1.5, 2.35, 0],
  [1.5, 2.35, 0],
];

function GreenhouseLights() {
  return (
    <>
      <hemisphereLight args={["#ffe6c4", "#2f2a22", 0.95]} />
      <directionalLight position={[3, 6, -6]} color="#9fb2ff" intensity={0.45} />
      {LAMPS.map((p, i) => (
        <pointLight key={i} position={p} color={WARM} intensity={6} decay={1.5} />
      ))}
    </>
  );
}

/** The night outside the glass: dark grass, a few bushes. */
function Outside() {
  const meshes = useMergedParts(outsideParts, { grass: "#1d3529", bush: "#1a3024" });
  return <>{meshes}</>;
}

function outsideParts(): Part[] {
  const parts: Part[] = [{ geometry: new THREE.CylinderGeometry(14, 14, 0.1, 32), material: "grass", position: [0, -0.12, 0] }];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.3;
    const r = 6.5 + (i % 3) * 1.6;
    parts.push({ geometry: new THREE.IcosahedronGeometry(0.6 + (i % 4) * 0.2, 0), material: "bush", position: [Math.cos(a) * r, 0.3, Math.sin(a) * r] });
  }
  return parts;
}

/** The floor, the brick knee wall, and the white frame. The glass is separate, as it's see-through. */
function Structure() {
  const meshes = useMergedParts(structureParts, PALETTE, plain);
  const glass = useMemo(glassGeometry, []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#cfeee8", transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    [],
  );
  useEffect(
    () => () => {
      glass.dispose();
      material.dispose();
    },
    [glass, material],
  );
  return (
    <>
      {meshes}
      <mesh geometry={glass} material={material} raycast={NO_RAYCAST} />
      <Lanterns />
    </>
  );
}

function structureParts(): Part[] {
  const parts: Part[] = [];
  // Floor tiles, on a slab whose edge shows from outside.
  parts.push({ geometry: box(W * 2, 0.08, D * 2), material: "floor", position: [0, -0.04, 0] });
  parts.push({ geometry: box(W * 2 + 0.2, 0.14, D * 2 + 0.2), material: "edge", position: [0, -0.12, 0] });

  // The knee wall, with a gap for the door.
  const doorFrom = GREENHOUSE_DOOR.z - GREENHOUSE_DOOR.width / 2;
  const doorTo = GREENHOUSE_DOOR.z + GREENHOUSE_DOOR.width / 2;
  parts.push({ geometry: box(W * 2 + 0.12, KNEE, 0.12), material: "brick", position: [0, KNEE / 2, -D] });
  parts.push({ geometry: box(W * 2 + 0.12, KNEE, 0.12), material: "brick", position: [0, KNEE / 2, D] });
  parts.push({ geometry: box(0.12, KNEE, D * 2), material: "brick", position: [W, KNEE / 2, 0] });
  parts.push({ geometry: box(0.12, KNEE, doorFrom + D), material: "brick", position: [-W, KNEE / 2, (doorFrom - D) / 2] });
  parts.push({ geometry: box(0.12, KNEE, D - doorTo), material: "brick", position: [-W, KNEE / 2, (doorTo + D) / 2] });

  // Uprights, every 0.8 along each wall, and rails along the top.
  const post = (x: number, z: number, from = KNEE, to = EAVES) =>
    parts.push({ geometry: box(0.06, to - from, 0.06), material: "white", position: [x, (from + to) / 2, z] });
  for (let x = -W; x <= W + 0.01; x += 0.8) {
    post(x, -D);
    post(x, D);
  }
  for (let z = -D + 0.8; z < D - 0.01; z += 0.8) {
    post(W, z);
    if (z < doorFrom - 0.1 || z > doorTo + 0.1) post(-W, z);
  }
  post(-W, doorFrom, 0, GREENHOUSE_DOOR.height);
  post(-W, doorTo, 0, GREENHOUSE_DOOR.height);
  parts.push({ geometry: box(0.07, 0.06, GREENHOUSE_DOOR.width), material: "white", position: [-W, GREENHOUSE_DOOR.height, GREENHOUSE_DOOR.z] });
  for (const z of [-D, D]) parts.push({ geometry: box(W * 2, 0.07, 0.08), material: "white", position: [0, EAVES, z] });
  for (const x of [-W, W]) {
    parts.push({ geometry: box(0.08, 0.07, D * 2), material: "white", position: [x, EAVES, 0] });
    parts.push({ geometry: box(0.06, RIDGE - EAVES, 0.06), material: "white", position: [x, (EAVES + RIDGE) / 2, 0] });
  }
  // The roof: a ridge beam, and rafters down each side.
  parts.push({ geometry: box(W * 2 + 0.1, 0.08, 0.1), material: "white", position: [0, RIDGE, 0] });
  for (let x = -W; x <= W + 0.01; x += 0.8) {
    for (const z of [-D, D]) parts.push({ geometry: rod(new THREE.Vector3(x, EAVES, z), new THREE.Vector3(x, RIDGE, 0), 0.03, 0.03, 4), material: "white", position: [0, 0, 0] });
  }
  return parts;
}

/** Every pane of glass, as one see-through mesh. */
function glassGeometry() {
  const v: number[] = [];
  const tri = (...p: [number, number, number][]) => p.forEach((q) => v.push(...q));
  const quad = (a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]) => {
    tri(a, b, c);
    tri(a, c, d);
  };
  quad([-W, KNEE, -D], [W, KNEE, -D], [W, EAVES, -D], [-W, EAVES, -D]);
  quad([-W, KNEE, D], [W, KNEE, D], [W, EAVES, D], [-W, EAVES, D]);
  quad([W, KNEE, -D], [W, KNEE, D], [W, EAVES, D], [W, EAVES, -D]);
  const from = GREENHOUSE_DOOR.z - GREENHOUSE_DOOR.width / 2;
  const to = GREENHOUSE_DOOR.z + GREENHOUSE_DOOR.width / 2;
  const top = GREENHOUSE_DOOR.height;
  quad([-W, KNEE, -D], [-W, KNEE, from], [-W, EAVES, from], [-W, EAVES, -D]);
  quad([-W, KNEE, to], [-W, KNEE, D], [-W, EAVES, D], [-W, EAVES, to]);
  quad([-W, top, from], [-W, top, to], [-W, EAVES, to], [-W, EAVES, from]);
  for (const x of [-W, W]) tri([x, EAVES, -D], [x, EAVES, D], [x, RIDGE, 0]);
  quad([-W, EAVES, -D], [W, EAVES, -D], [W, RIDGE, 0], [-W, RIDGE, 0]);
  quad([-W, EAVES, D], [W, EAVES, D], [W, RIDGE, 0], [-W, RIDGE, 0]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  return g;
}

/** Two lanterns hanging from the ridge, and fairy lights strung along it. */
function Lanterns() {
  const bulbs = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 17; i++) {
      const x = -W + 0.2 + (i / 16) * (W * 2 - 0.4);
      parts.push(new THREE.SphereGeometry(0.03, 5, 4).translate(x, RIDGE - 0.1 - Math.sin((i / 16) * Math.PI * 4) ** 2 * 0.12, 0.02));
    }
    for (const [x, y, z] of LAMPS) parts.push(new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(x, y, z));
    for (const [x, y, z] of LAMPS) parts.push(new THREE.CylinderGeometry(0.008, 0.008, RIDGE - y, 4).translate(x, (y + RIDGE) / 2, z));
    return mergedGeometry(parts);
  }, []);
  useEffect(() => () => bulbs.dispose(), [bulbs]);
  return (
    <>
      <mesh geometry={bulbs} raycast={NO_RAYCAST}>
        <meshBasicMaterial color="#ffe2a8" />
      </mesh>
      {LAMPS.map((p, i) => (
        <sprite key={i} position={p} scale={1.4}>
          <spriteMaterial map={getGlowTexture()} color={WARM} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// The catalog: one of every flower, on the stand along the back.

const FLOWER_SCALE = 0.42;
/** How high above its shelf a flower stands: on the soil in its pot, or on the water in its bowl. */
const POT_TOP = 0.2;
const BOWL_TOP = 0.11;

const floats = (type: FlowerType) => FLOWER_REGISTRY[type].spec.stemHeight === 0;

const slots = CATALOG.flatMap((shelf) => shelf.flowers.map((type, i) => ({ type, x: shelf.x0 + i * CATALOG_SPACING, y: shelf.y, z: shelf.z })));

function catalogParts(): Part[] {
  const { stand } = GREENHOUSE_FURNITURE;
  const parts: Part[] = [];
  const length = stand.halfX * 2;
  for (const shelf of CATALOG) {
    parts.push({ geometry: box(length, 0.05, 0.42), material: "wood", position: [stand.x, shelf.y - 0.025, shelf.z] });
    for (const x of [stand.x - stand.halfX + 0.08, stand.x, stand.x + stand.halfX - 0.08]) {
      parts.push({ geometry: box(0.06, shelf.y, 0.06), material: "woodDark", position: [x, shelf.y / 2, shelf.z + 0.17] });
    }
  }
  for (const s of slots) {
    if (floats(s.type)) {
      parts.push({ geometry: new THREE.CylinderGeometry(0.25, 0.17, 0.12, 10), material: "pot", position: [s.x, s.y + 0.06, s.z] });
      parts.push({ geometry: new THREE.CylinderGeometry(0.22, 0.22, 0.02, 10), material: "water", position: [s.x, s.y + BOWL_TOP - 0.01, s.z] });
    } else {
      parts.push({ geometry: new THREE.CylinderGeometry(0.13, 0.1, POT_TOP, 8), material: "pot", position: [s.x, s.y + POT_TOP / 2, s.z] });
      parts.push({ geometry: new THREE.CylinderGeometry(0.115, 0.115, 0.02, 8), material: "soil", position: [s.x, s.y + POT_TOP - 0.01, s.z] });
    }
    // The stake its name card is on.
    parts.push({ geometry: box(0.015, 0.16, 0.015), material: "woodDark", position: [s.x + 0.2, s.y + 0.08, s.z + 0.13] });
  }
  return parts;
}

function Catalog() {
  const meshes = useMergedParts(catalogParts, PALETTE, plain);
  const [hovered, setHovered] = useState<FlowerType | null>(null);
  return (
    <>
      {meshes}
      <NameCards />
      {slots.map((s) => {
        const top = s.y + (floats(s.type) ? BOWL_TOP : POT_TOP);
        const entry = FLOWER_REGISTRY[s.type];
        return (
          <group key={s.type}>
            <Flower id={`greenhouse-${s.type}`} spec={entry.spec} position={[s.x, top, s.z]} scale={FLOWER_SCALE} status="bloomed" />
            {/* Hover a flower to read its name and what it's for. Nothing happens on a click. */}
            <mesh
              visible={false}
              position={[s.x, top + 0.3, s.z]}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(s.type);
              }}
              onPointerOut={() => setHovered((h) => (h === s.type ? null : h))}
            >
              <boxGeometry args={[0.6, 0.7, 0.4]} />
            </mesh>
            {hovered === s.type && (
              <Html position={[s.x, top + 0.85, s.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
                <FlowerTag text={entry.name} note={entry.label} />
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

/** A little card on a stake in front of each pot, with the flower's name written on it by hand. */
/** The name cards are drawn side by side on one canvas, this many to a row, each this many pixels. */
const COLS = 4;
const CARD = { w: 256, h: 128 };

function NameCards() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = CARD.w * COLS;
    canvas.height = CARD.h * Math.ceil(slots.length / COLS);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);

  // Written once the handwriting font is ready (in a plain face until then).
  useEffect(() => {
    const canvas = texture.image as HTMLCanvasElement;
    const hand = getComputedStyle(document.body).getPropertyValue("--font-hand").trim() || "cursive";
    const draw = () => {
      const ctx = canvas.getContext("2d")!;
      slots.forEach((s, i) => {
        const x = (i % COLS) * CARD.w;
        const y = Math.floor(i / COLS) * CARD.h;
        ctx.fillStyle = "#f3ead8";
        ctx.fillRect(x, y, CARD.w, CARD.h);
        ctx.strokeStyle = "#cdbb9a";
        ctx.lineWidth = 6;
        ctx.strokeRect(x + 3, y + 3, CARD.w - 6, CARD.h - 6);
        ctx.fillStyle = "#3a2c22";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const name = FLOWER_REGISTRY[s.type].name;
        let size = 54;
        ctx.font = `${size}px ${hand}`;
        while (ctx.measureText(name).width > CARD.w - 28 && size > 20) ctx.font = `${(size -= 2)}px ${hand}`;
        ctx.fillText(name, x + CARD.w / 2, y + CARD.h / 2 + 4);
      });
      texture.needsUpdate = true;
    };
    draw();
    let live = true;
    document.fonts?.load(`54px ${hand}`).then(() => live && draw(), () => {});
    return () => {
      live = false;
    };
  }, [texture]);

  const geometry = useMemo(() => {
    const rows = Math.ceil(slots.length / COLS);
    const cards = slots.map((s, i) => {
      const g = new THREE.PlaneGeometry(0.24, 0.12);
      const u0 = (i % COLS) / COLS;
      const v1 = 1 - Math.floor(i / COLS) / rows;
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / COLS, v1 - (1 - uv.getY(k)) / rows);
      g.rotateX(-0.35);
      g.translate(s.x + 0.2, s.y + 0.19, s.z + 0.15);
      return g;
    });
    return mergedGeometry(cards);
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      texture.dispose();
    },
    [geometry, texture],
  );

  return (
    <mesh geometry={geometry} raycast={NO_RAYCAST}>
      <meshLambertMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// The potting bench: another way into the "Plant something" form.

function benchParts(): Part[] {
  const { bench } = GREENHOUSE_FURNITURE;
  const top = 0.85;
  const parts: Part[] = [];
  parts.push({ geometry: box(bench.halfX * 2, 0.06, bench.halfZ * 2), material: "wood", position: [0, top - 0.03, 0] });
  parts.push({ geometry: box(bench.halfX * 2 - 0.1, 0.04, bench.halfZ * 2 - 0.1), material: "woodDark", position: [0, 0.25, 0] });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({ geometry: box(0.07, top, 0.07), material: "woodDark", position: [sx * (bench.halfX - 0.06), top / 2, sz * (bench.halfZ - 0.06)] });
    }
  }
  // A splashboard along the wall.
  parts.push({ geometry: box(0.04, 0.3, bench.halfZ * 2), material: "wood", position: [bench.halfX - 0.02, top + 0.15, 0] });
  // A tray of soil and a trowel.
  parts.push({ geometry: box(0.5, 0.08, 0.7), material: "woodDark", position: [-0.02, top + 0.04, -0.35] });
  parts.push({ geometry: box(0.44, 0.03, 0.64), material: "soil", position: [-0.02, top + 0.075, -0.35] });
  parts.push({ geometry: box(0.05, 0.02, 0.24), material: "metal", position: [-0.12, top + 0.1, -0.2], rotation: [0, 0.5, 0] });
  // A stack of empty pots, and two seed packets.
  for (let k = 0; k < 3; k++) {
    parts.push({ geometry: new THREE.CylinderGeometry(0.11, 0.08, 0.15, 8, 1, true), material: "pot", position: [0.05, top + 0.075 + k * 0.06, 0.45] });
  }
  parts.push({ geometry: box(0.12, 0.01, 0.17), material: "seeds", position: [-0.15, top + 0.005, 0.15], rotation: [0, 0.3, 0] });
  parts.push({ geometry: box(0.12, 0.01, 0.17), material: "seedsB", position: [-0.05, top + 0.012, 0.05], rotation: [0, -0.2, 0] });
  // A sack of compost on the shelf underneath.
  parts.push({ geometry: new THREE.DodecahedronGeometry(0.22, 0), material: "sack", position: [0, 0.45, -0.4] });
  // A seedling in a pot, just planted.
  parts.push({ geometry: new THREE.CylinderGeometry(0.08, 0.06, 0.12, 8), material: "pot", position: [-0.08, top + 0.06, 0.75] });
  parts.push({ geometry: new THREE.IcosahedronGeometry(0.06, 0), material: "leaf", position: [-0.08, top + 0.17, 0.75] });
  return parts;
}

function PottingBench() {
  const meshes = useMergedParts(benchParts, PALETTE, plain);
  const { bench, table, fern, palm } = GREENHOUSE_FURNITURE;
  return (
    <>
      <group position={[bench.x, 0, bench.z]}>
        <PropHover
          tag="The potting bench"
          note="plant something"
          tagAt={[-0.3, 1.55, 0]}
          pool={{ at: [-0.75, 0.02, 0], size: 2.2 }}
          light={[-0.7, 1.4, 0]}
          onSelect={() => usePlantStore.getState().openForm()}
        >
          {meshes}
          <mesh visible={false} position={[0, 0.6, 0]}>
            <boxGeometry args={[bench.halfX * 2 + 0.1, 1.2, bench.halfZ * 2 + 0.1]} />
          </mesh>
        </PropHover>
      </group>
      <Plants table={table} fern={fern} palm={palm} />
    </>
  );
}

/** The table of potted plants in the middle, and the big pots in the front corners. */
function Plants({
  table,
  fern,
  palm,
}: {
  table: (typeof GREENHOUSE_FURNITURE)["table"];
  fern: (typeof GREENHOUSE_FURNITURE)["fern"];
  palm: (typeof GREENHOUSE_FURNITURE)["palm"];
}) {
  const meshes = useMergedParts(
    () => {
      const parts: Part[] = [];
      const top = 0.72;
      parts.push({ geometry: box(table.halfX * 2, 0.05, table.halfZ * 2), material: "wood", position: [table.x, top - 0.025, table.z] });
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          parts.push({ geometry: box(0.06, top, 0.06), material: "woodDark", position: [table.x + sx * (table.halfX - 0.06), top / 2, table.z + sz * (table.halfZ - 0.06)] });
        }
      }
      [-0.45, 0, 0.45].forEach((dx, i) => {
        const x = table.x + dx;
        parts.push({ geometry: new THREE.CylinderGeometry(0.12, 0.09, 0.18, 8), material: "pot", position: [x, top + 0.09, table.z] });
        parts.push({ geometry: new THREE.IcosahedronGeometry(0.16 - i * 0.02, 0), material: i % 2 ? "leafDark" : "leaf", position: [x, top + 0.3, table.z] });
        parts.push({ geometry: new THREE.IcosahedronGeometry(0.1, 0), material: "leaf", position: [x + 0.07, top + 0.42, table.z + 0.03] });
      });
      for (const [p, color] of [
        [fern, "leaf"],
        [palm, "leafDark"],
      ] as const) {
        parts.push({ geometry: new THREE.CylinderGeometry(p.r, p.r * 0.75, 0.42, 9), material: "pot", position: [p.x, 0.21, p.z] });
        parts.push({ geometry: new THREE.IcosahedronGeometry(0.34, 0), material: color, position: [p.x, 0.68, p.z] });
        parts.push({ geometry: new THREE.IcosahedronGeometry(0.24, 0), material: "leaf", position: [p.x + 0.12, 0.92, p.z - 0.05] });
        parts.push({ geometry: new THREE.IcosahedronGeometry(0.2, 0), material: "leafDark", position: [p.x - 0.1, 1.05, p.z + 0.06] });
      }
      // A watering can by the bench.
      parts.push({ geometry: new THREE.CylinderGeometry(0.12, 0.13, 0.24, 8), material: "metal", position: [2.05, 0.12, 1.35] });
      parts.push({ geometry: rod(new THREE.Vector3(1.95, 0.12, 1.35), new THREE.Vector3(1.72, 0.32, 1.35), 0.025, 0.02, 5), material: "metal", position: [0, 0, 0] });
      return parts;
    },
    PALETTE,
    plain,
  );
  return <>{meshes}</>;
}

function TheWayOut() {
  const { z, width, height } = GREENHOUSE_DOOR;
  return (
    <group position={[-W, 0, z]}>
      <WayOut zone="greenhouse" tagAt={[0.3, height + 0.45, 0]} pool={{ at: [0.6, 0.02, 0], size: 1.8 }} light={[0.5, 1.3, 0]}>
        <mesh visible={false} position={[0, height / 2, 0]}>
          <boxGeometry args={[0.3, height, width]} />
        </mesh>
      </WayOut>
    </group>
  );
}
