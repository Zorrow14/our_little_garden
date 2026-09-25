/**
 * The letters behind each flower. This is the only file to edit for the
 * content pass; flower placement and appearance live in the garden components.
 *
 * Photos go in public/images/personal/ and audio in public/audio/personal/
 * (both gitignored). Reference them by URL path, e.g. "/images/personal/beach.jpg".
 *
 * Write `message` as a backtick string; blank lines become paragraph breaks.
 */

import type { PrePlacedFlower } from "@/lib/layout";

export interface Memory {
  /** Stable id, also used to remember which letters have been opened. */
  id: string;
  /** One of the pre-placed flowers (FLOWER_SPOTS in lib/layout.ts). */
  flower: PrePlacedFlower;
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
    message: `Hey. I know right now the distance feels like it's sitting on your chest, and I can't reach through a screen to fix that — believe me, I wish I could.

But think about the lotus for a second. It grows in muddy, murky water, rooted somewhere it can't even see the surface, and it still finds its way up into something beautiful. That's us. The distance is the mud. It's not pretty, it's not what either of us would've chosen, but it's not going to stop what we're growing.

I'm not going anywhere. Every kilometre between us right now is temporary — what I feel for you isn't. Close your eyes for a second and picture me right there with you. I am, just not in the way either of us wants yet. Soon.

I love you. Not from a distance — despite it.`,
  },
  {
    id: "sad",
    flower: "lily",
    label: "Open when you're sad",
    message: `I don't know exactly what's making you sad right now, and that's the hardest part of not being there — I can't just show up and sit with you.

So let me say this instead: you don't have to perform okay for me. Not ever. If you need to cry, be quiet, not talk, whatever it is — I'm still here, still yours, still not going anywhere.

You picked lilies as your favorite for a reason, and I think it's because they don't try too hard to be loud or dramatic — they're just quietly, completely beautiful. That's you when you're sad, too. Still you. Still someone I'm completely in love with, even on the days you feel like the dimmest version of yourself.

This feeling will pass. I'll be here when it does — and honestly, I'm here through it too.

I love you, even on the grey days. Especially on the grey days.`,
  },
  {
    id: "mad-at-me",
    flower: "tulip",
    label: "Open when you're mad at me",
    message: `Okay. First — I'm sorry. Whatever I did, whatever I said, or whatever I didn't do that I should have, I'm sorry. Not the "sorry so we can move on" kind. The actual kind.

I'm not going to pretend I already know exactly what it was, because that would be lying, and you deserve better than that. But I know myself well enough to know I can be careless sometimes, especially about the small things — and the small things matter more when there's an ocean between us and you can't just read my face.

You're allowed to be mad at me. I'd rather you tell me than swallow it. I'm not scared of your anger — I'm scared of you deciding I'm not worth the honesty of it.

So be mad. Then come back and yell at me over a call if you have to. I'll still be here, and I'll still be trying to be better for you.

I love you, even when you're furious with me. Maybe especially then, because it means you still care enough to be.`,
  },
  {
    id: "cant-sleep",
    flower: "rose",
    label: "Open when you can't sleep",
    message: `If you're reading this at 2am, put your phone on the lowest brightness, breathe, and let me talk you down for a second.

Whatever's spinning in your head right now will still be there tomorrow, and you'll actually be able to do something about it then. Right now, your only job is to rest.

Think of somewhere calm — doesn't matter where, just somewhere that feels safe to you. I like to imagine it's somewhere we'll go together one day, whenever the distance finally closes. Hold onto that instead of whatever's keeping you up.

I wish I could just be the warm, boring background noise that helps you fall asleep. Since I can't, let this be that instead: you are loved, you are safe, and nothing urgent needs solving tonight.

Sleep, my love. I'll be here in the morning, same as always.`,
  },
  {
    id: "doubt-us",
    flower: "daisy",
    label: "Open when you doubt us",
    message: `If you're reading this one, something's made you wonder whether this — us, the distance, all of it — is actually worth it.

I get it. Long distance is not romantic in practice the way it sounds in theory. It's missed calls, wrong timezones, hugs you can't actually have. Some days it probably feels easier to imagine it would be simpler with someone who's just... there.

But easier isn't the same as better. I didn't choose you because you were convenient. I chose you because you're you, and there's no version of "easier" I'd trade for that.

I know I'm older than you, and maybe some days that makes you wonder if I've got this figured out more than I do — I promise you I don't. I'm figuring it out right alongside you, one clumsy, long-distance day at a time. That's not a weakness in us. That's just what building something real actually looks like.

We're not perfect. But we're not nothing, either. We're worth the hard parts.`,
  },
  {
    id: "miss-me",
    flower: "orchid",
    label: "Open when you miss me",
    message: `I miss you too. Right now, probably. Statistically, it's a safe bet.

I miss the specific things — your laugh when something's actually funny versus when you're just being polite, the way you talk faster when you're excited about something, the version of your voice that only shows up right when you wake up.

Missing you isn't a malfunction, even though it feels heavy sometimes. It's just proof that what we have is real enough to leave a shape when it's not right in front of you.

Let yourself miss me for a minute. Then remember: every day that passes is a day closer to not having to. This isn't forever. It's just right now.

I miss you back, in every language I know how to say it.`,
  },
  {
    // Reserved for last: only blooms once the other six have been opened.
    id: "just-because",
    flower: "final",
    label: "Open anytime, just because",
    message: `If you've made it here, you've opened every other flower in this garden — thank you for going through all of them, and for being the reason I wanted to build this in the first place.

There's no emergency reason to open this one. No sadness, no fight, no sleepless night. Just — I love you, on a completely ordinary day, for no reason other than that it's true.

You are, without question, the best thing that's grown out of any version of my life so far. Long distance is hard, but you've never once been hard to love. That part has always been the easiest thing about all of this.

This garden will keep growing as long as we do. So will I — for you, toward you, always in your direction, no matter how many kilometres are in between.

I love you. Just because.`,
  },
];
