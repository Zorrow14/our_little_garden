"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { openKeepsake } from "@/lib/keepsakes";
import { arrivalHint, useMail, useWaitingMail } from "@/lib/mailbox";
import { usePresence } from "@/lib/presence";
import { MAILBOX } from "@/lib/props";
import { groundHeight } from "@/lib/terrain";
import { getGlowTexture } from "@/lib/textures";
import { box, matte, NO_RAYCAST, type Part, PropHover, useMergedParts } from "./shared";

const PALETTE = { post: "#7a6553", body: "#4f7c86", trim: "#3c5f68", brass: "#d8b25a" };
const POST = 0.95;
const W = 0.26;
const L = 0.42;
const H = 0.2;

/** The box on its post, in its own space: door toward +z, flag on the side toward the garden (-x). */
function mailboxParts(): Part[] {
  const roof = new THREE.CylinderGeometry(W / 2, W / 2, L, 10, 1, false, 0, Math.PI);
  return [
    { geometry: box(0.09, POST, 0.09), material: "post", position: [0, POST / 2 - 0.05, 0] },
    { geometry: box(0.16, 0.05, 0.3), material: "post", position: [0, POST - 0.06, 0] },
    { geometry: box(W, H, L), material: "body", position: [0, POST + H / 2, 0] },
    // The rounded top: half a cylinder lying along the box.
    { geometry: roof, material: "body", position: [0, POST + H, 0], rotation: [Math.PI / 2, Math.PI / 2, 0] },
    // The door, with a little brass knob.
    { geometry: box(W + 0.02, H + 0.11, 0.025), material: "trim", position: [0, POST + H / 2 + 0.04, L / 2 + 0.006] },
    { geometry: new THREE.SphereGeometry(0.02, 6, 4), material: "brass", position: [0, POST + H / 2 + 0.08, L / 2 + 0.03] },
  ];
}

/**
 * The mailbox by the gate. Its flag goes up while a letter is on its way, with
 * a little twinkle over it when the letter's coming to you; once it has
 * arrived an envelope peeks out of the door and it glows warm. Clicking it
 * opens the mailbox (in the UI layer).
 */
export default function Mailbox() {
  const meshes = useMergedParts(mailboxParts, PALETTE);
  const me = usePresence((s) => s.me);
  const transit = useMail((s) => s.transit);
  const waiting = useWaitingMail();
  const coming = transit.find((t) => t.author !== me) ?? null;
  const flagUp = transit.length > 0;

  const ground = useMemo(() => groundHeight(MAILBOX.x, MAILBOX.z), []);
  const flag = useRef<THREE.Group>(null!);
  const twinkle = useRef<THREE.SpriteMaterial>(null!);
  const glow = useRef<THREE.SpriteMaterial>(null!);
  const flagMaterials = useMemo(() => ({ arm: matte("#3c5f68"), flag: matte("#e2738f") }), []);
  const envelope = useMemo(() => matte("#f6efe2"), []);
  useEffect(
    () => () => {
      [flagMaterials.arm, flagMaterials.flag, envelope].forEach((m) => m.dispose());
    },
    [flagMaterials, envelope],
  );

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    // Lowered, the flag lies back along the box; raised, it stands up.
    flag.current.rotation.x = THREE.MathUtils.damp(flag.current.rotation.x, flagUp ? 0 : -Math.PI / 2, 4, delta);
    twinkle.current.opacity = coming && !waiting ? 0.45 + Math.sin(t * 2.6) * 0.3 : 0;
    const warm = waiting ? 0.75 + Math.sin(t * 2) * 0.2 : 0;
    glow.current.opacity = warm * 0.75;
  });

  const note = waiting
    ? waiting > 1
      ? `${waiting} letters for you!`
      : "There's a letter for you!"
    : coming
      ? `Something's coming… ${arrivalHint(coming.deliver_at)}`
      : "leave a letter";

  return (
    <group position={[MAILBOX.x, ground, MAILBOX.z]} rotation-y={MAILBOX.yaw}>
      <PropHover
        tag="The mailbox"
        note={note}
        tagAt={[0, POST + 0.75, 0]}
        pool={{ at: [0, 0.03, 0.1], size: 1.6 }}
        light={[0, POST + 0.5, 0.6]}
        onSelect={() => openKeepsake("mailbox")}
      >
        {meshes}
        <group ref={flag} position={[-W / 2 - 0.015, POST + 0.06, -0.12]} rotation-x={-Math.PI / 2}>
          <mesh material={flagMaterials.arm} position-y={0.13}>
            <boxGeometry args={[0.018, 0.26, 0.025]} />
          </mesh>
          <mesh material={flagMaterials.flag} position={[-0.005, 0.22, 0.05]}>
            <boxGeometry args={[0.012, 0.075, 0.1]} />
          </mesh>
        </group>
        {waiting > 0 && (
          <mesh material={envelope} position={[0, POST + H + 0.02, L / 2 + 0.03]} rotation={[0.35, 0, 0.12]}>
            <boxGeometry args={[0.17, 0.11, 0.01]} />
          </mesh>
        )}
        {/* Bigger than it looks, so it's easy to click from afar. */}
        <mesh visible={false} position-y={POST * 0.7}>
          <boxGeometry args={[0.5, POST * 1.4 + 0.3, 0.6]} />
        </mesh>
      </PropHover>
      <sprite position={[0, POST + 0.55, 0]} scale={0.32} raycast={NO_RAYCAST}>
        <spriteMaterial ref={twinkle} map={getGlowTexture()} color="#fff1c2" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite position={[0, POST + H, L / 2 + 0.1]} scale={0.9} raycast={NO_RAYCAST}>
        <spriteMaterial ref={glow} map={getGlowTexture()} color="#ffc978" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}
