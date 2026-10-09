"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { AlertIcon, CheckIcon } from "@/components/icons";
import {
  ChangeTime,
  finishGame,
  saveGame,
  KickoffFix,
  Result,
  SaveState,
  StartButton,
  Stepper,
  safely,
  useScoreKeeper,
  type GameChange,
} from "@/components/scorer-controls";
import {
  awardGame,
  moveCourtGames,
  playLater,
  playNowOn,
  swapWithNext,
  type ActionResult,
} from "@/lib/actions/fixtures";
import type { CourtAlert, CourtState, Expected } from "@/lib/delays";
import type { Fixture } from "@/lib/fixtures";
import type { FixtureStatus } from "@/lib/supabase/types";
import { formatTime } from "@/lib/format";
import { laterTime, nextOnCourt, walkoverScore } from "@/lib/reschedule";

import styles from "./court-sheet.module.css";
import consoleStyles from "./score-console.module.css";

/**
 * One game on the court sheet — the one being played, the one up next —
 * and the moves a coordinator makes with it on the day: swap it with the
 * next game, play it on a free court, push it to the end, award a walkover.
 * Shared by the sheet's cards and its grid.
 */

/** The game being played: score it, finish it. */
export function LiveGame({
  fixture,
  onChange,
}: {
  fixture: Fixture;
  onChange: (change: GameChange) => void;
}) {
  const keeper = useScoreKeeper(fixture, onChange);
  const { scoreA, scoreB, warning } = keeper;

  return (
    <div className={styles.game}>
      <p className={styles.gameMeta}>
        <span className={styles.liveDot} aria-hidden="true" />
        Live · {fixture.stageLabel}
        {fixture.categoryName && fixture.categoryName !== "Open" ? ` · ${fixture.categoryName}` : ""}
      </p>
      <div className={consoleStyles.sides}>
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
        <p className={consoleStyles.warning} role="alert">
          {warning}
        </p>
      ) : null}
      <button type="button" className={`mg-btn ${consoleStyles.finish} ${styles.big}`} onClick={keeper.finish}>
        Finish game
      </button>
      <div className={styles.gameFoot}>
        <SaveState keeper={keeper} />
      </div>
      <KickoffFix fixture={fixture} />
      <button
        type="button"
        className={consoleStyles.reset}
        onClick={() => {
          if (!window.confirm("Reset this game to not started? Its score will be cleared.")) return;
          keeper.reset();
        }}
      >
        Started by mistake? Reset to not started
      </button>
      <Award fixture={fixture} onChange={onChange} live />
    </div>
  );
}

/** The game to start next: when it is now due, and the button. */
export function NextGame({
  fixture,
  fixtures,
  expected,
  courtBusy,
  courts,
  onChange,
}: {
  fixture: Fixture;
  fixtures: Fixture[];
  expected: Expected | undefined;
  courtBusy: boolean;
  /** The sport's courts, for "play on a free court now". */
  courts: CourtState[];
  onChange: (change: GameChange) => void;
}) {
  const keeper = useScoreKeeper(fixture, onChange);
  const ready = fixture.teamAId !== null && fixture.teamBId !== null;
  const lateMin = expected?.lateMin ?? 0;
  const shown = new Date(Date.parse(fixture.scheduledTime) + lateMin * 60_000).toISOString();

  return (
    <div className={styles.game}>
      <p className={styles.gameMeta}>
        {fixture.stageLabel}
        {fixture.categoryName && fixture.categoryName !== "Open" ? ` · ${fixture.categoryName}` : ""}
      </p>
      <p className={styles.teams}>
        {fixture.teamA} <span className={styles.vs}>v</span> {fixture.teamB}
      </p>
      <p className={styles.when}>
        {lateMin > 0 ? (
          <>
            <s className={styles.was}>{formatTime(fixture.scheduledTime)}</s>
            <span className={styles.nowTime}>{formatTime(shown)}</span>
            <span className={styles.lateTag}>+{lateMin} min</span>
          </>
        ) : (
          <>
            <span className={styles.onTimeTime}>{formatTime(fixture.scheduledTime)}</span>
            <span className={styles.onTimeTag}>on time</span>
          </>
        )}
      </p>
      {expected?.overdue && !courtBusy ? (
        <p className={styles.due}>Due now — tap Start game the moment it begins.</p>
      ) : null}

      {ready ? (
        <StartButton
          fixture={fixture}
          fixtures={fixtures}
          onStart={keeper.start}
          onChange={onChange}
          className={styles.big}
        />
      ) : (
        <Link href={`/match/${fixture.id}`} className={`mg-btn ${consoleStyles.secondary} ${styles.big}`}>
          Set the teams first
        </Link>
      )}
      <div className={styles.gameFoot}>
        <SaveState keeper={keeper} />
      </div>
      <ChangeTime fixture={fixture} compact kickoff={{ iso: shown, lateMin }} />
      <GameMoves fixture={fixture} fixtures={fixtures} courts={courts} onChange={onChange} />
    </div>
  );
}

/**
 * The day's reshuffles for a game that hasn't started, behind one "Move or
 * award" fold so the big Start button stays the obvious thing on the card.
 */
export function GameMoves({
  fixture,
  fixtures,
  courts,
  onChange,
}: {
  fixture: Fixture;
  fixtures: Fixture[];
  courts: CourtState[];
  onChange: (change: GameChange) => void;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => setResult(await safely(action)));
  };

  const next = nextOnCourt(fixture, fixtures);
  const later = laterTime(fixture, fixtures);
  const free = courts.filter((c) => c.live === null && c.courtId && c.courtId !== fixture.courtId);

  return (
    <details className={styles.moves}>
      <summary className={styles.movesSummary}>Move or award this game</summary>
      <div className={styles.movesBody}>
        {next ? (
          <button
            type="button"
            className={styles.moveButton}
            disabled={pending}
            onClick={() =>
              run(
                () => swapWithNext(fixture.id),
                `Swap with ${next.teamA} v ${next.teamB}? They play at ${formatTime(fixture.scheduledTime)} and this game moves to ${formatTime(next.scheduledTime)}. Both teams are told.`,
              )
            }
          >
            <strong>Swap with next game</strong>
            <span>
              {next.teamA} v {next.teamB} goes first, at {formatTime(fixture.scheduledTime)}
            </span>
          </button>
        ) : null}

        {free.length > 0 ? (
          <div className={styles.moveGroup}>
            <p className={styles.moveLabel}>Play on a free court now</p>
            <div className={styles.moveChips}>
              {free.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={styles.moveChip}
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => playNowOn(fixture.id, c.courtId!),
                      `Move ${fixture.teamA} v ${fixture.teamB} to ${c.courtName}, starting now?`,
                    )
                  }
                >
                  {c.courtName}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {later ? (
          <button
            type="button"
            className={styles.moveButton}
            disabled={pending}
            onClick={() =>
              run(
                () => playLater(fixture.id),
                `Move ${fixture.teamA} v ${fixture.teamB} to the end of ${fixture.courtName}, at ${formatTime(later)}?`,
              )
            }
          >
            <strong>Play later</strong>
            <span>
              Last on {fixture.courtName}, at {formatTime(later)}
            </span>
          </button>
        ) : null}

        <Award fixture={fixture} onChange={onChange} />
        <Result result={result} />
      </div>
    </details>
  );
}

/**
 * A walkover: a team that didn't turn up, or (during a game) one that
 * couldn't carry on. The other side wins by the sport's walkover score.
 */
function Award({
  fixture,
  onChange,
  live = false,
}: {
  fixture: Fixture;
  onChange: (change: GameChange) => void;
  live?: boolean;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  if (fixture.teamAId === null || fixture.teamBId === null) return null;
  const score = walkoverScore(fixture.sportSlug, fixture.stage);

  const award = (side: "a" | "b") => {
    const [won, lost] = side === "a" ? [fixture.teamA, fixture.teamB] : [fixture.teamB, fixture.teamA];
    if (!window.confirm(`${won} win ${score}–0 by walkover against ${lost}?`)) return;
    startTransition(async () => {
      const answer = await safely(() => awardGame(fixture.id, side));
      setResult(answer);
      if (answer.ok) {
        onChange({
          fixtureId: fixture.id,
          status: "finished",
          scoreA: side === "a" ? score : 0,
          scoreB: side === "b" ? score : 0,
        });
      }
    });
  };

  return (
    <div className={styles.moveGroup}>
      <p className={styles.moveLabel}>
        {live ? "Ended early — a team can't carry on?" : "A team didn't turn up?"} Walkover, {score}–0 to:
      </p>
      <div className={styles.moveChips}>
        <button type="button" className={styles.moveChip} disabled={pending} onClick={() => award("a")}>
          {fixture.teamA}
        </button>
        <button type="button" className={styles.moveChip} disabled={pending} onClick={() => award("b")}>
          {fixture.teamB}
        </button>
      </div>
      <Result result={result} />
    </div>
  );
}

/**
 * A court that can't be used — a spill, a broken net: its games of this
 * sport move to another court, keeping their times.
 */
export function CourtMoves({
  court,
  courts,
  sportSlug,
}: {
  court: CourtState;
  courts: CourtState[];
  sportSlug: string;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const others = courts.filter((c) => c.key !== court.key && c.courtId);
  // Kept on screen after a move empties the court, so its answer shows.
  if (!result && (!court.courtId || others.length === 0 || court.next === null)) return null;

  return (
    <details className={styles.moves}>
      <summary className={styles.movesSummary}>{court.courtName} can&apos;t be used?</summary>
      <div className={styles.movesBody}>
        <p className={styles.moveLabel}>Move its games still to play, at the same times, to:</p>
        <div className={styles.moveChips}>
          {others.map((c) => (
            <button
              key={c.key}
              type="button"
              className={styles.moveChip}
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Move every game still to play on ${court.courtName} to ${c.courtName}?`)) return;
                startTransition(async () =>
                  setResult(await safely(() => moveCourtGames(court.courtId!, c.courtId!, sportSlug))),
                );
              }}
            >
              {c.courtName}
            </button>
          ))}
        </div>
        <Result result={result} />
      </div>
    </details>
  );
}

/** A Start or Finish just tapped, offered for undoing. */
export type Recent = { fixtureId: string; from: FixtureStatus; to: FixtureStatus; at: number; text: string };

/** "Finished 21–19 · Undo" for a couple of minutes after a Start or Finish. */
export function UndoBar({
  recent,
  fixtures,
  onChange,
  onForget,
}: {
  recent: Recent;
  fixtures: Fixture[];
  onChange: (change: GameChange) => void;
  onForget: (fixtureId: string) => void;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const game = fixtures.find((f) => f.id === recent.fixtureId);
  if (!game) return null;

  const undo = () =>
    startTransition(async () => {
      // Back to how it was: a start undone clears the score, a finish undone
      // puts the game back on with the score it had.
      const a = recent.from === "upcoming" ? null : game.scoreA;
      const b = recent.from === "upcoming" ? null : game.scoreB;
      const answer = await saveGame(game.id, recent.from, a, b);
      setResult(answer);
      if (!answer.ok) return;
      onChange({ fixtureId: game.id, status: recent.from, scoreA: a, scoreB: b });
      onForget(game.id);
    });

  return (
    <div className={styles.undo} role="status">
      <CheckIcon size={15} />
      <span className={styles.undoText}>{recent.text}</span>
      <button type="button" className={styles.undoButton} disabled={pending} onClick={undo}>
        {pending ? "Undoing…" : "Undo"}
      </button>
      <Result result={result && !result.ok ? result : null} />
    </div>
  );
}

/** Something on the court that looks wrong, with the fix where there is one. */
export function AlertBox({
  alert,
  fixtures,
  onChange,
}: {
  alert: CourtAlert;
  fixtures: Fixture[];
  onChange: (change: GameChange) => void;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const game = fixtures.find((f) => f.id === alert.fixtureId);
  if (!game) return null;
  const name = `${game.teamA} v ${game.teamB}`;

  if (alert.kind === "left-live") {
    const level = game.stage !== "group" && (game.scoreA ?? 0) === (game.scoreB ?? 0);
    return (
      <div className={styles.alert} role="alert">
        <AlertIcon size={16} />
        <div className={styles.alertBody}>
          <p>
            <strong>{name}</strong> is still marked live, but a later game here has started.
          </p>
          {level ? (
            <Link href={`/match/${game.id}`} className={styles.alertAction}>
              Open it to record the result
            </Link>
          ) : (
            <button
              type="button"
              className={styles.alertAction}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const done = await finishGame(game);
                  setResult(done);
                  if (done.ok) {
                    onChange({
                      fixtureId: game.id,
                      status: "finished",
                      scoreA: game.scoreA ?? 0,
                      scoreB: game.scoreB ?? 0,
                    });
                  }
                })
              }
            >
              {pending ? "Saving…" : `Finish it ${game.scoreA ?? 0}–${game.scoreB ?? 0}`}
            </button>
          )}
          <Result result={result} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.alert} role="alert">
      <AlertIcon size={16} />
      <div className={styles.alertBody}>
        {alert.kind === "long-live" ? (
          <p>
            <strong>{name}</strong> has been live for {alert.minutes} min. If it has ended, tap
            Finish game.
          </p>
        ) : (
          <p>
            <strong>{name}</strong> was due {alert.minutes} min ago. Tap Start game when it begins,
            or change its time.
          </p>
        )}
      </div>
    </div>
  );
}

