"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { type Stage, useGardenStore } from "@/lib/gardenStore";

// Revealed left to right like ink going down; the negative insets leave room for the script's flourishes.
// Hidden must clip past the left overhang too, or a sliver of each line's first letter shows early.
const HIDDEN = "inset(-25% 104% -25% -4%)";
const WRITTEN = "inset(-25% -4% -25% -4%)";
const PEN = [0.45, 0.05, 0.4, 1] as const;

export default function IntroOverlay() {
  const stage = useGardenStore((s) => s.stage);
  const sceneReady = useGardenStore((s) => s.sceneReady);
  const enter = useGardenStore((s) => s.enter);
  const reducedMotion = useReducedMotion();
  const [written, setWritten] = useState(false);

  const write = (delay: number, duration: number) =>
    reducedMotion
      ? { duration: 0.8, delay: delay / 3 }
      : { duration, delay, ease: PEN };

  return (
    // `custom` tells the exiting overlay where we went: fade slowly into the descent, vanish on ?skipintro.
    <AnimatePresence custom={stage}>
      {stage === "intro" && (
        <motion.div
          key="intro"
          className="absolute inset-0 z-40 flex items-center justify-center bg-[radial-gradient(ellipse_at_50%_38%,#1b2448_0%,#0e1630_58%,#090f24_100%)]"
          variants={{
            leave: (next: Stage) => ({
              opacity: 0,
              transition: { duration: next === "garden" ? 0 : 2.4, ease: "easeInOut" },
            }),
          }}
          exit="leave"
        >
          <div className="w-full max-w-[46rem] px-8">
            <h1 className="font-hand text-[clamp(1.85rem,7.4vw,3rem)] leading-[1.45] text-moon">
              <motion.span
                className="block text-balance"
                initial={{ clipPath: HIDDEN }}
                animate={{ clipPath: WRITTEN }}
                transition={write(0.9, 2.6)}
              >
                I couldn&rsquo;t send you flowers&hellip;
              </motion.span>
              <motion.span
                className="mt-2 block text-balance pl-[14%]"
                initial={{ clipPath: HIDDEN }}
                animate={{ clipPath: WRITTEN }}
                transition={write(4.1, 2.2)}
                onAnimationComplete={() => setWritten(true)}
              >
                so I grew you a garden.
              </motion.span>
            </h1>

            <motion.div
              className="mt-14 flex justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: written ? 1 : 0 }}
              transition={{ duration: 1.2 }}
            >
              <button
                type="button"
                onClick={enter}
                disabled={!written || !sceneReady}
                className="px-6 py-3 text-[1.05rem] tracking-wide text-moon underline decoration-moon/35 underline-offset-[10px] transition-colors hover:decoration-lantern focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lantern disabled:cursor-default disabled:no-underline"
              >
                {sceneReady ? "Enter the garden" : "Planting the last seeds…"}
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
