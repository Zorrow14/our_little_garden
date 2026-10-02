import { useEffect, useState } from "react";
import { useGardenStore } from "@/lib/gardenStore";

/**
 * The lighthouse's countdown to the next time you see each other.
 *
 * To turn it on, set NEXT_VISIT_DATE and redeploy. Write it as an ISO date and
 * time with its time zone, e.g. "2026-12-20T15:00:00+08:00", so it's the same
 * moment wherever each of you opens the garden. Leave it null for no
 * countdown: the lighthouse just turns its light, its lamp inside unlit.
 *
 * Nothing else needs changing. Everything that shows the countdown asks
 * `countdown()` and handles all three states, whether a date is set or not.
 */
export const NEXT_VISIT_DATE: string | null = null;

export type Countdown =
  /** No date set. */
  | { state: "unset" }
  /** Still to come: whole days and hours left. */
  | { state: "counting"; days: number; hours: number; minutes: number }
  /** The day has come (and stays come until a new date is set). */
  | { state: "arrived" };

const HOUR = 60 * 60 * 1000;

export function countdown(now = Date.now(), date = NEXT_VISIT_DATE): Countdown {
  const at = date ? Date.parse(date) : NaN;
  if (Number.isNaN(at)) return { state: "unset" };
  const left = at - now;
  if (left <= 0) return { state: "arrived" };
  return {
    state: "counting",
    days: Math.floor(left / (24 * HOUR)),
    hours: Math.floor((left % (24 * HOUR)) / HOUR),
    minutes: Math.ceil((left % HOUR) / 60000),
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "12 days and 5 hours", "5 hours", "40 minutes". */
function timeLeft(c: Extract<Countdown, { state: "counting" }>) {
  if (c.days > 0) return c.hours > 0 ? `${plural(c.days, "day")} and ${plural(c.hours, "hour")}` : plural(c.days, "day");
  if (c.hours > 0) return plural(c.hours, "hour");
  return plural(Math.max(1, c.minutes), "minute");
}

/** What the lighthouse says when you come near or click its lamp, or null to say nothing. */
export function countdownNotice(c: Countdown): string | null {
  if (c.state === "counting") return `${timeLeft(c)} until we see each other again.`;
  if (c.state === "arrived") return "The day is here. We're together.";
  return null;
}

/** The second line of the lamp's tag: short, and gentle when there's no date. */
export function countdownNote(c: Countdown) {
  if (c.state === "counting") return `${timeLeft(c)} to go`;
  if (c.state === "arrived") return "together at last";
  return "waiting to be lit";
}

/** The countdown as it stands, checked again every half minute. */
export function useCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return countdown(now);
}

/** Says the countdown in the usual notice, if there's anything to say. */
export function announceCountdown() {
  const text = countdownNotice(countdown());
  if (text) useGardenStore.setState({ notice: text });
}
