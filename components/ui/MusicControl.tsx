"use client";

import { AnimatePresence, motion } from "framer-motion";
import { DEFAULT_VOLUME, setMusicMuted, setMusicVolume, useMusic } from "@/lib/music";

/**
 * The speaker in the top-right corner: tap to mute or unmute. On hover (or
 * keyboard focus) a small volume slider drops down beneath it.
 */
export default function MusicControl() {
  const { started, available, muted, volume } = useMusic();
  const silent = muted || volume === 0;

  return (
    <AnimatePresence>
      {started && available && (
        <motion.div
          key="music"
          className="group fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          <button
            type="button"
            onClick={() => {
              // Unmuting from a volume dragged all the way down brings it back to the default.
              if (silent && volume === 0) setMusicVolume(DEFAULT_VOLUME);
              else setMusicMuted(!muted);
            }}
            aria-label={silent ? "Play music" : "Mute music"}
            aria-pressed={silent}
            className="grid h-10 w-10 place-items-center rounded-full bg-night/55 text-moon/90 ring-1 ring-moon/20 backdrop-blur-sm transition-colors hover:text-moon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lantern"
          >
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 7.5h2.8L10 4.5v11l-3.7-3H3.5z" fill="currentColor" fillOpacity="0.2" />
              {silent ? (
                <path d="M13 8l4 4M17 8l-4 4" />
              ) : (
                <>
                  <path d="M13 7.6a3.4 3.4 0 0 1 0 4.8" />
                  <path d="M15.2 5.4a6.5 6.5 0 0 1 0 9.2" />
                </>
              )}
            </svg>
          </button>
          {/* The padding bridges the gap to the button, so the panel stays open while the pointer moves down to it. */}
          <div className="invisible absolute right-0 top-full pt-2 opacity-0 transition-opacity duration-300 group-focus-within:visible group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:visible [@media(hover:hover)]:group-hover:opacity-100">
            <div className="flex items-center rounded-full bg-night/70 px-3.5 py-2.5 ring-1 ring-moon/20 backdrop-blur-sm">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => setMusicVolume(Number(e.target.value))}
                aria-label="Music volume"
                className="w-24 cursor-pointer accent-lantern"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
