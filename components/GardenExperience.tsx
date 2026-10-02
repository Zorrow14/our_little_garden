"use client";

import { MotionConfig } from "framer-motion";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import GardenHud from "@/components/ui/GardenHud";
import IntroOverlay from "@/components/ui/IntroOverlay";
import Keepsakes from "@/components/ui/Keepsakes";
import LetterModal from "@/components/ui/LetterModal";
import MusicControl from "@/components/ui/MusicControl";
import PartnerStatus from "@/components/ui/PartnerStatus";
import PlantPanel from "@/components/ui/PlantPanel";
import PlayerControls from "@/components/ui/PlayerControls";
import WhoAreYou from "@/components/ui/WhoAreYou";
import ZoneFade from "@/components/ui/ZoneFade";
import { STORAGE_KEY, useGardenStore } from "@/lib/gardenStore";
import { startHousePhotoSync } from "@/lib/housePhotos";
import { startMusic } from "@/lib/music";
import { startNoteSync } from "@/lib/notes";
import { startPlantSync } from "@/lib/plantStore";
import { startPresence } from "@/lib/presence";

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
    // With ?skipintro there's no "Enter the garden" click, so the music waits for her first tap or key press.
    if (useGardenStore.getState().stage !== "garden") return;
    const begin = () => startMusic();
    window.addEventListener("pointerdown", begin, { once: true });
    window.addEventListener("keydown", begin, { once: true });
    return () => {
      window.removeEventListener("pointerdown", begin);
      window.removeEventListener("keydown", begin);
    };
  }, []);

  // The shared garden: load what's been planted and watch for new plants.
  useEffect(() => startPlantSync(), []);
  // The live garden: who's here, and where their gardener is.
  useEffect(() => startPresence(), []);
  // The notes board inside the cottage.
  useEffect(() => startNoteSync(), []);
  // Photos hung on the cottage's photo wall.
  useEffect(() => startHousePhotoSync(), []);

  return (
    <MotionConfig reducedMotion="user">
      <main className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0">
          <GardenCanvas />
        </div>
        <GardenHud />
        <PlayerControls />
        <PlantPanel />
        <MusicControl />
        <Keepsakes />
        <LetterModal />
        <PartnerStatus />
        <ZoneFade />
        <IntroOverlay />
        <WhoAreYou />
      </main>
    </MotionConfig>
  );
}
