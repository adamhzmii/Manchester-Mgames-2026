"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { useKickoff } from "@/components/delays";
import { CheckIcon, MinusIcon, PlusIcon } from "@/components/icons";
import {
  assignFixtureTeam,
  correctKickoff,
  moveFixture,
  setFixtureDelay,
  updateFixtureScore,
  type ActionResult,
  type AssignTeamState,
} from "@/lib/actions/fixtures";
import type { Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";
import { resolveSlot } from "@/lib/progression";
import type { Court, PickerTeam, Venue } from "@/lib/queries";
import type { GroupMeta, TeamMeta } from "@/lib/standings";
import type { FixtureStatus } from "@/lib/supabase/types";

import styles from "./score-console.module.css";

/** How long after the last tap a live score saves itself. */
const AUTOSAVE_MS = 900;

type Save =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; at: number }
  | { state: "error"; message: string };

type ScoreConsoleProps = {
  fixture: Fixture;
  fixtures: Fixture[];
  teams: PickerTeam[];
  groups: (GroupMeta & { sportSlug: string })[];
  standingTeams: (TeamMeta & { sportSlug: string })[];
  courts: Court[];
  venues: Venue[];
};

/**
 * The coordinator's courtside console, on the match page itself.
 *
 * Built for one hand and a phone: Start game, then big +/− buttons that save
 * themselves a moment after the last tap, then Final whistle. The first
 * version was a form with two text boxes and a Save button — fine at a desk,
 * slow when the next point is already being played.
 *
 * Every write still goes through the same server action, and the RLS policy
 * on `fixtures` is what decides whether it lands; showing this console to the
 * wrong person would let them press buttons, not change scores.
 */
export function ScoreConsole({
  fixture,
  fixtures,
  teams,
  groups,
  standingTeams,
  courts,
  venues,
}: ScoreConsoleProps) {
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
    const form = new FormData();
    form.set("fixtureId", fixture.id);
    form.set("status", next.status);
    form.set("scoreA", next.a === null ? "" : String(next.a));
    form.set("scoreB", next.b === null ? "" : String(next.b));

    setSave({ state: "saving" });
    startTransition(async () => {
      const result = await updateFixtureScore({ status: "idle", message: null }, form);
      if (result.status === "success") {
        setDirty(false);
        setSave({ state: "saved", at: Date.now() });
      } else {
        setSave({ state: "error", message: result.message ?? "Could not save." });
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

  const ready = fixture.teamAId !== null && fixture.teamBId !== null;
  const knockout = fixture.stage !== "group";

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
    if (knockout && a === b) {
      setWarning("Knockout games can't end level. Record the deciding score so a winner goes through.");
      return;
    }
    setStatus("finished");
    persist({ status: "finished", a, b });
  };

  return (
    <section className={styles.console} aria-labelledby="console-title">
      <div className={styles.head}>
        <h2 id="console-title" className={styles.title}>
          Scorer
        </h2>
        <SaveState save={save} dirty={dirty} status={status} />
      </div>

      {!ready ? (
        <div className={styles.assign}>
          <p className={styles.assignIntro}>
            Fill this slot before the game starts. Where the result already decides it, the team is
            suggested.
          </p>
          {fixture.teamAId === null ? (
            <AssignSlot
              fixture={fixture}
              slot="a"
              teams={teams}
              suggestion={resolveSlot(fixture.teamA, fixture, fixtures, groups, standingTeams)}
            />
          ) : null}
          {fixture.teamBId === null ? (
            <AssignSlot
              fixture={fixture}
              slot="b"
              teams={teams}
              suggestion={resolveSlot(fixture.teamB, fixture, fixtures, groups, standingTeams)}
            />
          ) : null}
        </div>
      ) : (
        <>
          <div className={styles.sides}>
            <Stepper
              name={fixture.teamA}
              value={scoreA}
              onBump={(d) => bump("a", d)}
              onType={(v) => setScores(v, scoreB)}
            />
            <Stepper
              name={fixture.teamB}
              value={scoreB}
              onBump={(d) => bump("b", d)}
              onType={(v) => setScores(scoreA, v)}
            />
          </div>

          {warning ? (
            <p className={styles.warning} role="alert">
              {warning}
            </p>
          ) : null}

          <div className={styles.actions}>
            {status === "upcoming" ? (
              <button type="button" className={`mg-btn ${styles.primary}`} onClick={start}>
                Start game
              </button>
            ) : status === "live" ? (
              <button type="button" className={`mg-btn ${styles.finish}`} onClick={finish}>
                Final whistle
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={`mg-btn ${styles.primary}`}
                  disabled={!dirty}
                  onClick={() => persist({ status: "finished", a: scoreA, b: scoreB })}
                >
                  Save correction
                </button>
                <button
                  type="button"
                  className={`mg-btn ${styles.secondary}`}
                  onClick={() => {
                    setStatus("live");
                    persist({ status: "live", a: scoreA, b: scoreB });
                  }}
                >
                  Reopen
                </button>
              </>
            )}
          </div>

          {status !== "upcoming" ? (
            <button
              type="button"
              className={styles.reset}
              onClick={() => {
                if (!window.confirm("Reset this game to not started? Its score will be cleared.")) return;
                setStatus("upcoming");
                setScoreA(null);
                setScoreB(null);
                persist({ status: "upcoming", a: null, b: null });
              }}
            >
              Started by mistake? Reset to not started
            </button>
          ) : null}
        </>
      )}

      {/* Timing works whether or not the slots are filled: a semi-final can
          be running late, or move court, before anyone knows who plays. */}
      {fixture.status === "upcoming" ? (
        <>
          <StartingLate fixture={fixture} />
          <MoveGame fixture={fixture} courts={courts} venues={venues} />
        </>
      ) : (
        <KickoffFix fixture={fixture} />
      )}
    </section>
  );
}

/** A server action's answer, under the control that asked. */
function Result({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p className={result.ok ? styles.done : styles.warning} role="status">
      {result.message}
    </p>
  );
}

const LATE_STEPS = [0, 5, 10, 15, 20, 30];

/**
 * "Starting late", before kick-off: a team not here, the court not clear.
 * One tap moves this game's time on every phone, and the court's later games
 * with it.
 */
function StartingLate({ fixture }: { fixture: Fixture }) {
  const { iso, lateMin } = useKickoff(fixture);
  const [chosen, setChosen] = useState(fixture.delayMinutes);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  // Follow another coordinator's change, as the scores do.
  const [seen, setSeen] = useState(fixture.delayMinutes);
  if (fixture.delayMinutes !== seen) {
    setSeen(fixture.delayMinutes);
    setChosen(fixture.delayMinutes);
  }

  const pick = (minutes: number) => {
    setChosen(minutes);
    startTransition(async () => setResult(await setFixtureDelay(fixture.id, minutes)));
  };

  return (
    <div className={styles.tool}>
      <p className={styles.toolTitle}>Starting late?</p>
      <div className={styles.chips} role="radiogroup" aria-label="How late this game will start">
        {LATE_STEPS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            role="radio"
            aria-checked={chosen === minutes}
            className={`${styles.chip} ${chosen === minutes ? styles.chipOn : ""}`}
            disabled={pending}
            onClick={() => pick(minutes)}
          >
            {minutes === 0 ? "On time" : `+${minutes}`}
          </button>
        ))}
      </div>
      <p className={styles.toolNote}>
        {lateMin === 0
          ? `Phones show kick-off at ${formatTime(fixture.scheduledTime)}. Later games on ${fixture.courtName} move with this one.`
          : chosen === 0
            ? `${fixture.courtName} is running behind, so phones already show ${formatTime(iso)} (${lateMin} min late). Only add more if you know it will be later still.`
            : `Phones show kick-off at ${formatTime(iso)}, ${lateMin} min late. Later games on ${fixture.courtName} move with it.`}
      </p>
      <Result result={result} />
    </div>
  );
}

/** When it really kicked off — for a Start game tapped a few minutes late. */
function KickoffFix({ fixture }: { fixture: Fixture }) {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(fixture.startedAt ? formatTime(fixture.startedAt) : "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className={styles.kickoffFix}>
      <p className={styles.toolNote}>
        {fixture.startedAt
          ? `Kicked off ${formatTime(fixture.startedAt)}.`
          : "Kick-off time not recorded."}{" "}
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
              const answer = await correctKickoff(fixture.id, time);
              setResult(answer);
              if (answer.ok) setOpen(false);
            });
          }}
        >
          <label className="mg-sr-only" htmlFor="kickoff-time">
            Real kick-off time
          </label>
          <input
            id="kickoff-time"
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

/**
 * Moves a game for good — a new official time, another court. Folded away:
 * it is the rare tool, and the scorer above it is the common one.
 */
function MoveGame({ fixture, courts, venues }: { fixture: Fixture; courts: Court[]; venues: Venue[] }) {
  const [time, setTime] = useState(formatTime(fixture.scheduledTime));
  const [courtId, setCourtId] = useState(fixture.courtId ?? "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const venueName = (slug: string) => venues.find((v) => v.slug === slug)?.shortName ?? slug;
  const options = [...courts].sort(
    (a, b) =>
      venues.findIndex((v) => v.slug === a.venueSlug) - venues.findIndex((v) => v.slug === b.venueSlug) ||
      a.name.localeCompare(b.name, undefined, { numeric: true }),
  );

  return (
    <details className={styles.move}>
      <summary className={styles.moveSummary}>Move this game</summary>
      <form
        className={styles.moveBody}
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => setResult(await moveFixture(fixture.id, time, courtId)));
        }}
      >
        <div className={styles.moveFields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>New kick-off</span>
            <input
              type="time"
              required
              className={styles.input}
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Court</span>
            <select
              className={styles.select}
              value={courtId}
              onChange={(event) => setCourtId(event.target.value)}
            >
              {options.map((court) => (
                <option key={court.id} value={court.id}>
                  {venueName(court.venueSlug)} · {court.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className={styles.toolNote}>
          This changes the official time and place. Anyone following either team gets a
          notification.
        </p>
        <button type="submit" className={`mg-btn ${styles.primary}`} disabled={pending}>
          {pending ? "Moving…" : "Move game"}
        </button>
        <Result result={result} />
      </form>
    </details>
  );
}

function SaveState({ save, dirty, status }: { save: Save; dirty: boolean; status: FixtureStatus }) {
  if (save.state === "saving") return <span className={styles.saving}>Saving…</span>;
  if (save.state === "error") return <span className={styles.error}>{save.message}</span>;
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

function Stepper({
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

const ASSIGN_IDLE: AssignTeamState = { status: "idle", message: null };

/**
 * Fills one knockout slot. Its own form, separate from the score: filling a
 * semi-final the moment its group ends has no score to go with it.
 */
function AssignSlot({
  fixture,
  slot,
  teams,
  suggestion,
}: {
  fixture: Fixture;
  slot: "a" | "b";
  teams: PickerTeam[];
  suggestion: { id: string; name: string } | null;
}) {
  const [state, action, pending] = useActionState(assignFixtureTeam, ASSIGN_IDLE);
  const eligible = teams.filter((t) => t.categoryId === fixture.categoryId);
  const label = slot === "a" ? fixture.teamA : fixture.teamB;
  const fieldId = `assign-${slot}`;

  // Two forms sharing one action: the suggestion and the manual choice each
  // submit exactly one teamId, so the server never has to guess which.
  const hidden = (
    <>
      <input type="hidden" name="fixtureId" value={fixture.id} />
      <input type="hidden" name="slot" value={slot} />
    </>
  );

  return (
    <div className={styles.slot}>
      <p className={styles.slotLabel}>{label}</p>

      {suggestion ? (
        <form action={action}>
          {hidden}
          <input type="hidden" name="teamId" value={suggestion.id} />
          <button type="submit" className={styles.suggest} disabled={pending}>
            <span className={styles.suggestLead}>Suggested from results</span>
            <span className={styles.suggestTeam}>
              {pending ? "Assigning…" : `Assign ${suggestion.name}`}
            </span>
          </button>
        </form>
      ) : null}

      <form action={action} className={styles.manual}>
        {hidden}
        <label className="mg-sr-only" htmlFor={fieldId}>
          Choose the team for {label}
        </label>
        <select id={fieldId} name="teamId" className={styles.select} defaultValue="" required>
          <option value="" disabled>
            {suggestion ? "Or choose another team" : "Choose team"}
          </option>
          {eligible.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <button type="submit" className={`mg-btn ${styles.secondary}`} disabled={pending}>
          Assign
        </button>
      </form>

      {state.status === "error" && state.message ? (
        <p className={styles.warning} role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

