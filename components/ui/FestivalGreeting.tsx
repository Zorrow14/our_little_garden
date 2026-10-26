"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useState } from "react";
import { useFestival } from "@/lib/festivals";
import { useGardenStore } from "@/lib/gardenStore";
import { openKeepsake } from "@/lib/keepsakes";
import { usePresence } from "@/lib/presence";
import { useZone } from "@/lib/zones";

/** Remembered for the rest of the visit (this tab), so it greets you once, not on every reload. */
const seenKey = (id: string) => `our-little-garden:greeted:${id}`;

function alreadyGreeted(id: string) {
  try {
    return sessionStorage.getItem(seenKey(id)) === "1";
  } catch {
    return false;
  }
}

function markGreeted(id: string) {
  try {
    sessionStorage.setItem(seenKey(id), "1");
  } catch {
    // Then it may greet you again after a reload; no harm.
  }
}

/**
 * The festival's greeting, as you come into the garden while one is on: in
 * Burmese (in Noto Sans Myanmar, so it reads on every device), then in
 * English. Dismissed with its button, Escape, or a tap outside it.
 */
export default function FestivalGreeting() {
  const festival = useFestival((s) => s.festival);
  const ready = useGardenStore((s) => s.hydrated && s.stage === "garden" && !s.activeId);
  const me = usePresence((s) => s.me);
  const inGarden = useZone((s) => s.zone === "garden");
  const [dismissed, setDismissed] = useState<string | null>(null);
  const titleId = useId();

  const showing = !!festival && ready && !!me && dismissed !== festival.id && !alreadyGreeted(festival.id);

  const close = () => {
    if (!festival) return;
    markGreeted(festival.id);
    setDismissed(festival.id);
  };

  useEffect(() => {
    if (!showing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <AnimatePresence>
      {showing && festival && (
        <motion.div
          key="greeting"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6 } }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(40_22_30/0.35),rgb(6_9_22/0.8))]" onClick={close} />
          <motion.div
            className="paper-creases relative w-[min(92vw,26rem)] rounded-[4px] bg-paper px-7 pb-6 pt-8 text-center text-ink shadow-letter"
            initial={{ y: 24, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <Lamps />
            <h2 id={titleId} lang="my" className="mt-5 font-myanmar text-[clamp(1.15rem,5vw,1.45rem)] font-semibold leading-[1.9] text-[#7a3b2e]">
              {festival.theme.greeting.native}
            </h2>
            <p className="mt-2 font-hand text-[clamp(1.6rem,7vw,2rem)] leading-tight">{festival.theme.greeting.english}</p>
            <p className="mx-auto mt-3 max-w-[20rem] text-[0.95rem] leading-relaxed text-ink/70">
              The garden is lit for the Festival of Lights. Light a lamp, and look up for the fireworks.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {inGarden && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    openKeepsake("lamp");
                  }}
                  className="rounded-full px-4 py-2.5 text-[0.95rem] text-ink/75 underline decoration-ink/25 underline-offset-8 transition-colors hover:text-ink hover:decoration-rose focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
                >
                  {festival.theme.lamp.action}
                </button>
              )}
              <button
                type="button"
                onClick={close}
                autoFocus
                className="rounded-full bg-ink px-5 py-2.5 text-[0.95rem] text-paper transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
              >
                Into the garden
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A row of little clay lamps, their flames gently flickering. */
function Lamps() {
  return (
    <div aria-hidden className="flex items-end justify-center gap-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className="h-7 w-7">
          <motion.path
            d="M12 3c2.2 2.6 2.5 5 0 7.2C9.5 8 9.8 5.6 12 3z"
            fill="#f6b94f"
            style={{ transformOrigin: "12px 10px" }}
            animate={{ scaleY: [1, 1.12, 0.94, 1.06, 1], opacity: [0.95, 1, 0.85, 1, 0.95] }}
            transition={{ duration: 1.6 + i * 0.23, repeat: Infinity, ease: "easeInOut" }}
          />
          <path d="M3.5 13h17c-.7 3.6-4.2 6-8.5 6s-7.8-2.4-8.5-6z" fill="#b4674a" />
          <path d="M3.5 13h17" stroke="#7a3b2e" strokeWidth="1" />
        </svg>
      ))}
    </div>
  );
}
