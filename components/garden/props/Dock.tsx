"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { player } from "@/lib/playerInput";
import { DOCK, DOCK_BENCH_SEAT, DOCK_BENCHES, seatRequest, toWorld } from "@/lib/props";
import { createRandom, WATER_Y } from "@/lib/terrain";
import { getGlowTexture } from "@/lib/textures";
import { box, NO_RAYCAST, type Part, PropHover, useMergedParts } from "./shared";
import { seatNote } from "./Swing";

const PALETTE = { deck: "#8a6a52", deckLight: "#977660", post: "#5e4838", bench: "#a0805f", lamp: "#3a3330" };
const PLANK = 0.15;
const GAP = 0.025;
/** How far down the posts go, into the mud at the bottom of the pond. */
const POST_FOOT = -0.62;

/** Every board, post and bench, in the dock's own space (origin on the bank, out over the water toward +z). */
function dockParts(): Part[] {
  const parts: Part[] = [];
  const rand = createRandom(51);
  const top = DOCK.deckY;

  // Boards laid across, a little uneven, wider at the end.
  for (let z = -0.15 + PLANK / 2; z < DOCK.length; z += PLANK + GAP) {
    const width = z > DOCK.length - DOCK.platformDepth ? DOCK.platformWidth : DOCK.width;
    parts.push({
      geometry: box(width + (rand() - 0.5) * 0.05, 0.045, PLANK),
      material: rand() < 0.5 ? "deck" : "deckLight",
      position: [(rand() - 0.5) * 0.02, top - 0.0225 - rand() * 0.008, z],
      rotation: [0, (rand() - 0.5) * 0.03, 0],
    });
  }
  // Two beams under the boards, and posts down into the water.
  for (const side of [-1, 1]) {
    parts.push({ geometry: box(0.06, 0.07, DOCK.length + 0.1), material: "post", position: [side * (DOCK.width / 2 - 0.06), top - 0.08, DOCK.length / 2 - 0.1] });
    for (const z of [0.05, 0.75, DOCK.length - DOCK.platformDepth + 0.05, DOCK.length - 0.05]) {
      const x = z > DOCK.length - DOCK.platformDepth ? DOCK.platformWidth / 2 - 0.05 : DOCK.width / 2 - 0.02;
      const height = top + 0.12 - POST_FOOT;
      parts.push({ geometry: new THREE.CylinderGeometry(0.045, 0.05, height, 6), material: "post", position: [side * x, POST_FOOT + height / 2, z] });
    }
  }
  // A cross beam under the platform.
  parts.push({ geometry: box(DOCK.platformWidth - 0.04, 0.07, 0.07), material: "post", position: [0, top - 0.08, DOCK.length - DOCK.platformDepth + 0.05] });

  // Two simple benches at the end, looking out over the water.
  for (const b of DOCK_BENCHES) {
    const seatY = top + DOCK_BENCH_SEAT;
    parts.push({ geometry: box(0.56, 0.045, 0.26), material: "bench", position: [b.x, seatY - 0.0225, b.z] });
    for (const lx of [-0.22, 0.22]) {
      parts.push({ geometry: box(0.05, DOCK_BENCH_SEAT - 0.04, 0.2), material: "post", position: [b.x + lx, top + (DOCK_BENCH_SEAT - 0.04) / 2, b.z] });
    }
  }

  // A lamp post at the far corner.
  parts.push({ geometry: box(0.06, 0.95, 0.06), material: "post", position: [DOCK.platformWidth / 2 - 0.06, top + 0.47, DOCK.length - 0.06] });
  parts.push({ geometry: box(0.2, 0.03, 0.03), material: "post", position: [DOCK.platformWidth / 2 - 0.12, top + 0.93, DOCK.length - 0.06] });
  parts.push({ geometry: box(0.1, 0.03, 0.1), material: "lamp", position: [DOCK.platformWidth / 2 - 0.2, top + 0.83, DOCK.length - 0.06] });
  return parts;
}

/**
 * A wooden dock out from the pond's west bank, with two benches at the end
 * facing the water and the lotus, and a lantern hung on a post. Clicking the
 * benches sits you down, as the swing does.
 */
export default function Dock() {
  const meshes = useMergedParts(dockParts, PALETTE);

  const lantern = useRef<THREE.SpriteMaterial>(null!);
  const lanternAt = useMemo(() => toWorld(DOCK, DOCK.platformWidth / 2 - 0.2, DOCK.length - 0.06), []);
  const end = useMemo(() => toWorld(DOCK, 0, DOCK.length - 0.35), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    lantern.current.opacity = 0.6 + Math.sin(t * 6.1) * 0.04 + Math.sin(t * 2.3) * 0.05;
  });

  return (
    <>
      <group position={[DOCK.x, 0, DOCK.z]} rotation-y={DOCK.yaw}>
        <PropHover
          tag="The end of the dock"
          note={() => seatNote("dock")}
          tagAt={[0, DOCK.deckY + 1.1, DOCK.length - 0.3]}
          pool={{ at: [0, DOCK.deckY + 0.01, DOCK.length - 0.4], size: 2 }}
          light={[0, DOCK.deckY + 1, DOCK.length - 0.6]}
          onSelect={() => {
            if (player.active) seatRequest.prop = "dock";
          }}
        >
          {meshes}
          {/* Clicking anywhere about the benches. */}
          <mesh visible={false} position={[0, DOCK.deckY + 0.3, DOCK.length - 0.4]}>
            <boxGeometry args={[DOCK.platformWidth, 0.6, 0.9]} />
          </mesh>
        </PropHover>
      </group>
      {/* The lantern's glow, and a warm patch of it on the water. */}
      <sprite position={[lanternAt.x, DOCK.deckY + 0.76, lanternAt.z]} scale={0.55} raycast={NO_RAYCAST}>
        <spriteMaterial ref={lantern} map={getGlowTexture()} color="#ffc978" transparent depthWrite={false} />
      </sprite>
      <mesh position={[end.x, WATER_Y + 0.01, end.z]} rotation-x={-Math.PI / 2} raycast={NO_RAYCAST}>
        <planeGeometry args={[2.2, 2.2]} />
        <meshBasicMaterial map={getGlowTexture()} color="#ffb35c" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  );
}
