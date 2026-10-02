"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useGardenStore } from "@/lib/gardenStore";
import { GARDENER_NAMES, usePresence } from "@/lib/presence";
import { useZone, ZONE_PLACES, type ZoneName } from "@/lib/zones";

const SHORT: Record<ZoneName, string> = { garden: "garden", house: "cottage" };

/**
 * Top left: where the other person is right now, so you know whether to go and
 * find them or wait. "Here with you" when you're in the same zone.
 */
export default function PartnerStatus() {
  const me = usePresence((s) => s.me);
  const partner = GARDENER_NAMES.find((n) => n !== me) ?? null;
  const online = usePresence((s) => (partner ? s.online.includes(partner) : false));
  const theirZone = usePresence((s) => (partner ? s.zones[partner] : undefined));
  const myZone = useZone((s) => s.zone);
  const showing = useGardenStore((s) => s.stage === "garden" && !s.activeId) && me !== null && partner !== null;

  let long = "";
  let short = "";
  let tone = "bg-moon/30";
  if (partner && online && theirZone) {
    const together = theirZone === myZone;
    long = together ? `${partner} is here with you` : `${partner} is ${ZONE_PLACES[theirZone]}`;
    short = `${partner} · ${together ? "here" : SHORT[theirZone]}`;
    tone = together ? "bg-lantern shadow-[0_0_8px_rgb(255_201_120/0.8)]" : "bg-[#9fd3a9]";
  } else if (partner) {
    long = `${partner} is away`;
    short = `${partner} · away`;
  }

  return (
    <AnimatePresence>
      {showing && (
        <motion.div
          key="partner"
          role="status"
          aria-label={long}
          title={online ? long : `${long}. Their gardener is pottering about in the cottage.`}
          className="pointer-events-auto absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-30 flex items-center gap-2 rounded-full bg-night/55 py-2 pl-3 pr-4 text-[0.85rem] text-moon/90 ring-1 ring-moon/20 backdrop-blur-sm"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.5 }}
        >
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full transition-colors duration-700 ${tone}`} />
          <span className="sm:hidden">{short}</span>
          <span className="hidden sm:inline">{long}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
