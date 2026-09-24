"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { STORAGE_KEY, useGardenStore } from "@/lib/gardenStore";

// three.js needs window/WebGL, so the canvas only renders in the browser.
const GardenCanvas = dynamic(() => import("@/components/garden/GardenCanvas"), {
  ssr: false,
});

/**
 * URL flags for testing before the gift is sent:
 *   ?debug      show an FPS meter
 *   ?reset      forget which letters have been opened
 *   ?skipintro  go straight to the garden
 */
function applyUrlFlags() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("reset")) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable (e.g. some private browsing modes); nothing to reset then.
    }
  }
  useGardenStore.setState({
    debug: params.has("debug"),
    ...(params.has("skipintro") ? { stage: "garden" as const } : {}),
  });
}

export default function GardenExperience() {
  useEffect(() => {
    applyUrlFlags();
    void useGardenStore.persist.rehydrate();
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden">
      <div className="absolute inset-0">
        <GardenCanvas />
      </div>

      <motion.p
        className="pointer-events-none absolute inset-x-0 top-[12%] text-balance px-6 text-center font-serif text-2xl italic text-cream/90 sm:text-3xl"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 2.4, delay: 0.6, ease: "easeOut" }}
      >
        I couldn&apos;t send you flowers&hellip; so I grew you a garden.
      </motion.p>
    </main>
  );
}
