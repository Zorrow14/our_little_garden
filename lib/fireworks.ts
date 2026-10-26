import { create } from "zustand";
import { useFestival } from "@/lib/festivals";
import { useGardenStore } from "@/lib/gardenStore";
import { type GardenerName, onFirework, onLightTogether, sendFirework, sendLightTogether, usePresence } from "@/lib/presence";
import { useZone } from "@/lib/zones";

/**
 * Fireworks over the garden during a festival, as plain data: what's been
 * asked for, waiting for the scene (`components/garden/festival/Fireworks`)
 * to launch it. They come from three places:
 *
 * - now and then on their own, to keep the sky alive (the scene does these);
 * - "Launch a firework", one over your gardener, at most every 2 seconds,
 *   shown on the other device too;
 * - "Light together": when you both press it within `TOGETHER_WINDOW` of
 *   each other, both devices play the same finale and every lantern brightens.
 *
 * Fireworks from the other device only play while you're in the garden.
 */

export const BURST_STYLES = ["round", "ring", "willow"] as const;
export type BurstStyle = (typeof BURST_STYLES)[number];

export interface BurstRequest {
  x: number;
  z: number;
  /**
   * Yours and the finale: the camera looks up to watch, so it bursts at its
   * full height there. Otherwise it's fitted into whatever sky is in view.
   */
  watched?: boolean;
  style: BurstStyle;
  /** Into the festival's glow colours. */
  colorIndex: number;
  /** A big one goes higher and wider. */
  big: boolean;
  /** Seconds to wait before it goes up. */
  delay: number;
  /** Turns every lantern up as it goes (the finale's first). */
  boost?: boolean;
}

/** Waiting to go up; the scene takes them from the front. */
export const fireworkQueue: BurstRequest[] = [];

/**
 * Asks the garden's camera to look up at the sky over (x, z) until `until`
 * (on `Date.now()`'s clock), to watch your firework or the finale, then
 * settle back. Null when there's nothing to watch.
 */
export const useFireworkView = create<{ focus: { x: number; z: number } | null; until: number }>()(() => ({ focus: null, until: 0 }));

function watch(focus: { x: number; z: number }, seconds: number) {
  const until = Math.max(useFireworkView.getState().until, Date.now() + seconds * 1000);
  useFireworkView.setState({ focus, until });
}

/** Seconds between your own launches. */
export const LAUNCH_EVERY = 2;
/** How long one of you can wait for the other to press "Light together". */
export const TOGETHER_WINDOW = 10_000;
/** A little longer for a press already sent, so one that only just made it isn't lost on the way. */
const GRACE = 1500;

let lastLaunch = 0;

const festivalOn = () => useFestival.getState().festival !== null;
const inGarden = () => useZone.getState().zone === "garden";

/** Launches a firework over (x, z), here and on the other device. False if it's too soon after the last. */
export function launchFirework(at: { x: number; z: number }, colorCount: number) {
  const now = performance.now();
  if (!festivalOn() || now - lastLaunch < LAUNCH_EVERY * 1000) return false;
  lastLaunch = now;
  const style = Math.floor(Math.random() * BURST_STYLES.length);
  const colorIndex = Math.floor(Math.random() * colorCount);
  fireworkQueue.push({ x: at.x, z: at.z, style: BURST_STYLES[style], colorIndex, big: false, delay: 0, watched: true });
  watch(at, 4.5);
  sendFirework({ x: at.x, z: at.z, style, colorIndex, sent: Date.now() });
  return true;
}

/** A small seeded random, so both devices play the same finale. */
function seeded(seed: number) {
  let s = Math.floor(Math.abs(seed)) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** The finale for lighting together: a run of big bursts all over the garden, the lanterns turned up as it starts. */
function finale(seed: number) {
  const rand = seeded(seed);
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const r = 2 + rand() * 7;
    fireworkQueue.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r - 1,
      style: BURST_STYLES[i % BURST_STYLES.length],
      colorIndex: Math.floor(rand() * 6),
      big: true,
      delay: i * 0.55 + rand() * 0.3,
      boost: i === 0,
      watched: true,
    });
  }
  watch({ x: 0, z: -1 }, 9);
}

// ---------------------------------------------------------------------------
// Lighting together.

interface TogetherState {
  /** When you pressed (on this device's clock), while waiting for them. */
  waitingSince: number | null;
  /** Who you're waiting for. */
  partner: GardenerName | null;
}

export const useLightTogether = create<TogetherState>()(() => ({ waitingSince: null, partner: null }));

/** Their press, kept until yours comes or it's too late: when it arrived here, and when they sent it. */
let theirs: { at: number; sent: number } | null = null;
/** Your own press: when, here, and as sent. */
let yours: { at: number; sent: number } | null = null;
let expiry: ReturnType<typeof setTimeout> | null = null;

const partnerOf = (me: GardenerName | null): GardenerName => (me === "Skelly" ? "Zorrow" : "Skelly");

function together(mine: number, their: number) {
  if (expiry) clearTimeout(expiry);
  expiry = null;
  yours = null;
  theirs = null;
  useLightTogether.setState({ waitingSince: null, partner: null });
  if (!festivalOn() || !inGarden()) return;
  finale(mine + their);
  useGardenStore.setState({ notice: "Lit together." });
}

/** "Light together": if they've just pressed too, the finale plays; otherwise wait a little for them. */
export function pressLightTogether() {
  if (!festivalOn()) return;
  const me = usePresence.getState().me;
  const now = Date.now();
  const sent = now;
  if (!sendLightTogether(sent)) {
    useGardenStore.setState({ notice: "Not connected right now, so this can't reach them. Try again in a moment?" });
    return;
  }
  if (theirs && now - theirs.at <= TOGETHER_WINDOW) {
    together(sent, theirs.sent);
    return;
  }
  yours = { at: now, sent };
  const partner = partnerOf(me);
  useLightTogether.setState({ waitingSince: now, partner });
  if (expiry) clearTimeout(expiry);
  expiry = setTimeout(() => {
    yours = null;
    useLightTogether.setState({ waitingSince: null, partner: null });
    useGardenStore.setState({ notice: `${partner} didn't press in time. Try again together?` });
  }, TOGETHER_WINDOW + GRACE);
}

/** Listens for the other device's fireworks and presses. Runs once for the life of the page. */
export function startFireworkSync() {
  const offFirework = onFirework((m) => {
    if (!festivalOn() || !inGarden()) return;
    const style = BURST_STYLES[Math.abs(m.style) % BURST_STYLES.length];
    fireworkQueue.push({ x: m.x, z: m.z, style, colorIndex: Math.abs(m.colorIndex), big: false, delay: 0 });
  });
  const offTogether = onLightTogether((m) => {
    if (!festivalOn()) return;
    const now = Date.now();
    if (yours && now - yours.at <= TOGETHER_WINDOW + GRACE) {
      together(yours.sent, m.sent);
      return;
    }
    theirs = { at: now, sent: m.sent };
    useGardenStore.setState({
      notice: inGarden()
        ? `${m.from} wants to light together. Press "Light together" in the next few seconds.`
        : `${m.from} wants to light together, out in the garden.`,
    });
  });
  // When a festival ends, nothing's left waiting.
  const offFestival = useFestival.subscribe((s) => {
    if (s.festival) return;
    fireworkQueue.length = 0;
    useFireworkView.setState({ focus: null, until: 0 });
    yours = null;
    theirs = null;
    if (expiry) clearTimeout(expiry);
    useLightTogether.setState({ waitingSince: null, partner: null });
  });
  return () => {
    offFirework();
    offTogether();
    offFestival();
  };
}
