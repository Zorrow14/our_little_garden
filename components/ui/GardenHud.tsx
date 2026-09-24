"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useEffect } from "react";
import { memories } from "@/data/memories";
import { bloomedLetterCount, FINAL_ID, LETTER_IDS, useGardenStore } from "@/lib/gardenStore";
import FlowerGlyph from "./FlowerGlyph";

/** "Tap" on touch screens, "Click" with a mouse. */
function Tap() {
  return (
    <>
      <span className="[@media(hover:hover)]:hidden">Tap</span>
      <span className="hidden [@media(hover:hover)]:inline">Click</span>
    </>
  );
}

export default function GardenHud() {
  const inGarden = useGardenStore((s) => s.stage === "garden" && !s.activeId);
  const hydrated = useGardenStore((s) => s.hydrated);
  const opened = useGardenStore((s) => s.opened);
  const count = useGardenStore(bloomedLetterCount);
  const celebrating = useGardenStore((s) => s.celebrating);
  const notice = useGardenStore((s) => s.notice);
  const clearNotice = useGardenStore((s) => s.clearNotice);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(clearNotice, 3800);
    return () => clearTimeout(timer);
  }, [notice, clearNotice]);

  const finalUnlocked = count === LETTER_IDS.length;
  const finalRead = opened.includes(FINAL_ID);

  let hint: { key: string; text: ReactNode } | null = null;
  if (notice) hint = { key: "notice", text: notice };
  else if (celebrating) hint = { key: "celebrating", text: "Something just bloomed at the end of the path." };
  else if (count === 0 && !finalRead) hint = { key: "start", text: <><Tap /> a flower to open its letter</> };
  else if (finalUnlocked && !finalRead) hint = { key: "final", text: "The last flower is waiting for you at the end of the path." };
  else if (finalRead) hint = { key: "done", text: "Every letter is open. Come back to them whenever you need." };

  return (
    <AnimatePresence>
      {inGarden && hydrated && (
        <motion.div
          key="hud"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-3.5 px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          <AnimatePresence mode="wait">
            {hint && (
              <motion.p
                key={hint.key}
                role="status"
                className="max-w-[26rem] text-balance text-center text-[0.95rem] leading-snug text-moon/85 [text-shadow:0_1px_10px_rgb(5_8_20/0.95)]"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.5 }}
              >
                {hint.text}
              </motion.p>
            )}
          </AnimatePresence>

          <div
            role="img"
            aria-label={`${count} of ${LETTER_IDS.length} letters opened`}
            className="flex items-center gap-2.5 [filter:drop-shadow(0_1px_6px_rgb(5_8_20/0.9))]"
          >
            {LETTER_IDS.map((id, i) => (
              <FlowerGlyph
                key={id}
                className={`h-4 w-4 transition-colors duration-1000 ${i < count ? "fill-lantern" : "fill-moon/25"}`}
              />
            ))}
            <span aria-hidden className="mx-1 h-3.5 w-px bg-moon/25" />
            <FlowerGlyph
              className={`h-5 w-5 transition-colors duration-1000 ${
                finalRead ? "fill-lantern" : finalUnlocked ? "animate-pulse fill-lantern" : "fill-moon/10"
              }`}
            />
          </div>
        </motion.div>
      )}
      {inGarden && hydrated && <LetterIndex key="index" finalUnlocked={finalUnlocked} />}
    </AnimatePresence>
  );
}

/**
 * Every letter as a plain button, for keyboard and screen-reader visitors who
 * can't pick flowers in the 3D scene. Hidden until it receives focus.
 */
function LetterIndex({ finalUnlocked }: { finalUnlocked: boolean }) {
  const selectFlower = useGardenStore((s) => s.selectFlower);
  return (
    <nav
      aria-label="Letters"
      className="sr-only z-40 focus-within:not-sr-only focus-within:absolute focus-within:left-4 focus-within:top-4 focus-within:rounded-[3px] focus-within:bg-paper focus-within:p-3 focus-within:text-ink focus-within:shadow-letter"
    >
      <ul className="space-y-1">
        {memories.map((m) => {
          const locked = m.id === FINAL_ID && !finalUnlocked;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => selectFlower(m.id)}
                className="w-full rounded-sm px-3 py-1.5 text-left font-hand text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
              >
                {locked ? "Still growing… (open the other six first)" : m.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
