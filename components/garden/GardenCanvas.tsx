"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import * as THREE from "three";
import { useGardenStore } from "@/lib/gardenStore";
import CameraRig from "./CameraRig";
import Cottage from "./Cottage";
import DebugInfo from "./DebugInfo";
import FallingPetals from "./FallingPetals";
import Fence from "./Fence";
import Fireflies from "./Fireflies";
import Flowers from "./Flowers";
import Gardeners from "./Gardeners";
import Grass from "./Grass";
import Ground from "./Ground";
import GrowthDriver from "./GrowthDriver";
import Lights from "./Lights";
import Path from "./Path";
import Plants from "./Plants";
import Pond from "./Pond";
import Rocks from "./Rocks";
import Sky from "./Sky";
import Trees from "./Trees";
import Wildflowers from "./Wildflowers";

// NeutralToneMapping keeps petal pinks and whites truer than R3F's ACES default.
const GL = { antialias: true, powerPreference: "high-performance", toneMapping: THREE.NeutralToneMapping } as const;

export default function GardenCanvas() {
  const debug = useGardenStore((s) => s.debug);
  const setQuality = useGardenStore((s) => s.setQuality);
  // Start at a moderate pixel ratio; PerformanceMonitor raises or lowers it to hold the frame rate.
  const [dpr, setDpr] = useState(() => Math.min(1.5, window.devicePixelRatio || 1));

  const degrade = () => {
    setDpr(1);
    setQuality("low");
  };

  return (
    <Canvas dpr={dpr} gl={GL} camera={{ fov: 45, near: 0.1, far: 220, position: [0, 4, 12] }}>
      <PerformanceMonitor
        onIncline={() => setDpr(Math.min(2, window.devicePixelRatio || 1))}
        onDecline={degrade}
        onFallback={degrade}
        flipflops={3}
      />
      <fog attach="fog" args={["#262a4e", 16, 62]} />
      <SceneReady />
      <GrowthDriver />
      <Sky />
      <Lights />
      <Ground />
      <Pond />
      <Rocks />
      <Path />
      <Trees />
      <Fence />
      <Grass />
      <Wildflowers />
      <Flowers />
      <Plants />
      <Cottage />
      <Gardeners />
      <Fireflies />
      <FallingPetals />
      <CameraRig />
      {debug && <DebugInfo />}
    </Canvas>
  );
}

function SceneReady() {
  const setSceneReady = useGardenStore((s) => s.setSceneReady);
  useEffect(() => setSceneReady(), [setSceneReady]);
  return null;
}
