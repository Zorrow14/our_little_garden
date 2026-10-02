"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { type FormEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { useGardenStore } from "@/lib/gardenStore";
import {
  closeKeepsake,
  flowerColor,
  type Keepsake,
  rereadLetter,
  useKeepsakes,
  useOpenedLetters,
  useWallPhotos,
  type WallPhoto,
} from "@/lib/keepsakes";
import { CAPTION_MAX, uploadHousePhoto } from "@/lib/housePhotos";
import { NOTE_MAX, type Note, pinNote, useNotes } from "@/lib/notes";
import { planting } from "@/lib/plantStore";
import { usePresence } from "@/lib/presence";
import { FilePicker, Gate, GhostButton, INPUT, PrimaryButton } from "./PlantPanel";

/**
 * The panels the cottage's keepsakes open: the photo wall's gallery, the notes
 * board, and the letter archive on the bookshelf.
 */
export default function Keepsakes() {
  const open = useKeepsakes((s) => s.open);

  // Closing a letter re-read from the archive goes back to the shelf.
  useEffect(
    () =>
      useGardenStore.subscribe((s, prev) => {
        if (prev.activeId && !s.activeId && useKeepsakes.getState().rereading) {
          useKeepsakes.setState({ rereading: false, open: "archive" });
        }
      }),
    [],
  );

  return <AnimatePresence>{open && <Sheet key={open} which={open} />}</AnimatePresence>;
}

const TITLES: Record<Keepsake, string> = {
  photos: "Our photo wall",
  notes: "The notes board",
  archive: "Letters we've opened",
};

function Sheet({ which }: { which: Keepsake }) {
  const titleId = useId();
  /** A panel can take Escape for itself first (the gallery closes a full-size photo before the wall). */
  const escape = useRef<(() => boolean) | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (escape.current?.()) return;
      closeKeepsake();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cork = which === "notes";
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center px-3 pb-4 pt-[4.5rem] sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      transition={{ duration: 0.4 }}
    >
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(14_22_48/0.5),rgb(6_9_22/0.88))]" onClick={closeKeepsake} />
      <motion.div
        className={`relative flex max-h-[88dvh] ${which === "archive" ? "w-[min(94vw,32rem)]" : "w-[min(94vw,44rem)]"} flex-col overflow-hidden rounded-[4px] shadow-letter ${
          cork
            ? "bg-[#b78a5f] bg-[radial-gradient(rgb(90_58_32/0.22)_1px,transparent_1.4px),radial-gradient(rgb(255_236_200/0.16)_1px,transparent_1.6px)] bg-[length:9px_9px,13px_13px] text-ink ring-[10px] ring-inset ring-[#6e4c36]"
            : "paper-creases bg-paper text-ink"
        }`}
        initial={{ y: 30, rotate: -1, scale: 0.97 }}
        animate={{ y: 0, rotate: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className={`flex items-start justify-between gap-3 px-6 pt-7 sm:px-8 ${cork ? "pt-8" : ""}`}>
          <h2
            id={titleId}
            className={`font-hand text-[clamp(1.6rem,6vw,2.1rem)] leading-tight ${cork ? "rounded-[2px] bg-paper px-3 py-0.5 shadow-sm -rotate-1" : ""}`}
          >
            {TITLES[which]}
          </h2>
          <button
            type="button"
            onClick={closeKeepsake}
            aria-label="Close"
            className={`-mr-2 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose ${
              cork ? "bg-paper/85 text-ink/70 hover:bg-paper" : "text-ink/55 hover:bg-ink/5 hover:text-ink"
            }`}
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-7 pt-4 sm:px-8">
          {which === "photos" && <PhotoGallery escape={escape} titleId={titleId} />}
          {which === "notes" && <NotesBoard titleId={titleId} />}
          {which === "archive" && <LetterArchive />}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-[1rem] leading-relaxed text-ink/65">{children}</p>;
}

/** What a photo says under it: a letter's label, or a hung photo's caption (or who hung it). */
function photoTitle(photo: WallPhoto) {
  return photo.label || `from ${photo.by}`;
}

function PhotoGallery({ escape, titleId }: { escape: { current: (() => boolean) | null }; titleId: string }) {
  const photos = useWallPhotos();
  const [showing, setShowing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    escape.current = () => {
      if (showing === null) return false;
      setShowing(null);
      return true;
    };
    const onKey = (e: KeyboardEvent) => {
      if (showing === null) return;
      if (e.key === "ArrowRight") setShowing((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setShowing((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      escape.current = null;
      window.removeEventListener("keydown", onKey);
    };
  }, [escape, showing, photos.length]);

  return (
    <>
      <div className="mb-4">
        {adding ? (
          <div className="rounded-[2px] bg-white/70 p-4 ring-1 ring-ink/10">
            <AddPhoto titleId={`${titleId}-add`} onDone={() => setAdding(false)} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full border border-dashed border-ink/30 px-4 py-2 text-[0.9rem] text-ink/75 transition-colors hover:border-ink/60 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
          >
            + Add a photo
          </button>
        )}
      </div>
      {photos.length === 0 && (
        <Empty>No photos on the wall yet. Add one, or open a letter with a photo in it and it&rsquo;s hung here too.</Empty>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setShowing(i)}
              className="group block w-full rounded-[2px] bg-white p-1.5 pb-6 text-left shadow-[0_2px_10px_rgb(20_24_50/0.18)] transition-transform hover:-rotate-1 hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
            >
              <span className="relative block aspect-square overflow-hidden bg-ink/5">
                <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 640px) 14rem, 45vw" unoptimized className="object-cover" />
              </span>
              <span className="mt-1.5 block truncate px-0.5 font-hand text-[1.05rem] leading-tight text-ink/80">{photoTitle(photo)}</span>
            </button>
          </li>
        ))}
      </ul>
      <AnimatePresence>
        {showing !== null && photos[showing] && (
          <Lightbox
            photo={photos[showing]}
            count={photos.length}
            onClose={() => setShowing(null)}
            onStep={(d) => setShowing((i) => (i === null ? i : (i + d + photos.length) % photos.length))}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Lightbox({ photo, count, onClose, onStep }: { photo: WallPhoto; count: number; onClose: () => void; onStep: (d: number) => void }) {
  const arrow = "grid h-11 w-11 place-items-center rounded-full bg-night/60 text-moon ring-1 ring-moon/25 backdrop-blur-sm transition-colors hover:bg-night/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern";
  return (
    <motion.div
      className="fixed inset-0 z-[55] flex flex-col items-center justify-center gap-4 bg-[rgb(6_9_22/0.92)] p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClose}
    >
      <figure className="relative flex max-h-full w-full max-w-4xl flex-1 flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-[min(72dvh,46rem)] w-full">
          <Image key={photo.id} src={photo.src} alt={photo.alt} fill sizes="90vw" unoptimized className="object-contain" />
        </div>
        <figcaption className="mt-3 text-center">
          {photo.label && <span className="block font-hand text-[1.4rem] leading-snug text-moon">{photo.label}</span>}
          <span className="mt-0.5 block text-[0.85rem] text-moon/60">
            {photo.origin === "letter"
              ? `from a letter${photo.by ? `, planted by ${photo.by}` : ""}`
              : `hung by ${photo.by} · ${formatDate(photo.on!)}`}
          </span>
        </figcaption>
      </figure>
      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {count > 1 && (
          <button type="button" aria-label="Previous photo" className={arrow} onClick={() => onStep(-1)}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.5 4.5L7 10l5.5 5.5" />
            </svg>
          </button>
        )}
        <button type="button" onClick={onClose} className="px-4 py-2.5 text-[0.95rem] text-moon/80 underline decoration-moon/30 underline-offset-8 hover:text-moon">
          Back to the wall
        </button>
        {count > 1 && (
          <button type="button" aria-label="Next photo" className={arrow} onClick={() => onStep(1)}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.5 4.5L13 10l-5.5 5.5" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  );
}

/** A note's tilt and pin colour, the same every time it's shown. */
function noteLook(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  const pins = ["#d9728f", "#e3b04b", "#6f9fd8", "#7fb07a"];
  const papers = ["#fffaf0", "#fdf3c8", "#f7e4ec", "#e7f1e2"];
  return { tilt: ((h % 7) - 3) * 0.7, pin: pins[Math.abs(h) % pins.length], paper: papers[Math.abs(h >> 3) % papers.length] };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function NotesBoard({ titleId }: { titleId: string }) {
  const notes = useNotes((s) => s.notes);
  const loaded = useNotes((s) => s.loaded);
  const [unlocked, setUnlocked] = useState(planting.isUnlocked);
  const newestFirst = useMemo(() => [...notes].reverse(), [notes]);

  return (
    <div className="space-y-5">
      <div className="rounded-[2px] bg-paper p-4 shadow-[0_2px_10px_rgb(40_24_10/0.25)]">
        {unlocked ? (
          <NoteForm />
        ) : (
          <Gate
            titleId={`${titleId}-gate`}
            title="Pin a note"
            prompt="Whisper our passcode to pin notes here."
            onUnlock={() => {
              planting.rememberUnlock();
              setUnlocked(true);
            }}
            onCancel={closeKeepsake}
          />
        )}
      </div>
      {loaded && notes.length === 0 ? (
        <p className="rounded-[2px] bg-paper/85 px-4 py-3 text-center text-ink/70">Nothing pinned yet. Leave the first note.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {newestFirst.map((note) => (
            <PinnedNote key={note.id} note={note} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PinnedNote({ note }: { note: Note }) {
  const { tilt, pin, paper } = noteLook(note.id);
  return (
    <li className="relative rounded-[2px] px-4 pb-3 pt-5 shadow-[0_3px_8px_rgb(40_24_10/0.3)]" style={{ background: paper, rotate: `${tilt}deg` }}>
      <span aria-hidden className="absolute left-1/2 top-1.5 h-3 w-3 -translate-x-1/2 rounded-full shadow-[0_1px_2px_rgb(0_0_0/0.4)]" style={{ background: pin }} />
      <p className="whitespace-pre-wrap break-words font-hand text-[1.25rem] leading-snug text-ink">{note.message}</p>
      <p className="mt-2 text-right text-[0.8rem] text-ink/55">
        {note.author} · {formatDate(note.created_at)}
      </p>
    </li>
  );
}

function NoteForm() {
  const me = usePresence((s) => s.me);
  const [author, setAuthor] = useState(() => me ?? planting.savedName());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !author.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await pinNote(author, message);
      if (!me) planting.saveName(author.trim());
      setMessage("");
    } catch {
      setError("The note wouldn't stick. Check the connection and try again?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <label htmlFor={`${id}-message`} className="font-hand text-[1.35rem] leading-none">
        Leave a note
      </label>
      <textarea
        id={`${id}-message`}
        value={message}
        maxLength={NOTE_MAX}
        rows={3}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Thinking of you…"
        className={`${INPUT} resize-none font-hand text-[1.2rem]`}
        disabled={busy}
      />
      {!me && (
        <input
          aria-label="Your name"
          value={author}
          maxLength={40}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Your name"
          className={INPUT}
          disabled={busy}
        />
      )}
      <p role="alert" className="mt-1.5 min-h-[1.1rem] text-[0.85rem] text-[#a3324f]">
        {error}
      </p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.8rem] text-ink/50">
          {message.length}/{NOTE_MAX}
        </span>
        <div className="flex items-center gap-1">
          <GhostButton onClick={closeKeepsake}>Close</GhostButton>
          <PrimaryButton disabled={busy || !message.trim() || !author.trim()}>{busy ? "Pinning…" : "Pin it"}</PrimaryButton>
        </div>
      </div>
    </form>
  );
}

/** Hanging a photo of your own: the passcode once per device, then a photo and an optional caption. */
function AddPhoto({ titleId, onDone }: { titleId: string; onDone: () => void }) {
  const [unlocked, setUnlocked] = useState(planting.isUnlocked);
  const me = usePresence((s) => s.me);
  const [name, setName] = useState(() => me ?? planting.savedName());
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  if (!unlocked) {
    return (
      <Gate
        titleId={titleId}
        title="Hang a photo"
        prompt="Whisper our passcode to hang photos here."
        onUnlock={() => {
          planting.rememberUnlock();
          setUnlocked(true);
        }}
        onCancel={onDone}
      />
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await uploadHousePhoto(name, file, caption);
      if (!me) planting.saveName(name.trim());
      onDone();
    } catch {
      setError("The photo wouldn't upload. Check the connection and try again?");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <p id={titleId} className="font-hand text-[1.35rem] leading-none">
        Hang a photo
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilePicker label="Choose a photo" accept="image/*" file={file} onChange={setFile} onError={setError} disabled={busy} />
      </div>
      <input
        id={`${id}-caption`}
        aria-label="Caption (optional)"
        value={caption}
        maxLength={CAPTION_MAX}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="A caption, if you like"
        className={`${INPUT} font-hand text-[1.15rem]`}
        disabled={busy}
      />
      {!me && (
        <input
          aria-label="Your name"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className={INPUT}
          disabled={busy}
        />
      )}
      <p role="alert" className="mt-1.5 min-h-[1.1rem] text-[0.85rem] text-[#a3324f]">
        {error}
      </p>
      <div className="flex items-center justify-end gap-1">
        <GhostButton onClick={onDone} disabled={busy}>
          Cancel
        </GhostButton>
        <PrimaryButton disabled={busy || !file || !name.trim()}>{busy ? "Hanging it…" : "Hang it"}</PrimaryButton>
      </div>
    </form>
  );
}

function LetterArchive() {
  const letters = useOpenedLetters();
  if (letters.length === 0) {
    return <Empty>Every letter you open in the garden is kept here, so you can read it again whenever you like.</Empty>;
  }
  return (
    <>
      <p className="mb-3 text-[0.95rem] text-ink/65">Every letter you&rsquo;ve opened, kept on the shelf to read again.</p>
      <ul className="divide-y divide-ink/10">
        {letters.map((letter) => (
          <li key={letter.id}>
            <button
              type="button"
              onClick={() => rereadLetter(letter.id)}
              className="flex w-full items-center gap-3 rounded-sm px-1 py-3 text-left transition-colors hover:bg-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
            >
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: flowerColor(letter.flower), boxShadow: `0 0 8px ${flowerColor(letter.flower)}` }} />
              <span className="min-w-0 flex-1">
                <span className="block font-hand text-[1.3rem] leading-tight">{letter.label}</span>
                <span className="block text-[0.82rem] text-ink/55">
                  {letter.by ? `planted by ${letter.by} · ${formatDate(letter.on!)}` : "one of the first letters"}
                  {letter.photo ? " · with a photo" : ""}
                </span>
              </span>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-ink/40" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M7.5 4.5L13 10l-5.5 5.5" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
