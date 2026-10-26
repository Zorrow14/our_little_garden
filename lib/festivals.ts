import { create } from "zustand";

/**
 * Seasonal festivals: while one is on, the garden is dressed for it (warm dusk,
 * lanterns and candles, lamps you can light together, fireworks) and greets
 * you on the way in. Each festival is one entry in `FESTIVALS`, with its dates
 * in Myanmar time and its theme.
 *
 * To add one (Tazaungdaing, say), add an entry. Nothing else needs to change:
 * everything festive asks `useFestival` which festival is on, if any, and
 * reads its theme.
 *
 * `?festival=<id>` in the URL turns a festival on regardless of the date (to
 * test it, or to show it after it's over); `?festival=off` turns festivals off.
 * Plain data, no three.js, so the UI can use it.
 */

export interface FestivalTheme {
  /** The sky at warm dusk: top, horizon, and below the horizon. */
  sky: { top: string; horizon: string; below: string };
  /** The hemisphere light's sky and ground colours, and the moonlight's. */
  light: { sky: string; ground: string; moon: string };
  /** The colours of the lanterns, string lights and fireworks. */
  glow: string[];
  /** The greeting shown on the way in: in Burmese, then in English. */
  greeting: { native: string; english: string };
  /** What lighting a lamp is called, for its button and notices. */
  lamp: { action: string; noun: string };
}

export interface Festival {
  id: string;
  name: string;
  /** When it starts and ends, as ISO date-times with their offset. */
  starts: string;
  ends: string;
  theme: FestivalTheme;
}

/** Myanmar time is UTC+6:30. */
export const FESTIVALS: Festival[] = [
  {
    // The Festival of Lights, at the full moon of Thadingyut: the end of the
    // Buddhist Lent, when homes and pagodas are lit with candles and lamps and
    // younger people pay respects to their elders. One day longer than the
    // festival itself, to enjoy it a little after.
    id: "thadingyut",
    name: "Thadingyut",
    starts: "2026-10-25T00:00:00+06:30",
    ends: "2026-10-28T23:59:59+06:30",
    theme: {
      sky: { top: "#141238", horizon: "#8a4a5c", below: "#2a1a2c" },
      light: { sky: "#f2b48a", ground: "#2e2420", moon: "#ffd6b0" },
      glow: ["#ffd27a", "#ffb35c", "#ff9a6a", "#fff1d2", "#f4a6b8", "#c9a2ff"],
      greeting: { native: "သီတင်းကျွတ်ပွဲတော် မင်္ဂလာရှိပါစေ", english: "Happy Thadingyut" },
      lamp: { action: "Light a lamp", noun: "lamp" },
    },
  },
];

export const festivalById = (id: string) => FESTIVALS.find((f) => f.id === id) ?? null;

/** The festival on at `now`, by its dates. */
export function festivalAt(now: number): Festival | null {
  return FESTIVALS.find((f) => now >= Date.parse(f.starts) && now <= Date.parse(f.ends)) ?? null;
}

/** What `?festival=` asks for: a festival, "off", or nothing (go by the date). */
function urlOverride(): Festival | "off" | null {
  if (typeof window === "undefined") return null;
  const asked = new URLSearchParams(window.location.search).get("festival");
  if (!asked) return null;
  if (asked === "off" || asked === "none") return "off";
  return festivalById(asked);
}

interface FestivalState {
  /** The festival on right now, or null. */
  festival: Festival | null;
}

export const useFestival = create<FestivalState>()(() => ({ festival: null }));

/** The festival that should be on now, URL override first. */
function current(): Festival | null {
  const override = urlOverride();
  if (override === "off") return null;
  return override ?? festivalAt(Date.now());
}

/**
 * Decides which festival is on, and checks again every minute, so the garden
 * dresses itself when one starts and undresses when it ends, without a reload.
 */
export function startFestivalClock() {
  const check = () => {
    const next = current();
    if (next?.id !== useFestival.getState().festival?.id) useFestival.setState({ festival: next });
  };
  check();
  const timer = setInterval(check, 60_000);
  return () => clearInterval(timer);
}
