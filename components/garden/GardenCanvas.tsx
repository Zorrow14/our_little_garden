"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import * as THREE from "three";
import { zoneDefinition } from "@/components/zones/registry";
import { useGardenStore } from "@/lib/gardenStore";
import { useZone } from "@/lib/zones";
import DebugInfo from "./DebugInfo";
import Gardeners from "./Gardeners";
import GrowthDriver from "./GrowthDriver";

// NeutralToneMapping keeps petal pinks and whites truer than R3F's ACES default.
const GL = { antialias: true, powerPreference: "high-performance", toneMapping: THREE.NeutralToneMapping } as const;

export default function GardenCanvas() {
  const debug = useGardenStore((s) => s.debug);
  const zone = useZone((s) => s.zone);
  const { Scene } = zoneDefinition(zone);
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
      <SceneReady />
      <GrowthDriver />
      {/* The zone on screen. The gardeners live outside it, so they carry on across a switch. */}
      <Scene key={zone} />
      <Gardeners />
      {debug && <DebugInfo />}
    </Canvas>
  );
}

function SceneReady() {
  const setSceneReady = useGardenStore((s) => s.setSceneReady);
  useEffect(() => setSceneReady(), [setSceneReady]);
  return null;
}
