"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";

// three.js needs window/WebGL, so the canvas only renders in the browser.
const GardenCanvas = dynamic(() => import("@/components/garden/GardenCanvas"), {
  ssr: false,
});

export default function GardenExperience() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
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
