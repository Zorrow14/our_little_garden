"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { seatPose, sittingTogether } from "@/lib/props";

/** Seconds between the little hearts rising while you sit together. */
const EVERY = 2.6;

/**
 * When both of you are sitting on the same thing (the swing, or the two
 * benches on the dock), little hearts and sparkles drift up between you now
 * and then, like the heart a wave sends up.
 */
export default function TogetherCue() {
  const anchor = useRef<THREE.Group>(null!);
  const [together, setTogether] = useState(false);
  const [puffs, setPuffs] = useState(0);
  const togetherRef = useRef(false);

  useFrame(() => {
    const pair = sittingTogether();
    if (pair) {
      const a = seatPose(pair[0]);
      const b = seatPose(pair[1]);
      anchor.current.position.set((a.x + b.x) / 2, Math.max(a.y, b.y) + 0.9, (a.z + b.z) / 2);
    }
    if (!!pair !== togetherRef.current) {
      togetherRef.current = !!pair;
      setTogether(!!pair);
    }
  });

  useEffect(() => {
    if (!together) return;
    setPuffs((n) => n + 1);
    const timer = setInterval(() => setPuffs((n) => n + 1), EVERY * 1000);
    return () => clearInterval(timer);
  }, [together]);

  return (
    <group ref={anchor}>
      {together && (
        <Html key={puffs} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="relative h-8 w-16">
            <motion.svg
              viewBox="0 0 24 24"
              className="absolute left-[calc(50%-14px)] top-0 h-7 w-7 fill-rose [filter:drop-shadow(0_2px_6px_rgb(3_5_18/0.6))]"
              aria-hidden="true"
              initial={{ y: 6, opacity: 0, scale: 0.4 }}
              animate={{ y: -44, opacity: [0, 1, 1, 0], scale: 1 }}
              transition={{ duration: 2.2, ease: "easeOut" }}
            >
              <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z" />
            </motion.svg>
            {[-1, 1].map((side) => (
              <motion.svg
                key={side}
                viewBox="0 0 24 24"
                className="absolute left-[calc(50%-7px)] top-2 h-3.5 w-3.5 fill-lantern [filter:drop-shadow(0_0_4px_rgb(255_224_138/0.8))]"
                aria-hidden="true"
                initial={{ x: side * 4, y: 0, opacity: 0, scale: 0.3, rotate: 0 }}
                animate={{ x: side * 22, y: -30, opacity: [0, 1, 0], scale: 1, rotate: side * 45 }}
                transition={{ duration: 1.6, delay: 0.35, ease: "easeOut" }}
              >
                <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
              </motion.svg>
            ))}
          </div>
        </Html>
      )}
    </group>
  );
}
