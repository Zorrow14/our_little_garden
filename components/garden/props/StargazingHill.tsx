"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { withGrowth } from "@/lib/growth";
import { player } from "@/lib/playerInput";
import { night, resetStargazing, toggleStargazing, useStargazing } from "@/lib/stargazing";
import { createRandom, groundHeight, HILL } from "@/lib/terrain";
import { NO_RAYCAST, PropHover } from "./shared";
import Starfield from "./Starfield";

/** How near the top your gardener must be for the stars to come out. */
const ON_HILL = HILL.radius * 0.7;
/** After clicking the hill, starting to walk somewhere brings the garden back (but not the walk you were already on). */
const CLICK_GRACE = 800;

/** A plaid picnic blanket, painted once. */
function blanketTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#c9636f";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "rgba(255,240,225,0.55)";
  for (let i = 0; i < size; i += 16) {
    ctx.fillRect(i, 0, 6, size);
    ctx.fillRect(0, i, size, 6);
  }
  ctx.fillStyle = "rgba(90,30,45,0.25)";
  for (let i = 8; i < size; i += 16) {
    ctx.fillRect(i, 0, 2, size);
    ctx.fillRect(0, i, size, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1.5);
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

/**
 * The stargazing hill: the mound itself is in the terrain (`HILL`); this adds a
 * picnic blanket on top and a ring of pale little flowers, and decides when the
 * stars are out. Standing on the top, or clicking the hill, lets the dusk deepen
 * into full night (see `lib/stargazing`); walking off brings the garden back.
 */
export default function StargazingHill() {
  const by = useStargazing((s) => s.by);
  const top = useMemo(() => groundHeight(HILL.x, HILL.z), []);

  const blanket = useMemo(() => {
    const texture = blanketTexture();
    const material = withGrowth(new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide }));
    return { texture, material };
  }, []);

  // Pale flowers scattered round the brow of the hill, glowing faintly like small stars.
  const blossoms = useMemo(() => {
    const rand = createRandom(61);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 18; i++) {
      const a = rand() * Math.PI * 2;
      const r = HILL.radius * (0.45 + rand() * 0.45);
      const x = HILL.x + Math.cos(a) * r;
      const z = HILL.z + Math.sin(a) * r;
      const g = new THREE.IcosahedronGeometry(0.018 + rand() * 0.012, 0);
      g.translate(x, groundHeight(x, z) + 0.08 + rand() * 0.06, z);
      parts.push(g);
    }
    const geometry = mergeGeometries(parts)!;
    parts.forEach((g) => g.dispose());
    return { geometry, material: new THREE.MeshBasicMaterial({ color: "#aeb8ea" }) };
  }, []);

  useEffect(
    () => () => {
      blanket.texture.dispose();
      blanket.material.dispose();
      blossoms.geometry.dispose();
      blossoms.material.dispose();
      // Leaving the garden: back to the usual dusk for next time.
      resetStargazing();
    },
    [blanket, blossoms],
  );

  useFrame((_, delta) => {
    const onHill = player.active && Math.hypot(player.x - HILL.x, player.z - HILL.z) < ON_HILL;
    // Walking off the hill, or setting off anywhere after clicking it, brings the garden back.
    if (night.onHill && !onHill) night.clicked = false;
    if (night.clicked && !onHill && player.moving && performance.now() - night.clickedAt > CLICK_GRACE) night.clicked = false;
    night.onHill = onHill;
    const wanted = onHill ? "hill" : night.clicked ? "click" : null;
    const state = useStargazing.getState();
    if (state.by !== wanted) useStargazing.setState({ on: wanted !== null, by: wanted });
    // Night falls over a few seconds, and lifts a little quicker.
    night.amount = THREE.MathUtils.damp(night.amount, wanted ? 1 : 0, wanted ? 0.9 : 1.3, delta);
  });

  const note = by === "hill" ? "walk off it to come back" : by === "click" ? "click to come back" : "walk up, or click, to see the stars";

  return (
    <>
      <PropHover
        tag="Stargazing hill"
        note={note}
        tagAt={[HILL.x, top + 1.2, HILL.z]}
        pool={{ at: [HILL.x, top + 0.04, HILL.z], size: HILL.radius * 1.6 }}
        light={[HILL.x, top + 1.4, HILL.z]}
        onSelect={toggleStargazing}
      >
        <mesh material={blanket.material} position={[HILL.x - 0.15, top + 0.025, HILL.z + 0.1]} rotation={[-Math.PI / 2, 0, 0.5]}>
          <planeGeometry args={[1.15, 0.85]} />
        </mesh>
        {/* The top of the hill, for clicking. */}
        <mesh visible={false} position={[HILL.x, top - 0.1, HILL.z]}>
          <cylinderGeometry args={[HILL.radius * 0.75, HILL.radius * 0.9, 0.6, 12]} />
        </mesh>
      </PropHover>
      <mesh geometry={blossoms.geometry} material={blossoms.material} raycast={NO_RAYCAST} />
      <Starfield />
    </>
  );
}
