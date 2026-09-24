"use client";

import { memories } from "@/data/memories";
import { useGardenStore } from "@/lib/gardenStore";
import { FLOWER_SPECS } from "@/lib/flowerSpecs";
import { FLOWER_SPOTS } from "@/lib/layout";
import { groundHeight, WATER_Y } from "@/lib/terrain";
import Flower from "./Flower";

export default function Flowers() {
  // Wait for saved progress, so flowers mount in their real state instead of blooming on every visit.
  const hydrated = useGardenStore((s) => s.hydrated);
  if (!hydrated) return null;

  return memories.map((memory) => {
    const spec = FLOWER_SPECS[memory.flower];
    if (!spec) return null;
    const spot = FLOWER_SPOTS[memory.flower];
    const y = spec.stemHeight === 0 ? WATER_Y : groundHeight(spot.x, spot.z);
    return (
      <Flower
        key={memory.id}
        id={memory.id}
        spec={spec}
        position={[spot.x, y, spot.z]}
        scale={spot.scale}
        facing={spot.facing}
        beckon={memory.flower === "lotus"}
      />
    );
  });
}
