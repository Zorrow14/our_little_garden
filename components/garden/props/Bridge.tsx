"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { type BridgeSpan, deckAt } from "@/lib/bridge";
import { getGlowTexture } from "@/lib/textures";
import { box, NO_RAYCAST, type Part, PropHover, useMergedParts } from "./shared";

const PALETTE = { plank: "#8a6a52", plankLight: "#977660", beam: "#5e4838", stone: "#7a756d", stoneDark: "#67625b" };
const RAIL_X = 0.47;
const RAIL_HEIGHT = 0.58;

/** The slope of the boards `lz` along, as a turn about the bridge's x axis. */
function tilt(b: BridgeSpan, lz: number) {
  return -Math.atan((deckAt(b, lz + 0.01) - deckAt(b, lz - 0.01)) / 0.02);
}

/** A run of `pieces` boxes following the arch from `from` to `to`, `above` the boards, `x` out from the middle. */
function along(b: BridgeSpan, parts: Part[], from: number, to: number, pieces: number, x: number, above: number, size: [number, number], material: string) {
  for (let k = 0; k < pieces; k++) {
    const z0 = from + ((to - from) * k) / pieces;
    const z1 = from + ((to - from) * (k + 1)) / pieces;
    const y0 = deckAt(b, z0) + above;
    const y1 = deckAt(b, z1) + above;
    const length = Math.hypot(z1 - z0, y1 - y0) + 0.02;
    parts.push({
      geometry: box(size[0], size[1], length),
      material,
      position: [x, (y0 + y1) / 2, (z0 + z1) / 2],
      rotation: [-Math.atan2(y1 - y0, z1 - z0), 0, 0],
    });
  }
}

function bridgeParts(b: BridgeSpan): Part[] {
  const parts: Part[] = [];
  // Boards laid across, following the arch.
  let i = 0;
  for (let z = 0.08; z < b.length; z += 0.17, i++) {
    parts.push({
      geometry: box(b.width - (i % 3) * 0.03, 0.045, 0.145),
      material: i % 2 ? "plank" : "plankLight",
      position: [((i * 7) % 3) * 0.008 - 0.008, deckAt(b, z) - 0.0225, z],
      rotation: [tilt(b, z), 0, 0],
    });
  }
  // Beams under each edge, and handrails on posts above them.
  for (const side of [-1, 1]) {
    along(b, parts, 0, b.length, 10, side * (b.width / 2 - 0.08), -0.08, [0.08, 0.1], "beam");
    along(b, parts, 0.1, b.length - 0.1, 10, side * RAIL_X, RAIL_HEIGHT, [0.06, 0.06], "beam");
    for (const z of [0.1, b.length / 3, (b.length * 2) / 3, b.length - 0.1]) {
      parts.push({ geometry: box(0.07, RAIL_HEIGHT + 0.06, 0.07), material: "beam", position: [side * RAIL_X, deckAt(b, z) + RAIL_HEIGHT / 2, z] });
    }
  }
  // Stone footings on each bank, deep enough to meet the ground going down into the brook.
  for (const z of [0.18, b.length - 0.18]) {
    const top = deckAt(b, z) - 0.06;
    parts.push({ geometry: box(b.width + 0.3, 0.9, 0.5), material: "stone", position: [0, top - 0.45, z] });
    parts.push({ geometry: box(b.width + 0.4, 0.1, 0.58), material: "stoneDark", position: [0, top - 0.02, z] });
  }
  return parts;
}

/**
 * A wooden footbridge on stone footings, arched over a brook, with a lantern
 * at each corner of its near end. Walking onto its far end (or clicking it)
 * crosses to the other side: the garden's and the far garden's are the two
 * ends of the same crossing.
 */
export default function Bridge({ span, tag, note, onSelect }: { span: BridgeSpan; tag: string; note: string; onSelect: () => void }) {
  const meshes = useMergedParts(() => bridgeParts(span), PALETTE);
  const lanterns = useRef<THREE.SpriteMaterial[]>([]);
  const middle = useMemo(() => deckAt(span, span.length / 2), [span]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    lanterns.current.forEach((m, i) => {
      m.opacity = 0.6 + Math.sin(t * 5.3 + i * 2) * 0.05 + Math.sin(t * 2.1 + i) * 0.05;
    });
  });

  return (
    <group position={[span.x, 0, span.z]} rotation-y={span.yaw}>
      <PropHover
        tag={tag}
        note={note}
        tagAt={[0, middle + 1.2, span.length / 2]}
        pool={{ at: [0, middle + 0.02, span.length / 2], size: 3 }}
        light={[0, middle + 1, span.length / 2]}
        onSelect={onSelect}
      >
        {meshes}
        {/* The whole span, for clicking. */}
        <mesh visible={false} position={[0, middle + 0.2, span.length / 2]}>
          <boxGeometry args={[span.width + 0.2, 0.9, span.length]} />
        </mesh>
      </PropHover>
      {[-1, 1].map((side, i) => (
        <sprite key={side} position={[side * RAIL_X, deckAt(span, 0.1) + RAIL_HEIGHT + 0.12, 0.1]} scale={0.45} raycast={NO_RAYCAST}>
          <spriteMaterial
            ref={(m) => {
              if (m) lanterns.current[i] = m;
            }}
            map={getGlowTexture()}
            color="#ffc978"
            transparent
            depthWrite={false}
          />
        </sprite>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * RAIL_X, deckAt(span, 0.1) + RAIL_HEIGHT + 0.1, 0.1]} raycast={NO_RAYCAST}>
          <boxGeometry args={[0.1, 0.12, 0.1]} />
          <meshBasicMaterial color="#ffd59a" />
        </mesh>
      ))}
    </group>
  );
}
