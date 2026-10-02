"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { type Stage, useGardenStore } from "@/lib/gardenStore";
import { startMusic } from "@/lib/music";
import { chooseIdentity, usePresence } from "@/lib/presence";
import { IdentityChoice } from "./WhoAreYou";

// Revealed left to right like ink going down; the negative insets leave room for the script's flourishes.
// Hidden must clip past the left overhang too, or a sliver of each line's first letter shows early.
const HIDDEN = "inset(-25% 104% -25% -4%)";
const WRITTEN = "inset(-25% -4% -25% -4%)";
const PEN = [0.45, 0.05, 0.4, 1] as const;

export default function IntroOverlay() {
  const stage = useGardenStore((s) => s.stage);
  const sceneReady = useGardenStore((s) => s.sceneReady);
  const enter = useGardenStore((s) => s.enter);
  const skipIntro = useGardenStore((s) => s.skipIntro);
  const introSkipped = useGardenStore((s) => s.introSkipped);
  const reducedMotion = useReducedMotion();
  const [written, setWritten] = useState(false);
  const me = usePresence((s) => s.me);
  const asking = usePresence((s) => s.identityLoaded && !s.me);

  const begin = () => {
    // The music has to start inside the click itself, or the browser blocks it.
    startMusic();
    enter();
  };

  const write = (delay: number, duration: number) =>
    reducedMotion
      ? { duration: 0.8, delay: delay / 3 }
      : { duration, delay, ease: PEN };

  return (
    <>
      {/* `custom` tells the exiting overlay where we went: fade slowly into the descent, vanish on ?skipintro. */}
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
                {/* First visit on this device: which of you is it? Picking a name walks straight in. */}
                {asking && sceneReady ? (
                  <IdentityChoice disabled={!written} onChosen={begin} />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={begin}
                      disabled={!written || !sceneReady}
                      className="px-6 py-3 text-[1.05rem] tracking-wide text-moon underline decoration-moon/35 underline-offset-[10px] transition-colors hover:decoration-lantern focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lantern disabled:cursor-default disabled:no-underline"
                    >
                      {sceneReady ? "Enter the garden" : "Planting the last seeds…"}
                    </button>
                    {me && sceneReady && (
                      <button
                        type="button"
                        onClick={() => chooseIdentity(null)}
                        disabled={!written}
                        className="px-3 py-1.5 text-[0.85rem] text-moon/55 transition-colors hover:text-moon focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern"
                      >
                        Not {me}?
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
  
      {/* The walk in from the cottage takes a little while; returning visitors can jump straight to the garden. */}
      <AnimatePresence>
        {stage === "entering" && !introSkipped && (
          <motion.button
            key="skip"
            type="button"
            onClick={skipIntro}
            className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-5 z-40 px-3 py-2 text-[0.9rem] text-moon/70 underline decoration-moon/25 underline-offset-8 transition-colors hover:text-moon hover:decoration-lantern focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 2.5, duration: 1 } }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
          >
            Skip intro
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
