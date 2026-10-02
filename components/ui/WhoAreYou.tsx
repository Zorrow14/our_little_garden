"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useGardenStore } from "@/lib/gardenStore";
import { chooseIdentity, GARDENER_NAMES, type GardenerName, usePresence } from "@/lib/presence";

/** "Zorrow / Skelly": picking one sets which gardener this device walks as. */
export function IdentityChoice({ onChosen, disabled }: { onChosen?: (name: GardenerName) => void; disabled?: boolean }) {
  const online = usePresence((s) => s.online);
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-hand text-[1.6rem] leading-none text-moon">Who are you?</p>
      <div className="flex gap-3">
        {GARDENER_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            disabled={disabled}
            onClick={() => {
              chooseIdentity(name);
              onChosen?.(name);
            }}
            className="flex min-w-[7.5rem] flex-col items-center rounded-full px-6 py-2.5 text-[1.05rem] tracking-wide text-moon ring-1 ring-moon/30 transition-colors hover:bg-moon/10 hover:ring-lantern/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lantern disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:ring-moon/30"
          >
            {name}
            {online.includes(name) && <span className="text-[0.75rem] leading-tight text-moon/60">here right now</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Asks who's visiting when the garden opens without the title screen (e.g. ?skipintro). */
export default function WhoAreYou() {
  const asking = usePresence((s) => s.identityLoaded && !s.me);
  const inGarden = useGardenStore((s) => s.stage === "garden");

  return (
    <AnimatePresence>
      {asking && inGarden && (
        <motion.div
          key="who"
          role="dialog"
          aria-modal="true"
          aria-label="Who are you?"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgb(14_22_48/0.55),rgb(6_9_22/0.85))] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <IdentityChoice />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
