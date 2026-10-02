"use client";

import { Html, OrbitControls, useCursor } from "@react-three/drei";
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import FlowerTag from "@/components/ui/FlowerTag";
import { useGardenStore } from "@/lib/gardenStore";
import { FURNITURE, HOUSE_DOOR, HOUSE_WINDOW, ROOM } from "@/lib/house";
import { player } from "@/lib/playerInput";
import { getGlowTexture } from "@/lib/textures";
import { useZone } from "@/lib/zones";
import { takeExit } from "./registry";

const { halfWidth: W, halfDepth: D, height: H } = ROOM;

const COLORS = {
  plaster: "#e7d3b5",
  wainscot: "#b88a68",
  trim: "#6e4c36",
  floorA: "#8b5e3f",
  floorB: "#7d5337",
  wood: "#6b4630",
  woodLight: "#9a6a47",
  linen: "#efe6d6",
  blanket: "#d77f93",
  pillow: "#f7efe4",
  rug: "#a9566a",
  rugInner: "#d79a73",
  terracotta: "#b8643f",
  leaf: "#4f8a55",
  leafDark: "#3b6d45",
  brass: "#d8b25a",
  curtain: "#c4697f",
  books: ["#a8463f", "#4e6d9a", "#d0a14a", "#5e8a63", "#8b5b8f", "#c9764f"],
};
const WARM = "#ffb35c";
const MOONLIGHT = "#9fb2ff";

type ColorKey = Exclude<keyof typeof COLORS, "books">;

/**
 * Inside the cottage: one cosy room, seen dollhouse-style from outside. The walls
 * are inward-facing planes, so the two nearest the camera are see-through.
 */
export default function HouseZone() {
  const m = useMaterials();
  return (
    <>
      <color attach="background" args={["#0a0d1e"]} />
      <HouseLights />
      <Room m={m} />
      <Furniture m={m} />
      <HouseDoor m={m} />
      <HouseCamera />
    </>
  );
}

type Materials = Record<ColorKey, THREE.MeshLambertMaterial>;

function useMaterials() {
  const materials = useMemo(() => {
    const all = {} as Materials;
    for (const [key, color] of Object.entries(COLORS)) {
      if (typeof color === "string") all[key as ColorKey] = new THREE.MeshLambertMaterial({ color, flatShading: true });
    }
    return all;
  }, []);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  return materials;
}

function HouseLights() {
  const candle = useRef<THREE.PointLight>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    candle.current.intensity = 2.2 + Math.sin(t * 7.3) * 0.18 + Math.sin(t * 3.1) * 0.22;
  });
  return (
    <>
      <hemisphereLight args={["#ffe3c2", "#3a2a22", 0.95]} />
      {/* Moonlight in through the window. */}
      <directionalLight position={[HOUSE_WINDOW.x + 1, 4, -8]} color={MOONLIGHT} intensity={0.55} />
      <pointLight position={[FURNITURE.lamp.x, 1.5, FURNITURE.lamp.z + 0.1]} color={WARM} intensity={9} decay={1.6} />
      <pointLight ref={candle} position={[FURNITURE.table.x, 1.05, FURNITURE.table.z]} color="#ffcf80" intensity={2.2} decay={1.8} />
    </>
  );
}

/** One wall, as a plane facing into the room. `holes` leave gaps for the window and door. */
interface WallSpec {
  /** Where the wall's left edge (seen from inside) starts, its length, and how it's turned. */
  position: [number, number, number];
  rotation: number;
  length: number;
  holes?: { from: number; to: number; bottom: number; top: number }[];
}

const WALLS: WallSpec[] = [
  {
    // Back wall, with the window.
    position: [-W, 0, -D],
    rotation: 0,
    length: W * 2,
    holes: [
      {
        from: HOUSE_WINDOW.x - HOUSE_WINDOW.width / 2 + W,
        to: HOUSE_WINDOW.x + HOUSE_WINDOW.width / 2 + W,
        bottom: HOUSE_WINDOW.y - HOUSE_WINDOW.height / 2,
        top: HOUSE_WINDOW.y + HOUSE_WINDOW.height / 2,
      },
    ],
  },
  {
    // Left wall, with the door.
    position: [-W, 0, D],
    rotation: Math.PI / 2,
    length: D * 2,
    holes: [{ from: D - HOUSE_DOOR.z - HOUSE_DOOR.width / 2, to: D - HOUSE_DOOR.z + HOUSE_DOOR.width / 2, bottom: 0, top: HOUSE_DOOR.height }],
  },
  // Right and front walls: only ever seen from inside, so they vanish from the camera's side.
  { position: [W, 0, -D], rotation: -Math.PI / 2, length: D * 2 },
  { position: [W, 0, D], rotation: Math.PI, length: W * 2 },
];

/** Rectangles covering a wall of `length` × `height` around its holes, in the wall's own 2D space. */
function wallPanels(length: number, height: number, holes: WallSpec["holes"] = []) {
  const panels: { x: number; y: number; w: number; h: number }[] = [];
  const cuts = [...holes].sort((a, b) => a.from - b.from);
  let x = 0;
  for (const hole of cuts) {
    if (hole.from > x) panels.push({ x, y: 0, w: hole.from - x, h: height });
    if (hole.bottom > 0) panels.push({ x: hole.from, y: 0, w: hole.to - hole.from, h: hole.bottom });
    if (hole.top < height) panels.push({ x: hole.from, y: hole.top, w: hole.to - hole.from, h: height - hole.top });
    x = hole.to;
  }
  if (x < length) panels.push({ x, y: 0, w: length - x, h: height });
  return panels;
}

const WAINSCOT = 0.72;

function Room({ m }: { m: Materials }) {
  const planks = useMemo(() => {
    const count = 12;
    const width = (D * 2) / count;
    return Array.from({ length: count }, (_, i) => ({ z: -D + width * (i + 0.5), width, shade: i % 2 ? m.floorA : m.floorB }));
  }, [m]);

  return (
    <>
      {/* Floorboards, on a slab that shows as the floor's edge from outside. */}
      {planks.map((p) => (
        <mesh key={p.z} material={p.shade} position={[0, -0.06, p.z]}>
          <boxGeometry args={[W * 2, 0.12, p.width - 0.012]} />
        </mesh>
      ))}
      <mesh material={m.trim} position={[0, -0.2, 0]}>
        <boxGeometry args={[W * 2 + 0.06, 0.16, D * 2 + 0.06]} />
      </mesh>

      {WALLS.map((wall, i) => (
        <group key={i} position={wall.position} rotation-y={wall.rotation}>
          {wallPanels(wall.length, H, wall.holes).map((p, j) => (
            <mesh key={j} material={m.plaster} position={[p.x + p.w / 2, p.y + p.h / 2, 0]}>
              <planeGeometry args={[p.w, p.h]} />
            </mesh>
          ))}
          {/* Panelling along the bottom, and a rail along its top. */}
          {wallPanels(wall.length, WAINSCOT, wall.holes?.filter((h) => h.bottom < WAINSCOT)).map((p, j) => (
            <mesh key={`w${j}`} material={m.wainscot} position={[p.x + p.w / 2, p.y + p.h / 2, 0.004]}>
              <planeGeometry args={[p.w, p.h]} />
            </mesh>
          ))}
          {i < 2 &&
            wallPanels(wall.length, WAINSCOT + 0.05, wall.holes?.filter((h) => h.bottom < WAINSCOT))
              .filter((p) => p.y === 0)
              .map((p, j) => (
                <mesh key={`r${j}`} material={m.trim} position={[p.x + p.w / 2, WAINSCOT, 0.02]}>
                  <boxGeometry args={[p.w, 0.05, 0.04]} />
                </mesh>
              ))}
        </group>
      ))}

      <Window m={m} />
    </>
  );
}

function Window({ m }: { m: Materials }) {
  const { x, y, width, height } = HOUSE_WINDOW;
  const z = -D;
  return (
    <group position={[x, y, z]}>
      {/* The night outside, and a moon glow on the glass. */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#1d2a5c" />
      </mesh>
      <sprite position={[0.22, 0.15, -0.01]} scale={0.55}>
        <spriteMaterial map={getGlowTexture()} color="#e8ecff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {/* Frame and glazing bars. */}
      {[
        [0, height / 2 + 0.03, width + 0.12, 0.06],
        [0, -height / 2 - 0.03, width + 0.12, 0.06],
        [-width / 2 - 0.03, 0, 0.06, height],
        [width / 2 + 0.03, 0, 0.06, height],
        [0, 0, 0.04, height],
        [0, 0, width, 0.04],
      ].map(([bx, by, bw, bh], i) => (
        <mesh key={i} material={m.trim} position={[bx, by, 0.02]}>
          <boxGeometry args={[bw, bh, 0.05]} />
        </mesh>
      ))}
      <mesh material={m.woodLight} position={[0, -height / 2 - 0.08, 0.08]}>
        <boxGeometry args={[width + 0.24, 0.05, 0.18]} />
      </mesh>
      {/* Curtains drawn to either side. */}
      {[-1, 1].map((side) => (
        <mesh key={side} material={m.curtain} position={[side * (width / 2 + 0.2), -0.05, 0.08]}>
          <boxGeometry args={[0.24, height + 0.35, 0.06]} />
        </mesh>
      ))}
      <mesh material={m.trim} position={[0, height / 2 + 0.22, 0.1]}>
        <boxGeometry args={[width + 0.75, 0.035, 0.035]} />
      </mesh>
      {/* Moonlight pooling on the floor. */}
      <mesh position={[0.1, -y + 0.012, 1.15]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.5, 1.9]} />
        <meshBasicMaterial map={getGlowTexture()} color={MOONLIGHT} transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function Furniture({ m }: { m: Materials }) {
  const { bed, table, stoolLeft, stoolRight, plant, shelf, lamp } = FURNITURE;
  const books = useMemo(() => {
    const list: { x: number; y: number; w: number; h: number; color: string }[] = [];
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const y of [0.18, 0.66, 1.14]) {
      let x = -shelf.halfX + 0.08;
      while (x < shelf.halfX - 0.16) {
        const w = 0.06 + rand() * 0.05;
        const h = 0.26 + rand() * 0.12;
        list.push({ x: x + w / 2, y: y + h / 2, w, h, color: COLORS.books[Math.floor(rand() * COLORS.books.length)] });
        x += w + 0.012;
        if (rand() < 0.12) x += 0.14;
      }
    }
    return list;
  }, [shelf.halfX]);
  const bookMaterials = useMemo(() => new Map(COLORS.books.map((c) => [c, new THREE.MeshLambertMaterial({ color: c, flatShading: true })])), []);
  useEffect(() => () => bookMaterials.forEach((mat) => mat.dispose()), [bookMaterials]);

  return (
    <>
      {/* The bed, head against the back wall. */}
      <group position={[bed.x, 0, bed.z]}>
        <mesh material={m.wood} position={[0, 0.17, 0]}>
          <boxGeometry args={[bed.halfX * 2, 0.26, bed.halfZ * 2]} />
        </mesh>
        <mesh material={m.wood} position={[0, 0.5, -bed.halfZ + 0.04]}>
          <boxGeometry args={[bed.halfX * 2 + 0.06, 1, 0.08]} />
        </mesh>
        <mesh material={m.linen} position={[0, 0.37, 0.02]}>
          <boxGeometry args={[bed.halfX * 2 - 0.08, 0.16, bed.halfZ * 2 - 0.1]} />
        </mesh>
        <mesh material={m.blanket} position={[0, 0.47, 0.32]}>
          <boxGeometry args={[bed.halfX * 2 - 0.02, 0.07, bed.halfZ * 2 - 0.62]} />
        </mesh>
        <mesh material={m.pillow} position={[0, 0.52, -bed.halfZ + 0.34]} rotation-x={-0.18}>
          <boxGeometry args={[bed.halfX * 2 - 0.36, 0.13, 0.36]} />
        </mesh>
      </group>

      {/* A round rug, the table and two stools. */}
      <mesh material={m.rug} position={[table.x, 0.012, table.z + 0.05]} scale={[1.35, 1, 1.05]}>
        <cylinderGeometry args={[1, 1, 0.02, 20]} />
      </mesh>
      <mesh material={m.rugInner} position={[table.x, 0.024, table.z + 0.05]} scale={[1.35, 1, 1.05]}>
        <cylinderGeometry args={[0.72, 0.72, 0.01, 20]} />
      </mesh>
      <group position={[table.x, 0, table.z]}>
        <mesh material={m.woodLight} position={[0, 0.64, 0]}>
          <cylinderGeometry args={[table.r, table.r, 0.06, 14]} />
        </mesh>
        <mesh material={m.wood} position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.06, 0.08, 0.62, 7]} />
        </mesh>
        <mesh material={m.wood} position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.28, 0.3, 0.05, 10]} />
        </mesh>
        {/* A candle, and a little vase of flowers from the garden. */}
        <mesh material={m.linen} position={[0.12, 0.74, 0.08]}>
          <cylinderGeometry args={[0.035, 0.035, 0.14, 8]} />
        </mesh>
        <sprite position={[0.12, 0.86, 0.08]} scale={0.32}>
          <spriteMaterial map={getGlowTexture()} color="#ffd38a" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
        <mesh material={m.terracotta} position={[-0.18, 0.74, -0.1]}>
          <cylinderGeometry args={[0.05, 0.065, 0.14, 8]} />
        </mesh>
        {[
          [-0.2, 0.9, -0.08, COLORS.blanket],
          [-0.14, 0.87, -0.13, COLORS.brass],
          [-0.22, 0.86, -0.15, COLORS.curtain],
        ].map(([bx, by, bz, color], i) => (
          <mesh key={i} position={[bx as number, by as number, bz as number]}>
            <icosahedronGeometry args={[0.045, 0]} />
            <meshLambertMaterial color={color as string} flatShading />
          </mesh>
        ))}
      </group>
      {[stoolLeft, stoolRight].map((stool, i) => (
        <group key={i} position={[stool.x, 0, stool.z]}>
          <mesh material={m.woodLight} position={[0, 0.38, 0]}>
            <cylinderGeometry args={[stool.r, stool.r, 0.06, 10]} />
          </mesh>
          <mesh material={m.wood} position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.045, 0.06, 0.36, 6]} />
          </mesh>
        </group>
      ))}

      {/* A potted plant in the corner. */}
      <group position={[plant.x, 0, plant.z]}>
        <mesh material={m.terracotta} position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.26, 0.19, 0.4, 9]} />
        </mesh>
        {[
          [0, 0.62, 0, 0.26],
          [0.16, 0.78, 0.06, 0.2],
          [-0.14, 0.82, -0.04, 0.22],
          [0.04, 0.98, -0.1, 0.18],
          [-0.06, 1.1, 0.08, 0.15],
        ].map(([lx, ly, lz, r], i) => (
          <mesh key={i} material={i % 2 ? m.leafDark : m.leaf} position={[lx, ly, lz]} scale={[1, 0.8, 1]}>
            <icosahedronGeometry args={[r, 0]} />
          </mesh>
        ))}
      </group>

      {/* A bookshelf against the back wall. */}
      <group position={[shelf.x, 0, shelf.z]}>
        {[0, 0.48, 0.96, 1.44].map((y) => (
          <mesh key={y} material={m.wood} position={[0, y + 0.13, 0]}>
            <boxGeometry args={[shelf.halfX * 2, 0.05, shelf.halfZ * 2]} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={side} material={m.wood} position={[side * (shelf.halfX - 0.025), 0.8, 0]}>
            <boxGeometry args={[0.05, 1.6, shelf.halfZ * 2]} />
          </mesh>
        ))}
        {books.map((b, i) => (
          <mesh key={i} material={bookMaterials.get(b.color)} position={[b.x, b.y, 0.02]}>
            <boxGeometry args={[b.w, b.h, shelf.halfZ * 2 - 0.08]} />
          </mesh>
        ))}
      </group>

      {/* A standing lamp by the bed. */}
      <group position={[lamp.x, 0, lamp.z]}>
        <mesh material={m.wood} position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.17, 0.19, 0.06, 10]} />
        </mesh>
        <mesh material={m.brass} position={[0, 0.72, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 1.4, 6]} />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.13, 0.24, 0.3, 10, 1, true]} />
          <meshBasicMaterial color="#ffd9a0" side={THREE.DoubleSide} />
        </mesh>
        <sprite position={[0, 1.45, 0]} scale={1.3}>
          <spriteMaterial map={getGlowTexture()} color={WARM} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
    </>
  );
}

/** Seconds for the door to swing open or shut. */
const DOOR_SWING = 0.5;

/** The front door, from inside. Walk into it or click it to go back out to the garden. */
function HouseDoor({ m }: { m: Materials }) {
  const hinge = useRef<THREE.Group>(null!);
  const swing = useRef(0);
  const interactive = useGardenStore((s) => s.stage === "garden" && !s.activeId && !s.celebrating);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && interactive);

  useFrame((_, delta) => {
    const near = player.active && Math.hypot(player.x - HOUSE_DOOR.x, player.z - HOUSE_DOOR.z) < 1.1;
    const open = near || useZone.getState().leaving !== null;
    swing.current = THREE.MathUtils.clamp(swing.current + (open ? 1 : -1) * (delta / DOOR_SWING), 0, 1);
    const eased = swing.current * swing.current * (3 - 2 * swing.current);
    hinge.current.rotation.y = eased * 1.5;
  });

  const leave = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive || e.delta > 8) return;
    e.stopPropagation();
    takeExit("house", "front-door");
  };

  const { z, width, height } = HOUSE_DOOR;
  const x = HOUSE_DOOR.x;
  return (
    <group position={[x, 0, z]}>
      {/* Darkness beyond the doorway when it opens. */}
      <mesh position={[-0.02, height / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#141a33" />
      </mesh>
      {/* The frame. */}
      {[
        [0, height + 0.04, 0, width + 0.16, 0.08],
        [0, height / 2, -width / 2 - 0.04, 0.08, height],
        [0, height / 2, width / 2 + 0.04, 0.08, height],
      ].map(([fx, fy, fz, fw, fh], i) => (
        <mesh key={i} material={m.trim} position={[fx + 0.03, fy, fz]} rotation-y={Math.PI / 2}>
          <boxGeometry args={[fw, fh, 0.06]} />
        </mesh>
      ))}
      {/* The door swings into the room on hinges at its far (back-wall) edge. */}
      <group ref={hinge} position={[0.04, 0, -width / 2]}>
        <mesh
          material={m.wood}
          position={[0, height / 2, width / 2]}
          onPointerOver={(e) => {
            if (!interactive) return;
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
          onClick={leave}
        >
          <boxGeometry args={[0.05, height - 0.02, width - 0.03]} />
        </mesh>
        <mesh material={m.brass} position={[0.04, height * 0.48, width - 0.12]}>
          <sphereGeometry args={[0.03, 6, 5]} />
        </mesh>
      </group>
      {hovered && interactive && (
        <Html position={[0.3, height + 0.35, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <FlowerTag text="Out to the garden" />
        </Html>
      )}
    </group>
  );
}

/** Tall phone screens back the camera off so the whole room still fits. */
function portraitPull(aspect: number) {
  return aspect >= 1 ? 1 : THREE.MathUtils.lerp(1.55, 1, THREE.MathUtils.clamp((aspect - 0.45) / 0.55, 0, 1));
}

const TARGET = new THREE.Vector3(0.1, 0.55, -0.15);

/** A dollhouse view from the open corner of the room, free to turn a little either way. */
function HouseCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const controls = useRef<OrbitControlsImpl>(null!);
  const pull = portraitPull(aspect);

  useLayoutEffect(() => {
    camera.fov = aspect >= 1 ? 45 : THREE.MathUtils.lerp(58, 45, THREE.MathUtils.clamp((aspect - 0.45) / 0.55, 0, 1));
    camera.updateProjectionMatrix();
    // Placed afresh on arrival; after that it's wherever she's turned it.
    if (controls.current.target.equals(TARGET)) return;
    const offset = new THREE.Vector3().setFromSphericalCoords(8.4 * pull, 0.98, 0.62);
    camera.position.copy(TARGET).add(offset);
    controls.current.target.copy(TARGET);
    camera.lookAt(TARGET);
    controls.current.update();
  }, [camera, aspect, pull]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={0.7}
      minDistance={5}
      maxDistance={11.5 * pull}
      minPolarAngle={0.55}
      maxPolarAngle={1.22}
      minAzimuthAngle={0.08}
      maxAzimuthAngle={1.2}
    />
  );
}
