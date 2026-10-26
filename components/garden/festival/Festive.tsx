"use client";

import { useFestival } from "@/lib/festivals";
import FestivalDecorations from "./Decorations";
import Fireworks from "./Fireworks";
import Lamps from "./Lamps";

/**
 * Everything festive in the garden, while a festival is on: its decorations,
 * the lamps you've lit, and the fireworks. Nothing at all otherwise, so when
 * a festival ends it all goes with it.
 */
export default function Festive() {
  const festival = useFestival((s) => s.festival);
  if (!festival) return null;
  return (
    <>
      <FestivalDecorations festival={festival} />
      <Lamps festival={festival} />
      <Fireworks festival={festival} />
    </>
  );
}
