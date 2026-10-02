"use client";

import { type FormEvent, type ReactNode, useEffect, useId, useState } from "react";
import {
  arrivalHint,
  DEFAULT_DELAY_DAYS,
  DELAYS,
  type InTransit,
  MAIL_MAX,
  markDelivered,
  postLetter,
  recipientOf,
  useMail,
} from "@/lib/mailbox";
import { planting } from "@/lib/plantStore";
import { GARDENER_NAMES, type GardenerName, usePresence } from "@/lib/presence";
import { Gate, GhostButton, INPUT, PrimaryButton } from "./PlantPanel";

/**
 * The mailbox by the gate: letters that have come for you, what's still on its
 * way (who from, and only roughly when), what you've sent, and writing a new
 * one with how long it should take to arrive.
 */

type View = { kind: "list"; posted?: string } | { kind: "read"; id: string } | { kind: "write" };

export default function MailboxPanel({ titleId, escape }: { titleId: string; escape: { current: (() => boolean) | null } }) {
  const [view, setView] = useState<View>({ kind: "list" });

  // Escape steps back to the list before closing the mailbox.
  useEffect(() => {
    escape.current = () => {
      if (view.kind === "list") return false;
      setView({ kind: "list" });
      return true;
    };
    return () => {
      escape.current = null;
    };
  }, [escape, view.kind]);

  if (view.kind === "read") return <ReadLetter id={view.id} onBack={() => setView({ kind: "list" })} />;
  if (view.kind === "write") {
    return (
      <WriteLetter
        titleId={`${titleId}-write`}
        onCancel={() => setView({ kind: "list" })}
        onPosted={(posted) => setView({ kind: "list", posted })}
      />
    );
  }
  return <Letters posted={view.posted} onRead={(id) => setView({ kind: "read", id })} onWrite={() => setView({ kind: "write" })} />;
}

/** The time now, ticking over every half minute, for "arrives in about 5 hours". */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function dayText(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-[0.78rem] uppercase tracking-[0.14em] text-ink/55">{title}</h3>
      <ul className="mt-1.5 divide-y divide-ink/10">{children}</ul>
    </section>
  );
}

function Envelope({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12.5" rx="1.5" />
      <path d="M3.5 7l8.5 6.5L20.5 7" />
    </svg>
  );
}

function LetterRow({ title, detail, unread, onClick }: { title: string; detail: string; unread?: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-sm px-1 py-3 text-left transition-colors hover:bg-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
      >
        <Envelope className={`h-5 w-5 shrink-0 ${unread ? "text-rose" : "text-ink/40"}`} />
        <span className="min-w-0 flex-1">
          <span className="block font-hand text-[1.3rem] leading-tight">{title}</span>
          <span className="block text-[0.82rem] text-ink/55">{detail}</span>
        </span>
        {unread && <span aria-label="unopened" className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose shadow-[0_0_8px_rgb(242_154_182/0.9)]" />}
      </button>
    </li>
  );
}

function OnItsWay({ item, me, now }: { item: InTransit; me: GardenerName | null; now: number }) {
  const mine = item.author === me;
  return (
    <li className="flex items-center gap-3 px-1 py-3">
      <Envelope className={`h-5 w-5 shrink-0 text-ink/35 ${mine ? "" : "animate-pulse"}`} />
      <span className="min-w-0 flex-1">
        <span className="block font-hand text-[1.3rem] leading-tight">
          {mine ? `Your letter to ${recipientOf(item.author)}` : `Something from ${item.author}…`}
        </span>
        <span className="block text-[0.82rem] text-ink/55">
          {mine ? `arrives ${dayText(item.deliver_at)}` : `arriving ${arrivalHint(item.deliver_at, now)}`}
        </span>
      </span>
    </li>
  );
}

function Letters({ posted, onRead, onWrite }: { posted?: string; onRead: (id: string) => void; onWrite: () => void }) {
  const me = usePresence((s) => s.me);
  const letters = useMail((s) => s.letters);
  const transit = useMail((s) => s.transit);
  const loaded = useMail((s) => s.loaded);
  const now = useNow();

  const newestFirst = [...letters].reverse();
  const forMe = me ? newestFirst.filter((l) => recipientOf(l.author) === me) : newestFirst;
  const sent = me ? newestFirst.filter((l) => l.author === me) : [];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onWrite}
          className="rounded-full border border-dashed border-ink/30 px-4 py-2 text-[0.9rem] text-ink/75 transition-colors hover:border-ink/60 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
        >
          + Write a letter
        </button>
        {posted && (
          <p role="status" className="text-[0.9rem] text-ink/65">
            {posted}
          </p>
        )}
      </div>

      {loaded && letters.length === 0 && transit.length === 0 && (
        <p className="py-6 text-center text-[1rem] leading-relaxed text-ink/65">
          The mailbox is empty. Write a letter and choose when it opens: in a day, three days or a week.
        </p>
      )}

      {forMe.length > 0 && (
        <Section title={me ? "For you" : "Letters"}>
          {forMe.map((l) => (
            <LetterRow
              key={l.id}
              title={`A letter from ${l.author}`}
              detail={`arrived ${dayText(l.deliver_at)}`}
              unread={me !== null && !l.delivered}
              onClick={() => onRead(l.id)}
            />
          ))}
        </Section>
      )}

      {transit.length > 0 && (
        <Section title="On its way">
          {transit.map((t) => (
            <OnItsWay key={t.id} item={t} me={me} now={now} />
          ))}
        </Section>
      )}

      {sent.length > 0 && (
        <Section title="Sent">
          {sent.map((l) => (
            <LetterRow
              key={l.id}
              title={`To ${recipientOf(l.author)}`}
              detail={`arrived ${dayText(l.deliver_at)} · ${l.delivered ? "opened" : "not opened yet"}`}
              onClick={() => onRead(l.id)}
            />
          ))}
        </Section>
      )}
    </>
  );
}

function ReadLetter({ id, onBack }: { id: string; onBack: () => void }) {
  const letter = useMail((s) => s.letters.find((l) => l.id === id));

  useEffect(() => {
    void markDelivered(id);
  }, [id]);

  if (!letter) return null;
  return (
    <article>
      <p className="text-[0.82rem] text-ink/55">
        From {letter.author} to {recipientOf(letter.author)} · posted {dayText(letter.created_at)}, arrived {dayText(letter.deliver_at)}
      </p>
      <p className="mt-4 whitespace-pre-wrap break-words font-hand text-[1.35rem] leading-snug text-ink">{letter.message}</p>
      <p className="mt-4 text-right font-hand text-[1.3rem] text-ink/80">— {letter.author}</p>
      <div className="mt-5 flex justify-start">
        <GhostButton onClick={onBack}>Back to the mailbox</GhostButton>
      </div>
    </article>
  );
}

function WriteLetter({ titleId, onCancel, onPosted }: { titleId: string; onCancel: () => void; onPosted: (note: string) => void }) {
  const [unlocked, setUnlocked] = useState(planting.isUnlocked);
  const me = usePresence((s) => s.me);
  const [from, setFrom] = useState<GardenerName | null>(me);
  const [message, setMessage] = useState("");
  /** Days until it arrives. */
  const [days, setDays] = useState<number>(DEFAULT_DELAY_DAYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  if (!unlocked) {
    return (
      <div className="rounded-[2px] bg-white/70 p-4 ring-1 ring-ink/10">
        <Gate
          titleId={titleId}
          title="Post a letter"
          prompt="Whisper our passcode to post letters here."
          onUnlock={() => {
            planting.rememberUnlock();
            setUnlocked(true);
          }}
          onCancel={onCancel}
        />
      </div>
    );
  }

  const author = me ?? from;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!author || !message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const at = await postLetter(author, message, days);
      onPosted(`Posted. It opens for ${recipientOf(author)} on ${dayText(at)}.`);
    } catch {
      setError("The letter didn't go. Check the connection and try again?");
      setBusy(false);
    }
  };

  const pill = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[0.88rem] transition-colors ${
      active ? "bg-ink text-paper" : "bg-ink/[0.06] text-ink/75 hover:bg-ink/10 hover:text-ink"
    }`;

  return (
    <form onSubmit={submit}>
      <h3 id={titleId} className="font-hand text-[1.5rem] leading-none">
        {author ? `A letter for ${recipientOf(author)}` : "A letter"}
      </h3>
      {!me && (
        <div className="mt-3 flex items-center gap-2" role="radiogroup" aria-label="Who it's from">
          {GARDENER_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={from === name}
              onClick={() => setFrom(name)}
              className={`focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose ${pill(from === name)}`}
            >
              From {name}
            </button>
          ))}
        </div>
      )}
      <textarea
        id={`${id}-message`}
        aria-label="Your letter"
        value={message}
        maxLength={MAIL_MAX}
        rows={7}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Dear…"
        className={`${INPUT} resize-none font-hand text-[1.2rem] leading-snug`}
        disabled={busy}
      />
      <fieldset className="mt-4" disabled={busy}>
        <legend className="text-[0.82rem] uppercase tracking-[0.12em] text-ink/60">Open in</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DELAYS.map((d) => (
            <label key={d.days} className={`cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-rose ${pill(days === d.days)}`}>
              <input type="radio" name={`${id}-delay`} value={d.days} checked={days === d.days} onChange={() => setDays(d.days)} className="sr-only" />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>
      <p role="alert" className="mt-2 min-h-[1.1rem] text-[0.85rem] text-[#a3324f]">
        {error}
      </p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.8rem] text-ink/50">
          {message.length}/{MAIL_MAX}
        </span>
        <div className="flex items-center gap-1">
          <GhostButton onClick={onCancel} disabled={busy}>
            Cancel
          </GhostButton>
          <PrimaryButton disabled={busy || !author || !message.trim()}>{busy ? "Posting…" : "Post it"}</PrimaryButton>
        </div>
      </div>
    </form>
  );
}
