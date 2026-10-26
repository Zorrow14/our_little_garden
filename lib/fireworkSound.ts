import { create } from "zustand";
import { duckMusic, useMusic } from "@/lib/music";

/**
 * A soft sound for each firework: a low thump and a fizz, made on the spot
 * with Web Audio (no files). Off until you turn it on, silent whenever the
 * music is muted, and the music dips a little under it.
 */

const PREF_KEY = "our-little-garden:firework-sound";

function readPref() {
  try {
    return localStorage.getItem(PREF_KEY) === "on";
  } catch {
    return false;
  }
}

export const useFireworkSound = create<{ on: boolean }>()(() => ({ on: false }));

let context: AudioContext | null = null;
/** How loud, at most, before distance softens it. */
const LEVEL = 0.22;

function audio() {
  if (context) return context;
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  context = new Context();
  return context;
}

/** Remembers the choice from last time. If it was on, the first tap or key press lets the audio start. */
export function loadFireworkSound() {
  useFireworkSound.setState({ on: readPref() });
  const wake = () => {
    if (useFireworkSound.getState().on) void audio()?.resume();
  };
  window.addEventListener("pointerdown", wake, { once: true });
  window.addEventListener("keydown", wake, { once: true });
}

/** Turns the sound on or off. Called from a click, which lets the audio start on phones. */
export function setFireworkSound(on: boolean) {
  useFireworkSound.setState({ on });
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // Not remembered next time, then.
  }
  if (on) void audio()?.resume();
}

let noise: AudioBuffer | null = null;
function noiseBuffer(ctx: AudioContext) {
  if (noise) return noise;
  noise = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

let releaseDuck: (() => void) | null = null;
let duckTimer: ReturnType<typeof setTimeout> | null = null;

/** One burst, `distance` units from the camera (further is quieter and duller), a bigger one deeper. */
export function playBurst(distance: number, big: boolean) {
  if (!useFireworkSound.getState().on || useMusic.getState().muted || document.hidden) return;
  const ctx = audio();
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  const near = Math.max(0.25, Math.min(1, 14 / Math.max(distance, 1)));
  const out = ctx.createGain();
  out.gain.value = LEVEL * near * (big ? 1.2 : 0.8);
  out.connect(ctx.destination);

  // The thump: a falling low tone.
  const thump = ctx.createOscillator();
  const thumpGain = ctx.createGain();
  thump.frequency.setValueAtTime(big ? 120 : 160, now);
  thump.frequency.exponentialRampToValueAtTime(40, now + 0.35);
  thumpGain.gain.setValueAtTime(0.9, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  thump.connect(thumpGain).connect(out);
  thump.start(now);
  thump.stop(now + 0.55);

  // The fizz of sparks: filtered noise, fading slowly.
  const fizz = ctx.createBufferSource();
  fizz.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2400 * near + 600;
  filter.Q.value = 0.8;
  const fizzGain = ctx.createGain();
  fizzGain.gain.setValueAtTime(0.0001, now);
  fizzGain.gain.exponentialRampToValueAtTime(0.35, now + 0.05);
  fizzGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
  fizz.connect(filter).connect(fizzGain).connect(out);
  fizz.start(now);
  fizz.stop(now + 1.5);
  fizz.onended = () => out.disconnect();

  // Dip the music a little while it rings out.
  if (!releaseDuck) releaseDuck = duckMusic(0.7);
  if (duckTimer) clearTimeout(duckTimer);
  duckTimer = setTimeout(() => {
    releaseDuck?.();
    releaseDuck = null;
  }, 1600);
}
