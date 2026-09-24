"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

// Placeholder scene that proves the R3F/drei stack renders.
// Phase 2 replaces it with the real garden environment.
export default function GardenCanvas() {
  return (
    <Canvas
      // Cap pixel ratio at 2 so high-DPI phones don't render 3x the pixels.
      dpr={[1, 2]}
      camera={{ position: [0, 2.5, 6], fov: 45 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#0b1020"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} />

      <mesh position={[0, 0.5, 0]}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial color="#f4b6c2" flatShading />
      </mesh>

      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[4, 48]} />
        <meshStandardMaterial color="#1f3a2c" />
      </mesh>

      <OrbitControls enablePan={false} />
    </Canvas>
  );
}
