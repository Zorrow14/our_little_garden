"use client";

import { useEffect } from "react";
import * as THREE from "three";
import FlowerTag from "@/components/ui/FlowerTag";
import { memories } from "@/data/memories";
import { bloomedIds, FINAL_ID, isFinalUnlocked, useGardenStore } from "@/lib/gardenStore";
import { FLOWER_SPECS } from "@/lib/flowerSpecs";
import { FLOWER_SPOTS, flowerAnchors } from "@/lib/layout";
import { groundHeight, WATER_Y } from "@/lib/terrain";
import Flower, { type FlowerStatus } from "./Flower";

const placements = memories.map((memory) => {
  const spec = FLOWER_SPECS[memory.flower];
  const spot = FLOWER_SPOTS[memory.flower];
  const y = spec.stemHeight === 0 ? WATER_Y : groundHeight(spot.x, spot.z);
  return {
    memory,
    spec,
    spot,
    position: [spot.x, y, spot.z] as [number, number, number],
    // A point just above the flower head, for the camera to fly to.
    anchor: new THREE.Vector3(spot.x, y + (spec.stemHeight + 0.25) * spot.scale, spot.z),
  };
});

export default function Flowers() {
  // Wait for saved progress, so flowers mount in their real state instead of blooming on every visit.
  const hydrated = useGardenStore((s) => s.hydrated);
  const opened = useGardenStore((s) => s.opened);
  const pendingBloom = useGardenStore((s) => s.pendingBloom);
  const hoveredId = useGardenStore((s) => s.hoveredId);
  const interactive = useGardenStore((s) => s.stage === "garden" && !s.activeId && !s.celebrating);
  const hover = useGardenStore((s) => s.hover);
  const unhover = useGardenStore((s) => s.unhover);
  const selectFlower = useGardenStore((s) => s.selectFlower);

  useEffect(() => {
    placements.forEach((p) => flowerAnchors.set(p.memory.id, p.anchor));
  }, []);

  if (!hydrated) return null;

  const bloomed = bloomedIds({ opened, pendingBloom });
  const finalUnlocked = isFinalUnlocked({ opened, pendingBloom });

  return placements.map(({ memory, spec, spot, position }) => {
    const locked = memory.id === FINAL_ID && !finalUnlocked;
    const status: FlowerStatus = locked ? "locked" : bloomed.includes(memory.id) ? "bloomed" : "waiting";
    return (
      <Flower
        key={memory.id}
        id={memory.id}
        spec={spec}
        position={position}
        scale={spot.scale}
        facing={spot.facing}
        status={status}
        beckon={memory.flower === "lotus" && opened.length === 0}
        hovered={hoveredId === memory.id}
        interactive={interactive}
        onHover={hover}
        onHoverEnd={unhover}
        onSelect={selectFlower}
        label={<FlowerTag text={locked ? "Still growing…" : memory.label} />}
      />
    );
  });
}
