import { create } from "zustand";

/**
 * Background music: one looping track that starts with the click on "Enter the
 * garden" (browsers only allow sound after a user gesture), quiets down while a
 * letter's voice note plays, and can be muted or turned down at any time.
 *
 * It plays through a plain <audio> element (which streams and loops), routed
 * through a Web Audio gain node for the volume: iPhones ignore `audio.volume`,
 * so without the gain node the music would always play at full volume there.
 */

const SRC = "/audio/bgm.mp3";
export const DEFAULT_VOLUME = 0.35;
/** Share of the chosen volume kept while a voice note plays. */
const DUCKED = 0.2;
const PREFS_KEY = "our-little-garden:music";

interface MusicState {
  /** True once playback has been started by her click. */
  started: boolean;
  /** False if the track is missing or can't be played, which hides the control. */
  available: boolean;
  muted: boolean;
  volume: number;
}

export const useMusic = create<MusicState>()(() => ({
  started: false,
  available: true,
  muted: false,
  volume: DEFAULT_VOLUME,
}));

let audio: HTMLAudioElement | null = null;
let context: AudioContext | null = null;
let gain: GainNode | null = null;
/** How many voice notes are playing right now. */
let ducks = 0;

function targetLevel() {
  const { muted, volume } = useMusic.getState();
  return muted ? 0 : volume * (ducks > 0 ? DUCKED : 1);
}

/** Eases the music toward where it should be, over roughly `seconds`. */
function glide(seconds: number) {
  const level = targetLevel();
  if (gain && context) {
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setTargetAtTime(level, context.currentTime, Math.max(seconds, 0.01) / 3);
  } else if (audio) {
    audio.volume = level;
  }
}

function loadPrefs(): Partial<MusicState> {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    return {
      ...(typeof saved.muted === "boolean" ? { muted: saved.muted } : {}),
      ...(typeof saved.volume === "number" ? { volume: Math.min(1, Math.max(0, saved.volume)) } : {}),
    };
  } catch {
    return {};
  }
}

function savePrefs() {
  const { muted, volume } = useMusic.getState();
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ muted, volume }));
  } catch {
    // Storage unavailable: the setting just won't be remembered next visit.
  }
}

/** Starts the music. Call it straight from a click or key handler, or the browser will block it. */
export function startMusic() {
  if (audio) return;
  useMusic.setState(loadPrefs());
  audio = new Audio(SRC);
  audio.loop = true;
  audio.preload = "auto";
  audio.addEventListener("error", () => useMusic.setState({ available: false }));

  try {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Context) {
      context = new Context();
      gain = context.createGain();
      gain.gain.value = 0;
      context.createMediaElementSource(audio).connect(gain).connect(context.destination);
      void context.resume();
    }
  } catch {
    // No Web Audio: fall back to the element's own volume.
    context = null;
    gain = null;
  }
  if (!gain) audio.volume = 0;

  audio
    .play()
    .then(() => {
      useMusic.setState({ started: true });
      // Fade in gently under the start of the intro.
      glide(3);
    })
    .catch(() => useMusic.setState({ available: false }));

  // Pause while the tab is hidden, and pick up again when she comes back.
  document.addEventListener("visibilitychange", () => {
    if (!audio || !useMusic.getState().started) return;
    if (document.hidden) audio.pause();
    else {
      void context?.resume();
      void audio.play().catch(() => {});
    }
  });
}

export function setMusicMuted(muted: boolean) {
  useMusic.setState({ muted });
  savePrefs();
  glide(0.4);
}

export function setMusicVolume(volume: number) {
  useMusic.setState({ volume, muted: volume === 0 });
  savePrefs();
  glide(0.1);
}

/** Quiets the music while a voice note plays. Returns a function that restores it; safe to call more than once. */
export function duckMusic() {
  ducks++;
  glide(0.6);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    ducks = Math.max(0, ducks - 1);
    glide(1.2);
  };
}
