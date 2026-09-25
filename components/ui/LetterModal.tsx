"use client";

import { AnimatePresence, motion, useAnimate, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { type Memory, memories } from "@/data/memories";
import { useGardenStore } from "@/lib/gardenStore";
import { duckMusic } from "@/lib/music";
import { usePlantStore } from "@/lib/plantStore";
import { type Plant, plantKind } from "@/lib/plants";
import FlowerGlyph from "./FlowerGlyph";

type Stage = "sealed" | "opening" | "open";

/** A letter to show: one of the original seven, or one planted in the shared garden (which is signed). */
type Letter = Memory & { planted?: { by: string; on: string } };

function letterFromPlant(plant: Plant): Letter {
  return {
    id: plant.id,
    flower: plantKind(plant.flower_type),
    label: plant.category_label,
    message: plant.message,
    photo: plant.photo_url ? { src: plant.photo_url, alt: `A photo from ${plant.planted_by}` } : undefined,
    audio: plant.audio_url ? { src: plant.audio_url, title: `A voice note from ${plant.planted_by}` } : undefined,
    planted: { by: plant.planted_by, on: plant.created_at },
  };
}

export default function LetterModal() {
  const activeId = useGardenStore((s) => s.activeId);
  const plant = usePlantStore((s) => s.plants.find((p) => p.id === activeId));
  const memory: Letter | undefined = memories.find((m) => m.id === activeId) ?? (plant && letterFromPlant(plant));
  return <AnimatePresence>{memory && <LetterDialog key={memory.id} memory={memory} />}</AnimatePresence>;
}

function LetterDialog({ memory }: { memory: Letter }) {
  const markLetterRead = useGardenStore((s) => s.markRead);
  const markPlantRead = usePlantStore((s) => s.markPlantRead);
  // Planted letters keep their own read list, apart from the original seven's progress.
  const markRead = memory.planted ? markPlantRead : markLetterRead;
  const closeLetter = useGardenStore((s) => s.closeLetter);
  const [stage, setStage] = useState<Stage>("sealed");
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus the dialog rather than the envelope, so no focus ring appears for a tap; Tab reaches the envelope next.
    dialog.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLetter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeLetter]);

  const open = () => {
    if (stage !== "sealed") return;
    markRead(memory.id);
    setStage("opening");
  };

  return (
    <motion.div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={memory.label}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(14_22_48/0.5),rgb(6_9_22/0.88))]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        onClick={closeLetter}
      />
      <AnimatePresence mode="popLayout">
        {stage === "open" ? (
          <LetterPaper key="paper" memory={memory} onClose={closeLetter} />
        ) : (
          <Envelope
            key="envelope"
            memory={memory}
            opening={stage === "opening"}
            onOpen={open}
            onOpened={() => setStage("open")}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Envelope({
  memory,
  opening,
  onOpen,
  onOpened,
}: {
  memory: Memory;
  opening: boolean;
  onOpen: () => void;
  onOpened: () => void;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reducedMotion = useReducedMotion();

  // The opening sequence: peel the sticker, swing the flap open, slide the letter out.
  useEffect(() => {
    if (!opening) return;
    let cancelled = false;
    (async () => {
      if (!reducedMotion) {
        await animate("[data-seal]", { scale: [1, 1.18, 0.3], opacity: [1, 1, 0] }, { duration: 0.45, ease: "easeIn" });
        await animate("[data-flap]", { rotateX: 180 }, { duration: 0.8, ease: [0.55, 0, 0.3, 1] });
        // Once it's past upright, the flap belongs behind the letter.
        const flap = scope.current?.querySelector<HTMLElement>("[data-flap]");
        if (flap) flap.style.zIndex = "5";
        await animate("[data-paper]", { y: "-58%" }, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (!cancelled) onOpened();
    })();
    return () => {
      cancelled = true;
    };
    // Runs once when opening starts; the callbacks are stable for this envelope's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening]);

  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ opacity: 0, y: 70, rotate: -3 }}
      animate={{ opacity: 1, y: 0, rotate: -1.5 }}
      exit={{ opacity: 0, y: 90, rotate: 2, transition: { duration: 0.5, ease: "easeIn" } }}
      transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.55 }}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={opening}
        aria-label={`Open the letter: ${memory.label}`}
        className="block w-[min(84vw,25rem)] rounded-[4px] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-lantern disabled:cursor-default"
      >
        <div ref={scope} className="relative aspect-[1.45/1] w-full [perspective:1400px]">
          {/* Back of the envelope, seen above the letter once the flap is open. */}
          <div className="airmail absolute inset-0 rounded-[3px] shadow-letter" />

          {/* The letter waiting inside. */}
          <div data-paper className="absolute inset-x-[7%] bottom-[7%] top-[5%] z-10 rounded-[2px] bg-paper px-[8%] pt-[6%] text-left shadow-sm">
            <p className="font-hand text-[clamp(1.05rem,4.2vw,1.3rem)] leading-snug text-ink/80">{memory.label}</p>
          </div>

          {/* Front pocket, cut in a V where the flap folds over it. */}
          <div className="airmail absolute inset-0 z-20 rounded-[3px] [clip-path:polygon(0_0,50%_49%,100%_0,100%_100%,0_100%)]">
            <p className="absolute inset-x-0 bottom-[11%] -rotate-2 text-balance px-7 text-center font-hand text-[clamp(1.25rem,5vw,1.7rem)] leading-tight text-ink">
              {memory.label}
            </p>
          </div>

          {/* The flap, hinged along the top edge. */}
          <div data-flap className="absolute inset-x-0 top-0 z-30 h-1/2 origin-top [filter:drop-shadow(0_3px_2px_rgb(20_16_48/0.25))]">
            <div className="h-full w-full bg-flap [clip-path:polygon(0_0,100%_0,50%_100%)]" />
          </div>

          {/* A flower sticker holding the flap shut. */}
          <div className="absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2">
            <div data-seal className="grid h-12 w-12 place-items-center rounded-full bg-rose shadow-[0_2px_6px_rgb(40_10_30/0.35)] ring-2 ring-white/40">
              <FlowerGlyph className="h-6 w-6 fill-white/90" />
            </div>
          </div>
        </div>
      </button>
      <p aria-hidden className={`mt-8 text-sm text-moon/75 transition-opacity duration-300 ${opening ? "opacity-0" : ""}`}>
        <span className="[@media(hover:hover)]:hidden">Tap</span>
        <span className="hidden [@media(hover:hover)]:inline">Click</span> the envelope to open it
      </p>
    </motion.div>
  );
}

function LetterPaper({ memory, onClose }: { memory: Letter; onClose: () => void }) {
  const paper = useRef<HTMLElement>(null);
  const paragraphs = memory.message
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  useEffect(() => {
    paper.current?.focus({ preventScroll: true });
  }, []);

  return (
    <motion.article
      ref={paper}
      tabIndex={-1}
      className="paper-creases relative max-h-[86dvh] w-[min(92vw,34rem)] overflow-y-auto overscroll-contain rounded-[3px] bg-paper px-7 pb-10 pt-12 text-ink shadow-letter outline-none sm:px-12 sm:pt-14"
      initial={{ opacity: 0, y: 36, scale: 0.95, rotate: -1.2 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, y: 24, scale: 0.97 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close letter"
        className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <h2 className="pr-8 font-hand text-[clamp(1.6rem,6vw,2.1rem)] leading-tight">{memory.label}</h2>

      <div className="mt-7 space-y-[1.1em] whitespace-pre-line text-[1.0625rem] leading-[1.8]">
        {paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      {memory.planted && (
        <p className="mt-8 text-right">
          <span className="font-hand text-[1.45rem] leading-none">— {memory.planted.by}</span>
          <span className="mt-1.5 block text-[0.8rem] text-ink/55">
            planted {new Date(memory.planted.on).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </p>
      )}

      {memory.photo && (
        <figure className="mx-auto my-10 w-[86%] -rotate-[1.5deg] bg-white p-2.5 pb-10 shadow-[0_12px_26px_-12px_rgb(20_20_50/0.5)]">
          <Image
            src={memory.photo.src}
            alt={memory.photo.alt}
            width={1200}
            height={900}
            // Planted photos come straight from Supabase Storage, already sized on upload.
            unoptimized={memory.photo.src.startsWith("http")}
            sizes="(max-width: 640px) 80vw, 28rem"
            className="h-auto w-full"
          />
        </figure>
      )}

      {memory.audio && <VoiceNote src={memory.audio.src} title={memory.audio.title} />}

      <div className="mt-10 flex justify-center">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 text-[0.95rem] text-ink/75 underline decoration-ink/25 underline-offset-8 transition-colors hover:text-ink hover:decoration-rose focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
        >
          Close letter
        </button>
      </div>
    </motion.article>
  );
}

function VoiceNote({ src, title }: { src: string; title?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  /** Restores the background music; set while this voice note is playing. */
  const unduck = useRef<(() => void) | null>(null);
  const quietMusic = () => {
    unduck.current ??= duckMusic();
  };
  const restoreMusic = () => {
    unduck.current?.();
    unduck.current = null;
  };

  // Removing an <audio> element doesn't reliably stop it, so pause on close, and bring the music back up.
  useEffect(() => {
    const element = audio.current;
    return () => {
      element?.pause();
      restoreMusic();
    };
  }, []);

  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    // play() rejects if the file is missing or can't be decoded; just leave the button in its play state.
    if (element.paused) element.play().catch(() => setPlaying(false));
    else element.pause();
  };

  return (
    <div className="my-10 flex items-center gap-4 rounded-full bg-ink/[0.06] py-2 pl-2 pr-6">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-paper transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
          {playing ? <path d="M5 4h3.5v12H5zM11.5 4H15v12h-3.5z" /> : <path d="M6 3.5v13l11-6.5z" />}
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.95rem]">{title ?? "Voice note"}</p>
        <div className="mt-2 h-[3px] rounded-full bg-ink/15">
          <div className="h-full rounded-full bg-rose" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          quietMusic();
        }}
        onPause={() => {
          setPlaying(false);
          restoreMusic();
        }}
        onEnded={() => {
          setPlaying(false);
          restoreMusic();
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setProgress(a.duration ? a.currentTime / a.duration : 0);
        }}
      />
    </div>
  );
}
