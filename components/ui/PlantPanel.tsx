"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { FLOWER_REGISTRY, type FlowerType } from "@/lib/flowerSpecs";
import { useGardenStore } from "@/lib/gardenStore";
import { plantLetter, planting, usePlantStore } from "@/lib/plantStore";
import { useMusic } from "@/lib/music";
import { checkPasscode, PLANT_KINDS } from "@/lib/plants";
import { usePresence } from "@/lib/presence";
import { useZone } from "@/lib/zones";

/** What the label field starts as, before a flower's suggestion or her own words replace it. */
const BLANK_LABEL = "Open when ";

/** Matches the storage bucket's limit. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const LABEL_IDEAS = [
  "Open when you need a laugh",
  "Open when you're proud of yourself",
  "Open when you can't stop smiling",
  "Open when it's been a long day",
  "Open when you need a hug",
  "Open when you need a friend",
];

/** The "Plant something" button, and the gate and form it opens. */
export default function PlantPanel() {
  const inGarden = useZone((s) => s.zone === "garden" && !s.leaving);
  const visible = useGardenStore((s) => s.hydrated && s.stage === "garden" && !s.activeId && !s.celebrating) && inGarden;
  const formOpen = usePlantStore((s) => s.formOpen);
  const openForm = usePlantStore((s) => s.openForm);
  // Sits just left of the music button when that's showing.
  const beside = useMusic((s) => s.started && s.available);

  return (
    <>
      <AnimatePresence>
        {visible && !formOpen && (
          <motion.button
            key="plant-button"
            type="button"
            onClick={openForm}
            className={`absolute ${beside ? "right-[4.25rem]" : "right-4"} top-[max(1rem,env(safe-area-inset-top))] z-30 flex items-center gap-2 rounded-full bg-night/55 py-2 pl-3 pr-4 text-[0.9rem] text-moon/90 ring-1 ring-moon/20 backdrop-blur-sm transition-colors hover:bg-night/75 hover:text-moon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lantern`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.5 }}
          >
            <SproutIcon className="h-4 w-4" />
            Plant something
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>{formOpen && <PlantDialog key="plant-dialog" />}</AnimatePresence>
    </>
  );
}

function PlantDialog() {
  const closeForm = usePlantStore((s) => s.closeForm);
  const [unlocked, setUnlocked] = useState(planting.isUnlocked);
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeForm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeForm]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 pb-4 pt-[4.5rem] sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      transition={{ duration: 0.4 }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(14_22_48/0.5),rgb(6_9_22/0.88))]"
        onClick={closeForm}
      />
      <motion.div
        className="paper-creases relative max-h-[88dvh] w-[min(92vw,30rem)] overflow-y-auto overscroll-contain rounded-[3px] bg-paper px-6 pb-7 pt-8 text-ink shadow-letter sm:px-9"
        initial={{ y: 30, rotate: -1, scale: 0.97 }}
        animate={{ y: 0, rotate: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <button
          type="button"
          onClick={closeForm}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
            <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        {unlocked ? (
          <PlantForm titleId={titleId} onDone={closeForm} />
        ) : (
          <Gate
            titleId={titleId}
            onUnlock={() => {
              planting.rememberUnlock();
              setUnlocked(true);
            }}
            onCancel={closeForm}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

function Gate({ titleId, onUnlock, onCancel }: { titleId: string; onUnlock: () => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus({ preventScroll: true }), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setChecking(true);
    try {
      if (await checkPasscode(code)) onUnlock();
      else {
        setError("That's not it. Try again?");
        input.current?.select();
      }
    } catch {
      setError("Planting only works over a secure (https) connection.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h2 id={titleId} className="pr-8 font-hand text-[clamp(1.6rem,6vw,2rem)] leading-tight">
        The garden gate
      </h2>
      <p className="mt-3 text-[0.98rem] leading-relaxed text-ink/75">Whisper our passcode to plant something here.</p>
      <input
        ref={input}
        type="password"
        autoComplete="off"
        aria-label="Passcode"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${titleId}-error` : undefined}
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError(null);
        }}
        className="mt-5 w-full rounded-[3px] border border-ink/20 bg-white/90 px-3.5 py-2.5 text-center text-lg tracking-[0.3em] outline-none transition-colors focus:border-rose focus:ring-2 focus:ring-rose/30"
      />
      <p id={`${titleId}-error`} role="alert" className="mt-2 min-h-[1.25rem] text-center text-[0.9rem] text-[#a3324f]">
        {error}
      </p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <GhostButton onClick={onCancel}>Not now</GhostButton>
        <PrimaryButton disabled={!code.trim() || checking}>Open the gate</PrimaryButton>
      </div>
    </form>
  );
}

function PlantForm({ titleId, onDone }: { titleId: string; onDone: () => void }) {
  const [kind, setKind] = useState<FlowerType>("tulip");
  const [label, setLabel] = useState(BLANK_LABEL);
  const [message, setMessage] = useState("");
  const [name, setName] = useState(() => planting.savedName() || (usePresence.getState().me ?? ""));
  const [photo, setPhoto] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formId = useId();

  // Each flower suggests its own "open when…", unless a label has already been written.
  const pick = (next: FlowerType) => {
    if (label === BLANK_LABEL || label === FLOWER_REGISTRY[kind].label) setLabel(FLOWER_REGISTRY[next].label);
    setKind(next);
  };

  const ready = label.trim().length > 0 && message.trim().length > 0 && name.trim().length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      planting.saveName(name.trim());
      await plantLetter(
        { flower_type: kind, category_label: label.trim(), message: message.trim(), planted_by: name.trim() },
        photo,
        audio,
      );
      useGardenStore.setState({ notice: `Your ${FLOWER_REGISTRY[kind].name.toLowerCase()} is growing in the garden.` });
      onDone();
    } catch (err) {
      console.error("Planting failed", err);
      setError("It didn't take root. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} aria-busy={busy}>
      <h2 id={titleId} className="pr-8 font-hand text-[clamp(1.6rem,6vw,2rem)] leading-tight">
        Plant a letter
      </h2>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-ink/70">It&apos;ll grow in the garden for both of us to find.</p>

      <fieldset className="mt-6" disabled={busy}>
        <legend className="text-[0.82rem] uppercase tracking-[0.12em] text-ink/60">Flower</legend>
        <div className="mt-2.5 grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
          {PLANT_KINDS.map((k) => (
            <label
              key={k}
              className="relative flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-ink/15 bg-white/50 px-2.5 py-2 text-[0.9rem] whitespace-nowrap transition-colors has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rose"
            >
              <input type="radio" name={`${formId}-kind`} value={k} checked={kind === k} onChange={() => pick(k)} className="sr-only" />
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: FLOWER_REGISTRY[k].spec.glow }} />
              {FLOWER_REGISTRY[k].name}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Open when…" htmlFor={`${formId}-label`}>
        <input
          id={`${formId}-label`}
          list={`${formId}-ideas`}
          required
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={busy}
          className={INPUT}
        />
        <datalist id={`${formId}-ideas`}>
          {LABEL_IDEAS.map((idea) => (
            <option key={idea} value={idea} />
          ))}
        </datalist>
      </Field>

      <Field label="Your letter" htmlFor={`${formId}-message`}>
        <textarea
          id={`${formId}-message`}
          required
          rows={7}
          maxLength={20000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={busy}
          placeholder="Leave a blank line between paragraphs."
          className={`${INPUT} resize-y leading-relaxed`}
        />
      </Field>

      <Field label="From" htmlFor={`${formId}-name`}>
        <input
          id={`${formId}-name`}
          required
          maxLength={40}
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          className={INPUT}
        />
      </Field>

      <div className="mt-5 flex flex-wrap gap-2">
        <FilePicker label="Add a photo" accept="image/*" file={photo} onChange={setPhoto} onError={setError} disabled={busy} />
        <FilePicker label="Add a voice note" accept="audio/*" file={audio} onChange={setAudio} onError={setError} disabled={busy} />
      </div>

      <p role="alert" className="mt-4 min-h-[1.25rem] text-[0.9rem] text-[#a3324f]">
        {error}
      </p>
      <div className="mt-2 flex items-center justify-end gap-2">
        <GhostButton onClick={onDone} disabled={busy}>
          Cancel
        </GhostButton>
        <PrimaryButton disabled={!ready || busy}>{busy ? "Planting…" : "Plant it"}</PrimaryButton>
      </div>
    </form>
  );
}

const INPUT =
  "mt-1.5 w-full rounded-[3px] border border-ink/20 bg-white/90 px-3.5 py-2.5 text-[1rem] outline-none transition-colors placeholder:text-ink/35 focus:border-rose focus:ring-2 focus:ring-rose/30 disabled:opacity-60";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <label htmlFor={htmlFor} className="text-[0.82rem] uppercase tracking-[0.12em] text-ink/60">
        {label}
      </label>
      {children}
    </div>
  );
}

function FilePicker({
  label,
  accept,
  file,
  onChange,
  onError,
  disabled,
}: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
  onError: (message: string | null) => void;
  disabled: boolean;
}) {
  if (file) {
    return (
      <span className="flex max-w-full items-center gap-1 rounded-full bg-ink/[0.07] py-1 pl-3.5 pr-1 text-[0.9rem]">
        <span className="truncate">{file.name}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          aria-label={`Remove ${file.name}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-ink/10 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </span>
    );
  }
  return (
    <label className="cursor-pointer rounded-full border border-dashed border-ink/30 px-4 py-2 text-[0.9rem] text-ink/75 transition-colors hover:border-ink/60 hover:text-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-rose">
      + {label}
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const chosen = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (chosen && chosen.size > MAX_FILE_BYTES) {
            onError("That file is over 25 MB. Try a smaller one?");
            return;
          }
          onError(null);
          onChange(chosen);
        }}
      />
    </label>
  );
}

function PrimaryButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="rounded-full bg-ink px-5 py-2.5 text-[0.95rem] text-paper transition-[opacity,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2.5 text-[0.95rem] text-ink/70 underline decoration-ink/25 underline-offset-8 transition-colors hover:text-ink hover:decoration-rose disabled:opacity-45 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
    >
      {children}
    </button>
  );
}

function SproutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 18v-7" />
      <path d="M10 11c0-3.5-2.4-5.5-6-5.5 0 3.4 2.3 5.5 6 5.5z" />
      <path d="M10 9.5c0-3.2 2.1-5.5 5.8-5.5 0 3.3-2.2 5.5-5.8 5.5z" />
    </svg>
  );
}
