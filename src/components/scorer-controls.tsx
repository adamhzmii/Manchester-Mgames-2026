"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { useKickoff } from "@/components/delays";
import { CheckIcon, MinusIcon, PlusIcon } from "@/components/icons";
import {
  correctKickoff,
  setPlannedStart,
  updateFixtureScore,
  type ActionResult,
} from "@/lib/actions/fixtures";
import { courtKey } from "@/lib/delays";
import type { Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";
import type { FixtureStatus } from "@/lib/supabase/types";

import styles from "./score-console.module.css";

/**
 * The pieces of scoring a game, shared by the match page's console and the
 * coordinators' court sheet, so the two can never behave differently.
 */

/** How long after the last tap a live score saves itself. */
const AUTOSAVE_MS = 900;

/**
 * What a coordinator sees when a save never reached the server. Uni wifi is
 * named because it is the likeliest cause on the day: eduroam blocks the
 * site's address, and the phone may have joined it without anyone noticing.
 */
export const OFFLINE_MESSAGE =
  "Not saved — no connection. On uni wifi? Switch to mobile data and try again.";

/**
 * Runs a server action and turns a network failure into an ordinary failed
 * result. Without this a dropped connection throws inside a transition, and
 * the whole console is replaced by the error page mid-game.
 */
export async function safely(run: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await run();
  } catch {
    return { ok: false, message: OFFLINE_MESSAGE };
  }
}

type Save =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; at: number }
  | { state: "error"; message: string };

/** Saves one game's status and score. */
export async function saveGame(
  fixtureId: string,
  status: FixtureStatus,
  a: number | null,
  b: number | null,
): Promise<ActionResult> {
  const form = new FormData();
  form.set("fixtureId", fixtureId);
  form.set("status", status);
  form.set("scoreA", a === null ? "" : String(a));
  form.set("scoreB", b === null ? "" : String(b));
  return safely(async () => {
    const result = await updateFixtureScore({ status: "idle", message: null }, form);
    return { ok: result.status === "success", message: result.message ?? "Could not save." };
  });
}

/** Ends a game at the score it has — for the one left live on a court. */
export function finishGame(f: Fixture): Promise<ActionResult> {
  return saveGame(f.id, "finished", f.scoreA ?? 0, f.scoreB ?? 0);
}

/** A save on its way: what the game will look like once it lands. */
export type GameChange = { fixtureId: string; status: FixtureStatus; scoreA: number | null; scoreB: number | null };

/**
 * A game's score and status as the coordinator is editing them: big +/−
 * buttons that save themselves a moment after the last tap while the game is
 * live, and deliberate saves before kick-off and after the final whistle.
 *
 * `onChange` hears every save that lands, so a screen showing several games
 * (the court sheet) can move a started game into "Now playing" straight away
 * instead of after the next poll.
 */
export function useScoreKeeper(fixture: Fixture, onChange?: (change: GameChange) => void) {
  const [scoreA, setScoreA] = useState<number | null>(fixture.scoreA);
  const [scoreB, setScoreB] = useState<number | null>(fixture.scoreB);
  const [status, setStatus] = useState<FixtureStatus>(fixture.status);
  const [dirty, setDirty] = useState(false);
  const [save, setSave] = useState<Save>({ state: "idle" });
  const [warning, setWarning] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Take the server's copy whenever it changes underneath us — another
  // coordinator's edit, or our own save coming back — unless we are mid-edit.
  const [seen, setSeen] = useState(fixture.updatedAt);
  if (fixture.updatedAt !== seen) {
    setSeen(fixture.updatedAt);
    if (!dirty) {
      setScoreA(fixture.scoreA);
      setScoreB(fixture.scoreB);
      setStatus(fixture.status);
    }
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const persist = (next: { status: FixtureStatus; a: number | null; b: number | null }) => {
    clearTimeout(timer.current);
    setSave({ state: "saving" });
    startTransition(async () => {
      const result = await saveGame(fixture.id, next.status, next.a, next.b);
      if (result.ok) {
        // Only once it has landed: a screen that moved a game to "Now
        // playing" on a save that then failed would be showing a lie.
        onChange?.({ fixtureId: fixture.id, status: next.status, scoreA: next.a, scoreB: next.b });
        setDirty(false);
        setSave({ state: "saved", at: Date.now() });
      } else {
        // Stays dirty, so the next tap — or Retry — sends it again.
        setDirty(true);
        setSave({ state: "error", message: result.message });
      }
    });
  };

  const setScores = (a: number | null, b: number | null) => {
    setScoreA(a);
    setScoreB(b);
    setDirty(true);
    setWarning(null);
    // While a game is live, scores save themselves. Before kick-off or after
    // the final whistle a change is a correction, and waits for a deliberate
    // tap.
    if (status === "live") {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => persist({ status: "live", a, b }), AUTOSAVE_MS);
    }
  };

  const bump = (side: "a" | "b", delta: number) => {
    const a = scoreA ?? 0;
    const b = scoreB ?? 0;
    if (side === "a") setScores(Math.max(0, a + delta), b);
    else setScores(a, Math.max(0, b + delta));
  };

  const start = () => {
    const a = scoreA ?? 0;
    const b = scoreB ?? 0;
    setStatus("live");
    setScoreA(a);
    setScoreB(b);
    persist({ status: "live", a, b });
  };

  const finish = () => {
    const a = scoreA ?? 0;
    const b = scoreB ?? 0;
    // A level knockout cannot send anyone through, and the bracket after it
    // would stall. Penalties, a golden point — whatever decides it is the
    // score to record.
    if (fixture.stage !== "group" && a === b) {
      setWarning("Knockout games can't end level. Record the deciding score so a winner goes through.");
      return;
    }
    setStatus("finished");
    persist({ status: "finished", a, b });
  };

  const retry = () => persist({ status, a: scoreA, b: scoreB });

  const saveCorrection = () => persist({ status: "finished", a: scoreA, b: scoreB });

  const reopen = () => {
    setStatus("live");
    persist({ status: "live", a: scoreA, b: scoreB });
  };

  const reset = () => {
    setStatus("upcoming");
    setScoreA(null);
    setScoreB(null);
    persist({ status: "upcoming", a: null, b: null });
  };

  return {
    scoreA,
    scoreB,
    status,
    dirty,
    save,
    warning,
    setScores,
    bump,
    start,
    finish,
    retry,
    saveCorrection,
    reopen,
    reset,
  };
}

export type ScoreKeeper = ReturnType<typeof useScoreKeeper>;

export function SaveState({ keeper }: { keeper: ScoreKeeper }) {
  const { save, dirty, status } = keeper;
  if (save.state === "saving") return <span className={styles.saving}>Saving…</span>;
  if (save.state === "error") {
    return (
      <span className={styles.error} role="alert">
        {save.message}{" "}
        <button type="button" className={styles.linkish} onClick={keeper.retry}>
          Retry
        </button>
      </span>
    );
  }
  if (dirty && status !== "live") return <span className={styles.unsaved}>Not saved</span>;
  if (save.state === "saved") {
    return (
      <span className={styles.saved}>
        <CheckIcon size={14} />
        Saved {formatTime(new Date(save.at).toISOString())}
      </span>
    );
  }
  return null;
}

export function Stepper({
  name,
  value,
  onBump,
  onType,
}: {
  name: string;
  value: number | null;
  onBump: (delta: number) => void;
  onType: (value: number | null) => void;
}) {
  return (
    <div className={styles.side}>
      <span className={styles.sideName}>{name}</span>
      <div className={styles.stepper}>
        <button
          type="button"
          className={styles.step}
          onClick={() => onBump(-1)}
          aria-label={`${name}: one less`}
          disabled={!value}
        >
          <MinusIcon size={24} />
        </button>
        <input
          className={styles.value}
          // inputMode numeric with type text: type="number" brings spinners and
          // scroll-to-change, both hazards on a phone held courtside.
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={`${name} score`}
          value={value ?? ""}
          placeholder="0"
          onChange={(event) => {
            const text = event.target.value.replace(/\D/g, "");
            onType(text === "" ? null : Number(text));
          }}
        />
        <button
          type="button"
          className={`${styles.step} ${styles.plus}`}
          onClick={() => onBump(1)}
          aria-label={`${name}: one more`}
        >
          <PlusIcon size={26} />
        </button>
      </div>
    </div>
  );
}

/** A server action's answer, under the control that asked. */
export function Result({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p className={result.ok ? styles.done : styles.warning} role="status">
      {result.message}
    </p>
  );
}

/** Another game on the same court still marked live — Finish never tapped. */
export function liveOnCourt(fixture: Fixture, fixtures: readonly Fixture[]): Fixture | null {
  const key = courtKey(fixture);
  return (
    fixtures.find((f) => f.id !== fixture.id && f.status === "live" && courtKey(f) === key) ?? null
  );
}

/**
 * Start game, with one check first: if the court still shows another game
 * as live, the coordinator almost certainly forgot to finish it. Offer to
 * finish it at the score it has, rather than leave two games "live" on one
 * court and the timetable after them guessing.
 */
export function StartButton({
  fixture,
  fixtures,
  onStart,
  onChange,
  className,
}: {
  fixture: Fixture;
  fixtures: readonly Fixture[];
  onStart: () => void;
  /** Told when the game left live is finished from here. */
  onChange?: (change: GameChange) => void;
  className?: string;
}) {
  const [blocking, setBlocking] = useState<Fixture | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (blocking) {
    const level = blocking.stage !== "group" && (blocking.scoreA ?? 0) === (blocking.scoreB ?? 0);
    return (
      <div className={styles.guard} role="alertdialog" aria-label="Another game is still live">
        <p className={styles.guardText}>
          <strong>
            {blocking.teamA} v {blocking.teamB}
          </strong>{" "}
          is still live on {fixture.courtName} ({blocking.scoreA ?? 0}–{blocking.scoreB ?? 0}).
          {level ? " A knockout can't end level, so finish it on its own page first." : " Has it finished?"}
        </p>
        <div className={styles.guardActions}>
          {level ? (
            <Link href={`/match/${blocking.id}`} className={`mg-btn ${styles.primary}`}>
              Open that game
            </Link>
          ) : (
            <button
              type="button"
              className={`mg-btn ${styles.primary}`}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const done = await finishGame(blocking);
                  setResult(done);
                  if (!done.ok) return;
                  onChange?.({
                    fixtureId: blocking.id,
                    status: "finished",
                    scoreA: blocking.scoreA ?? 0,
                    scoreB: blocking.scoreB ?? 0,
                  });
                  setBlocking(null);
                  onStart();
                })
              }
            >
              {pending ? "Saving…" : `Yes — finish it ${blocking.scoreA ?? 0}–${blocking.scoreB ?? 0} and start this`}
            </button>
          )}
          <button
            type="button"
            className={`mg-btn ${styles.secondary}`}
            disabled={pending}
            onClick={() => {
              setBlocking(null);
              onStart();
            }}
          >
            Start this anyway
          </button>
          <button
            type="button"
            className={styles.linkish}
            disabled={pending}
            onClick={() => setBlocking(null)}
          >
            Cancel
          </button>
        </div>
        <Result result={result} />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`mg-btn ${styles.primary} ${className ?? ""}`}
      onClick={() => {
        const live = liveOnCourt(fixture, fixtures);
        if (live) setBlocking(live);
        else onStart();
      }}
    >
      Start game
    </button>
  );
}

/** A clock time `minutes` after an ISO time, as "HH:MM" in Manchester. */
function later(iso: string, minutes: number): string {
  return formatTime(new Date(Date.parse(iso) + minutes * 60_000).toISOString());
}

/**
 * "Starts at": when a game that has not started will now begin. One idea a
 * coordinator already has in their head — "we'll go at 10:05" — rather than
 * a number of minutes to add to something. Quick buttons count on from the
 * time phones show now; later games on the court follow on by themselves.
 */
export function ChangeTime({ fixture, compact = false }: { fixture: Fixture; compact?: boolean }) {
  const { iso, lateMin } = useKickoff(fixture);
  const [open, setOpen] = useState(!compact);
  const [time, setTime] = useState(formatTime(iso));
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (value: string | null) => {
    if (value !== null) setTime(value);
    startTransition(async () => {
      setResult(await safely(() => setPlannedStart(fixture.id, value)));
    });
  };

  const shown = formatTime(iso);
  const printed = formatTime(fixture.scheduledTime);
  const summary =
    lateMin > 0
      ? `Phones show ${shown}, ${lateMin} min after the printed ${printed}.`
      : `Phones show the printed time, ${printed}.`;

  if (!open) {
    return (
      <div className={styles.timeRow}>
        <span className={styles.toolNote}>{summary}</span>
        <button
          type="button"
          className={`mg-btn ${styles.secondary}`}
          onClick={() => {
            setTime(shown);
            setResult(null);
            setOpen(true);
          }}
        >
          Change time
        </button>
      </div>
    );
  }

  return (
    <div className={styles.tool}>
      <p className={styles.toolTitle}>Change start time</p>
      <p className={styles.toolNote}>{summary}</p>
      <div className={styles.chips}>
        {[5, 10, 15].map((minutes) => (
          <button
            key={minutes}
            type="button"
            className={styles.chip}
            disabled={pending}
            onClick={() => set(later(iso, minutes))}
          >
            +{minutes} → {later(iso, minutes)}
          </button>
        ))}
      </div>
      <form
        className={styles.inline}
        onSubmit={(event) => {
          event.preventDefault();
          set(time);
        }}
      >
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Starts at</span>
          <input
            type="time"
            required
            min={printed}
            className={styles.input}
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </label>
        <button type="submit" className={`mg-btn ${styles.secondary}`} disabled={pending}>
          {pending ? "Saving…" : "Set"}
        </button>
      </form>
      <p className={styles.toolNote}>
        Later games on {fixture.courtName} move with it. It can&apos;t be earlier than {printed}.
      </p>
      {fixture.plannedStart ? (
        <button type="button" className={styles.linkish} disabled={pending} onClick={() => set(null)}>
          Clear — let the site work it out again
        </button>
      ) : null}
      {compact ? (
        <button type="button" className={styles.linkish} onClick={() => setOpen(false)}>
          Done
        </button>
      ) : null}
      <Result result={result} />
    </div>
  );
}

/** When it really kicked off — for a Start game tapped a few minutes late. */
export function KickoffFix({ fixture }: { fixture: Fixture }) {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(fixture.startedAt ? formatTime(fixture.startedAt) : "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className={styles.kickoffFix}>
      <p className={styles.toolNote}>
        {fixture.startedAt
          ? `Started ${formatTime(fixture.startedAt)}.`
          : "Start time not recorded."}{" "}
        {open ? null : (
          <button type="button" className={styles.linkish} onClick={() => setOpen(true)}>
            Change
          </button>
        )}
      </p>
      {open ? (
        <form
          className={styles.inline}
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const answer = await safely(() => correctKickoff(fixture.id, time));
              setResult(answer);
              if (answer.ok) setOpen(false);
            });
          }}
        >
          <label className="mg-sr-only" htmlFor={`kickoff-time-${fixture.id}`}>
            Real start time
          </label>
          <input
            id={`kickoff-time-${fixture.id}`}
            type="time"
            required
            className={styles.input}
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
          <button type="submit" className={`mg-btn ${styles.secondary}`} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      ) : null}
      <Result result={result} />
    </div>
  );
}
