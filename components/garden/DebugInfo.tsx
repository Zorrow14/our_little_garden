"use client";

import { Stats } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

/** ?debug: an FPS meter, plus the renderer on window for checking draw calls from the console. */
export default function DebugInfo() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    (window as unknown as { __gardenRenderer?: unknown }).__gardenRenderer = gl;
  }, [gl]);
  return <Stats />;
}
