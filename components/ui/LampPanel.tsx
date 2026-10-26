"use client";

import { type FormEvent, useId, useState } from "react";
import { DEDICATION_MAX, LAMP_CAP, lightLamp, litBy, useLamps } from "@/lib/festivalLamps";
import { useFestival } from "@/lib/festivals";
import { useGardenStore } from "@/lib/gardenStore";
import { closeKeepsake } from "@/lib/keepsakes";
import { planting } from "@/lib/plantStore";
import { player } from "@/lib/playerInput";
import { usePresence } from "@/lib/presence";
import { useZone } from "@/lib/zones";
import { Gate, GhostButton, INPUT, PrimaryButton } from "./PlantPanel";

/** A lamp goes down this far in front of your gardener's feet, so it isn't lit underfoot. */
const IN_FRONT = 0.45;

/**
 * Lighting a lamp during a festival: the passcode once per device (the same
 * as for notes and planting), then an optional dedication, and the lamp is lit
 * where your gardener stands, for both of you to see.
 */
export default function LampPanel({ titleId }: { titleId: string }) {
  const festival = useFestival((s) => s.festival);
  const me = usePresence((s) => s.me);
  const lamps = useLamps((s) => s.lamps);
  const [unlocked, setUnlocked] = useState(planting.isUnlocked);
  const inGarden = useZone((s) => s.zone === "garden");

  if (!festival) return <Note>The festival is over for this year. The lamps will be lit again next time.</Note>;
  if (!me) return <Note>Choose who you are first, so the lamp knows who lit it.</Note>;
  if (!inGarden) return <Note>Lamps are lit out in the garden.</Note>;

  const mine = litBy(lamps, me);
  if (mine >= LAMP_CAP) {
    return <Note>You&apos;ve lit all {LAMP_CAP} of your lamps for {festival.name}. They&apos;re glowing in the garden.</Note>;
  }

  return (
    <div className="space-y-4">
      {unlocked ? (
        <LampForm festivalId={festival.id} me={me} lit={mine} />
      ) : (
        <Gate
          titleId={`${titleId}-gate`}
          title="Our passcode"
          prompt="Whisper our passcode to light a lamp here."
          onUnlock={() => {
            planting.rememberUnlock();
            setUnlocked(true);
          }}
          onCancel={closeKeepsake}
        />
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="leading-relaxed text-ink/75">{children}</p>
      <div className="flex justify-end">
        <GhostButton onClick={closeKeepsake}>Close</GhostButton>
      </div>
    </div>
  );
}

function LampForm({ festivalId, me, lit }: { festivalId: string; me: "Zorrow" | "Skelly"; lit: number }) {
  const [dedication, setDedication] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!player.active) {
      setError("Your gardener needs to be out in the garden to light it.");
      return;
    }
    setBusy(true);
    setError(null);
    const x = player.x + Math.sin(player.yaw) * IN_FRONT;
    const z = player.z + Math.cos(player.yaw) * IN_FRONT;
    try {
      await lightLamp(festivalId, me, dedication, x, z);
      closeKeepsake();
      useGardenStore.setState({ notice: "Your lamp is lit." });
    } catch {
      setError(lit + 1 >= LAMP_CAP ? `That's all ${LAMP_CAP} of your lamps.` : "The lamp wouldn't light. Check the connection and try again?");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <p className="leading-relaxed text-ink/75">
        It&apos;s lit just in front of where you stand, for both of you to see. You can add a few words for whoever or whatever it&apos;s for.
      </p>
      <label htmlFor={`${id}-dedication`} className="mt-5 block text-[0.82rem] uppercase tracking-[0.12em] text-ink/60">
        For (optional)
      </label>
      <input
        id={`${id}-dedication`}
        value={dedication}
        maxLength={DEDICATION_MAX}
        onChange={(e) => setDedication(e.target.value)}
        placeholder="For our families"
        className={`${INPUT} font-hand text-[1.2rem]`}
        disabled={busy}
        autoComplete="off"
      />
      <p role="alert" className="mt-1.5 min-h-[1.1rem] text-[0.85rem] text-[#a3324f]">
        {error}
      </p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.8rem] text-ink/50">
          {lit} of {LAMP_CAP} lit
        </span>
        <div className="flex items-center gap-1">
          <GhostButton onClick={closeKeepsake}>Not now</GhostButton>
          <PrimaryButton disabled={busy}>{busy ? "Lighting…" : "Light it"}</PrimaryButton>
        </div>
      </div>
    </form>
  );
}
