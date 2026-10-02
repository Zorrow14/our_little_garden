"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import FlowerTag from "@/components/ui/FlowerTag";
import { FLOWER_REGISTRY } from "@/lib/flowerSpecs";
import { useGardenStore } from "@/lib/gardenStore";
import { flowerAnchors } from "@/lib/layout";
import { plantView, usePlantStore } from "@/lib/plantStore";
import { type Plant, plantKind } from "@/lib/plants";
import { createRandom, hashString } from "@/lib/terrain";
import Flower, { type FlowerStatus } from "./Flower";

/** Seconds for a plant to grow in: slower for one that arrives while you're watching. */
const GROW_TIME = 2.4;
const FRESH_GROW_TIME = 4.5;

/** Plants that have finished growing in, so stepping back out of the cottage doesn't grow them all over again. */
const grown = new Set<string>();

/** The shared garden: every letter either of you planted, growing alongside the original seven. */
export default function Plants() {
  const camera = useThree((s) => s.camera);
  const plants = usePlantStore((s) => s.plants);
  const fresh = usePlantStore((s) => s.fresh);
  const read = usePlantStore((s) => s.read);
  const hoveredId = useGardenStore((s) => s.hoveredId);
  const interactive = useGardenStore((s) => s.stage === "garden" && !s.activeId && !s.celebrating);
  const hover = useGardenStore((s) => s.hover);
  const unhover = useGardenStore((s) => s.unhover);
  const selectFlower = useGardenStore((s) => s.selectFlower);

  useEffect(() => {
    plantView.camera = camera;
    return () => {
      if (plantView.camera === camera) plantView.camera = null;
    };
  }, [camera]);

  return plants.map((plant, i) => (
    <PlantFlower
      key={plant.id}
      plant={plant}
      fresh={fresh.includes(plant.id)}
      // Plants already here when the garden loads come up one after another.
      delay={fresh.includes(plant.id) ? 0 : Math.min(i * 0.18, 2.5)}
      read={read.includes(plant.id)}
      hovered={hoveredId === plant.id}
      interactive={interactive}
      onHover={hover}
      onHoverEnd={unhover}
      onSelect={selectFlower}
    />
  ));
}

function PlantFlower({
  plant,
  fresh,
  delay,
  read,
  hovered,
  interactive,
  onHover,
  onHoverEnd,
  onSelect,
}: {
  plant: Plant;
  fresh: boolean;
  delay: number;
  read: boolean;
  hovered: boolean;
  interactive: boolean;
  onHover: (id: string) => void;
  onHoverEnd: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const spec = FLOWER_REGISTRY[plantKind(plant.flower_type)].spec;
  const position = useMemo<[number, number, number]>(
    () => [plant.position_x, plant.position_y, plant.position_z],
    [plant.position_x, plant.position_y, plant.position_z],
  );
  // A little smaller than the original letters' flowers, and each its own size and angle.
  const { scale, facing } = useMemo(() => {
    const rand = createRandom(hashString(plant.id));
    return { scale: 0.95 + rand() * 0.2, facing: (rand() - 0.5) * 0.4 };
  }, [plant.id]);

  const grow = useRef(grown.has(plant.id) ? 1 : 0);
  const waited = useRef(0);
  const duration = fresh ? FRESH_GROW_TIME : GROW_TIME;
  /** Held as a closed bud while it grows, then opens. */
  const [sprouted, setSprouted] = useState(() => grown.has(plant.id));

  useFrame((_, dt) => {
    if (grow.current >= 1) return;
    waited.current += dt;
    if (waited.current < delay) return;
    grow.current = Math.min(1, grow.current + Math.min(dt, 0.1) / duration);
    if (grow.current > 0.55 && !sprouted) setSprouted(true);
    if (grow.current >= 1) grown.add(plant.id);
  });

  useEffect(() => {
    const anchor = new THREE.Vector3(position[0], position[1] + (spec.stemHeight + 0.25) * scale, position[2]);
    flowerAnchors.set(plant.id, anchor);
    return () => {
      flowerAnchors.delete(plant.id);
    };
  }, [plant.id, position, spec.stemHeight, scale]);

  const status: FlowerStatus = !sprouted ? "locked" : read ? "bloomed" : "waiting";

  return (
    <Flower
      id={plant.id}
      spec={spec}
      position={position}
      scale={scale}
      facing={facing}
      status={status}
      beckon={sprouted && !read}
      grow={grow}
      hovered={hovered}
      interactive={interactive}
      onHover={onHover}
      onHoverEnd={onHoverEnd}
      onSelect={onSelect}
      label={<FlowerTag text={plant.category_label} note={`planted by ${plant.planted_by}`} />}
    />
  );
}
