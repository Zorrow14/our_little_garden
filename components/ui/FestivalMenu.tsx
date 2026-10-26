"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { LAMP_CAP, litBy, useLamps } from "@/lib/festivalLamps";
import { useFestival } from "@/lib/festivals";
import { LAUNCH_EVERY, launchFirework, pressLightTogether, TOGETHER_WINDOW, useLightTogether } from "@/lib/fireworks";
import { setFireworkSound, useFireworkSound } from "@/lib/fireworkSound";
import { useGardenStore } from "@/lib/gardenStore";
import { openKeepsake, useKeepsakes } from "@/lib/keepsakes";
import { player } from "@/lib/playerInput";
import { payRespects, usePresence } from "@/lib/presence";
import { useZone } from "@/lib/zones";

/**
 * The festival's corner menu (bottom right, clear of the joystick): light a
 * lamp, launch a firework, light together, pay respects, and whether
 * fireworks make a sound. Only while a festival is on; the garden-only
 * actions only in the garden.
 */
export default function FestivalMenu() {
  const festival = useFestival((s) => s.festival);
  const free = useGardenStore((s) => s.hydrated && s.stage === "garden" && !s.activeId && !s.celebrating);
  const panelOpen = useKeepsakes((s) => s.open !== null);
  const me = usePresence((s) => s.me);
  const zone = useZone((s) => s.zone);
  const leaving = useZone((s) => s.leaving !== null);
  const [open, setOpen] = useState(false);
  const shown = !!festival && free && !panelOpen && !!me && !leaving;

  useEffect(() => {
    if (!shown) setOpen(false);
  }, [shown]);

  return (
    <AnimatePresence>
      {shown && festival && (
        <motion.div
          key="festival"
          className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-end gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.5 }}
        >
          <AnimatePresence>{open && <Menu key="menu" inGarden={zone === "garden"} onDone={() => setOpen(false)} />}</AnimatePresence>
          <WaitingForThem />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={`${festival.name}: light a lamp, fireworks, pay respects`}
            className="flex h-11 items-center gap-2 rounded-full bg-night/60 px-3 text-[0.9rem] text-moon/90 ring-1 ring-lantern/35 backdrop-blur-sm transition-colors hover:bg-night/75 hover:text-moon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lantern sm:pl-3 sm:pr-4"
          >
            <LanternIcon className="h-5 w-5 text-lantern" />
            <span className="hidden sm:inline">{festival.name}</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Menu({ inGarden, onDone }: { inGarden: boolean; onDone: () => void }) {
  const festival = useFestival((s) => s.festival)!;
  const me = usePresence((s) => s.me);
  const lamps = useLamps((s) => s.lamps);
  const sound = useFireworkSound((s) => s.on);
  const waiting = useLightTogether((s) => s.waitingSince !== null);
  const [cooling, setCooling] = useState(false);
  const cool = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => (cool.current ? clearTimeout(cool.current) : undefined), []);
  const mine = litBy(lamps, me);

  const launch = () => {
    const at = player.active ? { x: player.x, z: player.z } : { x: 0, z: -2 };
    if (!launchFirework(at, festival.theme.glow.length)) return;
    setCooling(true);
    cool.current = setTimeout(() => setCooling(false), LAUNCH_EVERY * 1000);
    // Out of the way of the view as it looks up.
    onDone();
  };

  return (
    <motion.div
      role="menu"
      aria-label={festival.name}
      className="w-[min(17rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-night/80 p-1.5 text-moon/90 ring-1 ring-moon/20 backdrop-blur-md"
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.25 }}
    >
      {inGarden && (
        <>
          <Item
            icon={<LampIcon />}
            label={festival.theme.lamp.action}
            note={mine >= LAMP_CAP ? `All ${LAMP_CAP} of yours are lit` : `${mine} of ${LAMP_CAP} lit, where you stand`}
            disabled={mine >= LAMP_CAP}
            onClick={() => {
              onDone();
              openKeepsake("lamp");
            }}
          />
          <Item icon={<BurstIcon />} label="Launch a firework" note={cooling ? "Ready again in a moment" : "Up over your gardener"} disabled={cooling} onClick={launch} />
          <Item
            icon={<TogetherIcon />}
            label="Light together"
            note={waiting ? "Waiting for them…" : `Both press within ${TOGETHER_WINDOW / 1000} seconds`}
            disabled={waiting}
            onClick={() => {
              pressLightTogether();
              onDone();
            }}
          />
        </>
      )}
      <Item
        icon={<RespectsIcon />}
        label="Pay respects"
        note="A bow, hands together"
        onClick={() => {
          payRespects();
          onDone();
        }}
      />
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={sound}
        onClick={() => setFireworkSound(!sound)}
        className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[0.82rem] text-moon/70 transition-colors hover:bg-moon/10 hover:text-moon focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern"
      >
        Firework sounds
        <span className={`rounded-full px-2 py-0.5 text-[0.75rem] ${sound ? "bg-lantern/25 text-lantern" : "bg-moon/10 text-moon/60"}`}>{sound ? "On" : "Off"}</span>
      </button>
    </motion.div>
  );
}

function Item({ icon, label, note, onClick, disabled }: { icon: ReactNode; label: string; note: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-moon/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lantern/15 text-lantern">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.95rem] leading-tight text-moon">{label}</span>
        <span className="block text-[0.78rem] leading-snug text-moon/60">{note}</span>
      </span>
    </button>
  );
}

/** After you press "Light together": who you're waiting for, and how long they've got. */
function WaitingForThem() {
  const since = useLightTogether((s) => s.waitingSince);
  const partner = useLightTogether((s) => s.partner);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [since]);
  if (since === null) return null;
  const left = Math.max(0, Math.ceil((TOGETHER_WINDOW - (now - since)) / 1000));
  return (
    <div role="status" className="rounded-full bg-night/70 px-3.5 py-1.5 text-[0.85rem] text-moon/90 ring-1 ring-lantern/30 backdrop-blur-sm">
      Waiting for {partner}… <span className="tabular-nums text-lantern">{left}</span>
    </div>
  );
}

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** A paper lantern on its string. */
function LanternIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" {...STROKE}>
      <path d="M10 1.5v2.5" />
      <path d="M7.5 4h5M7.5 16h5" />
      <path d="M7.5 4.2C4.6 5.8 4.6 14.2 7.5 15.8h5c2.9-1.6 2.9-10 0-11.6z" fill="currentColor" fillOpacity="0.25" />
      <path d="M10 4.2v11.6M7.4 6.5c-.8 2.2-.8 4.8 0 7M12.6 6.5c.8 2.2.8 4.8 0 7" strokeWidth="1" />
      <path d="M10 16v2.5" />
    </svg>
  );
}

/** A small clay oil lamp with its flame. */
function LampIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true" {...STROKE}>
      <path d="M10 3.5c1.6 1.8 1.8 3.4 0 5-1.8-1.6-1.6-3.2 0-5z" fill="currentColor" fillOpacity="0.45" />
      <path d="M3.5 11.5h13c-.5 2.8-3.2 4.5-6.5 4.5s-6-1.7-6.5-4.5z" />
    </svg>
  );
}

/** A firework bursting. */
function BurstIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true" {...STROKE}>
      <path d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3M4.7 4.7l2.1 2.1M13.2 13.2l2.1 2.1M15.3 4.7l-2.1 2.1M6.8 13.2l-2.1 2.1" />
      <circle cx="10" cy="10" r="1.2" fill="currentColor" />
    </svg>
  );
}

/** Two flames side by side. */
function TogetherIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true" {...STROKE}>
      <path d="M7 4c2 2.4 2.3 4.6 0 6.7C4.7 8.6 5 6.4 7 4z" fill="currentColor" fillOpacity="0.4" />
      <path d="M13 4c2 2.4 2.3 4.6 0 6.7-2.3-2.1-2-4.3 0-6.7z" fill="currentColor" fillOpacity="0.4" />
      <path d="M4 14.5h12M6 17h8" />
    </svg>
  );
}

/** Hands pressed together. */
function RespectsIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true" {...STROKE}>
      <path d="M10 3.5c-1 1.2-1.6 3-1.6 5.2v4.8L6 16.5M10 3.5c1 1.2 1.6 3 1.6 5.2v4.8l2.4 3" />
      <path d="M10 3.5v11" />
    </svg>
  );
}
