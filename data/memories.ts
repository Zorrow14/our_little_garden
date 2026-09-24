/**
 * The letters behind each flower. This is the only file to edit for the
 * content pass; flower placement and appearance live in the garden components.
 *
 * Photos go in public/images/personal/ and audio in public/audio/personal/
 * (both gitignored). Reference them by URL path, e.g. "/images/personal/beach.jpg".
 *
 * Write `message` as a backtick string; blank lines become paragraph breaks.
 */

export type FlowerKind =
  | "lotus"
  | "lily"
  | "tulip"
  | "rose"
  | "daisy"
  | "orchid"
  | "final";

export interface Memory {
  /** Stable id, also used to remember which letters have been opened. */
  id: string;
  flower: FlowerKind;
  /** Shown on hover, and before the envelope opens. */
  label: string;
  message: string;
  photo?: { src: string; alt: string };
  audio?: { src: string; title?: string };
}

export const memories: Memory[] = [
  {
    id: "far-from-me",
    flower: "lotus",
    label: "Open when you feel far from me",
    message: `Placeholder letter.`,
  },
  {
    id: "sad",
    flower: "lily",
    label: "Open when you're sad",
    message: `Placeholder letter.`,
  },
  {
    id: "mad-at-me",
    flower: "tulip",
    label: "Open when you're mad at me",
    message: `Placeholder letter.`,
  },
  {
    id: "cant-sleep",
    flower: "rose",
    label: "Open when you can't sleep",
    message: `Placeholder letter.`,
  },
  {
    id: "doubt-us",
    flower: "daisy",
    label: "Open when you doubt us",
    message: `Placeholder letter.`,
  },
  {
    id: "miss-me",
    flower: "orchid",
    label: "Open when you miss me",
    message: `Placeholder letter.`,
  },
  {
    // Reserved for last: only blooms once the other six have been opened.
    id: "just-because",
    flower: "final",
    label: "Open anytime, just because",
    message: `Placeholder letter.`,
  },
];
