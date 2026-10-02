"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { arriveInZone, useZone } from "@/lib/zones";

/**
 * The dip to dark when stepping through a door: fade out, swap the zone's
 * scene while the screen is dark, then fade back in.
 */
export default function ZoneFade() {
  const leaving = useZone((s) => s.leaving);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (leaving) setDark(true);
  }, [leaving]);

  return (
    <motion.div
      aria-hidden
      className={`fixed inset-0 z-[45] bg-[#070a18] ${dark ? "pointer-events-auto" : "pointer-events-none"}`}
      initial={false}
      animate={{ opacity: dark ? 1 : 0 }}
      transition={{ duration: dark ? 0.45 : 0.7, ease: "easeInOut" }}
      onAnimationComplete={() => {
        if (!dark || !useZone.getState().leaving) return;
        arriveInZone();
        // Give the new scene a moment to build before lifting the dark.
        setTimeout(() => requestAnimationFrame(() => setDark(false)), 180);
      }}
    />
  );
}
