"use client";

import { motion } from "framer-motion";

/** The hover label: a little paper plant tag, hole-punched and written on by hand. */
export default function FlowerTag({ text, note }: { text: string; note?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, rotate: -4 }}
      animate={{ opacity: 1, y: 0, rotate: -2 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="pointer-events-none select-none [filter:drop-shadow(0_6px_10px_rgb(3_5_18/0.55))]"
    >
      <div className="relative whitespace-nowrap bg-paper py-1.5 pl-7 pr-4 font-hand text-[1.15rem] leading-snug text-ink [clip-path:polygon(12px_0,100%_0,100%_100%,12px_100%,0_50%)]">
        <span aria-hidden className="absolute left-[11px] top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full bg-night/80" />
        {text}
        {note && <span className="block font-serif text-[0.72rem] leading-tight text-ink/60">{note}</span>}
      </div>
    </motion.div>
  );
}
