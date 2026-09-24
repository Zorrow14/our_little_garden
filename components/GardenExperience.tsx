"use client";

import { MotionConfig } from "framer-motion";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import IntroOverlay from "@/components/ui/IntroOverlay";
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
    <MotionConfig reducedMotion="user">
      <main className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0">
          <GardenCanvas />
        </div>
        <IntroOverlay />
      </main>
    </MotionConfig>
  );
}
