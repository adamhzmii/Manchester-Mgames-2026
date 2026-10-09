"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import {
  ChangeTime,
  KickoffFix,
  OFFLINE_MESSAGE,
  Result,
  SaveState,
  StartButton,
  Stepper,
  safely,
  useScoreKeeper,
} from "@/components/scorer-controls";
import {
  assignFixtureTeam,
  moveFixture,
  unassignFixtureTeam,
  type ActionResult,
  type AssignTeamState,
} from "@/lib/actions/fixtures";
import type { Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";
import { resolveSlot } from "@/lib/progression";
import type { Court, PickerTeam, Venue } from "@/lib/queries";
import type { GroupMeta, TeamMeta } from "@/lib/standings";

import styles from "./score-console.module.css";

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
 * themselves a moment after the last tap, then Final whistle. The same
 * controls run the court sheet (/coordinate), where most scoring happens on
 * the day; this is the place for the rarer jobs too — filling a knockout
 * slot, moving a game.
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
  const keeper = useScoreKeeper(fixture);
  const { scoreA, scoreB, status, dirty, warning } = keeper;
  const ready = fixture.teamAId !== null && fixture.teamBId !== null;

  return (
    <section className={styles.console} aria-labelledby="console-title">
      <div className={styles.head}>
        <h2 id="console-title" className={styles.title}>
          Scorer
        </h2>
        <SaveState keeper={keeper} />
      </div>

      <p className={styles.sheetLink}>
        <Link href={`/coordinate?sport=${fixture.sportSlug}`}>
          Open the {fixture.sportName.toLowerCase()} court sheet →
        </Link>
      </p>

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
              onBump={(d) => keeper.bump("a", d)}
              onType={(v) => keeper.setScores(v, scoreB)}
            />
            <Stepper
              name={fixture.teamB}
              value={scoreB}
              onBump={(d) => keeper.bump("b", d)}
              onType={(v) => keeper.setScores(scoreA, v)}
            />
          </div>

          {warning ? (
            <p className={styles.warning} role="alert">
              {warning}
            </p>
          ) : null}

          <div className={styles.actions}>
            {status === "upcoming" ? (
              <StartButton fixture={fixture} fixtures={fixtures} onStart={keeper.start} />
            ) : status === "live" ? (
              <button type="button" className={`mg-btn ${styles.finish}`} onClick={keeper.finish}>
                Final whistle
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={`mg-btn ${styles.primary}`}
                  disabled={!dirty}
                  onClick={keeper.saveCorrection}
                >
                  Save correction
                </button>
                <button type="button" className={`mg-btn ${styles.secondary}`} onClick={keeper.reopen}>
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
                keeper.reset();
              }}
            >
              Started by mistake? Reset to not started
            </button>
          ) : null}
        </>
      )}

      {fixture.status === "upcoming" ? <ClearSlots fixture={fixture} /> : null}

      {/* Timing works whether or not the slots are filled: a semi-final can
          be running late, or move court, before anyone knows who plays. */}
      {fixture.status === "upcoming" ? (
        <>
          <ChangeTime fixture={fixture} />
          <MoveGame fixture={fixture} courts={courts} venues={venues} />
        </>
      ) : (
        <KickoffFix fixture={fixture} />
      )}
    </section>
  );
}

/**
 * "Assigned the wrong team?" — takes a team back out of a knockout slot so
 * it can be filled again. Only before kick-off, and only for sides drawn as
 * slots; the server checks both again.
 */
function ClearSlots({ fixture }: { fixture: Fixture }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const sides = (
    [
      { slot: "a", label: fixture.slotA, team: fixture.teamAId ? fixture.teamA : null },
      { slot: "b", label: fixture.slotB, team: fixture.teamBId ? fixture.teamB : null },
    ] as const
  ).filter((side) => side.label && side.team);
  if (sides.length === 0) return null;

  return (
    <div className={styles.tool}>
      <p className={styles.toolTitle}>Wrong team?</p>
      {sides.map((side) => (
        <div key={side.slot} className={styles.timeRow}>
          <span className={styles.toolNote}>
            <strong>{side.team}</strong> is in as {side.label}.
          </span>
          <button
            type="button"
            className={`mg-btn ${styles.secondary}`}
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Take ${side.team} out of "${side.label}"? You can then assign the right team.`)) return;
              startTransition(async () =>
                setResult(await safely(() => unassignFixtureTeam(fixture.id, side.slot))),
              );
            }}
          >
            Clear
          </button>
        </div>
      ))}
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
          startTransition(async () =>
            setResult(await safely(() => moveFixture(fixture.id, time, courtId))),
          );
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
  const [state, action, pending] = useActionState(
    async (previous: AssignTeamState, form: FormData): Promise<AssignTeamState> => {
      try {
        return await assignFixtureTeam(previous, form);
      } catch {
        return { status: "error", message: OFFLINE_MESSAGE };
      }
    },
    ASSIGN_IDLE,
  );
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

