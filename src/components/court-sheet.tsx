"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { AlertIcon, CheckIcon, ChevronRightIcon, ClockIcon } from "@/components/icons";
import {
  ChangeTime,
  KickoffFix,
  Result,
  SaveState,
  StartButton,
  Stepper,
  finishGame,
  saveGame,
  useScoreKeeper,
  type GameChange,
} from "@/components/scorer-controls";
import { SportBadge } from "@/components/sport-badge";
import { signOut } from "@/lib/actions/auth";
import type { ActionResult } from "@/lib/actions/fixtures";
import { useMinute } from "@/lib/clock";
import {
  courtStates,
  expectedStarts,
  type CourtAlert,
  type CourtState,
  type Expected,
} from "@/lib/delays";
import type { Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";
import { useLiveFixtures } from "@/lib/live-feed";
import { relative } from "@/lib/matchday";
import type { Sport } from "@/lib/queries";
import type { FixtureStatus } from "@/lib/supabase/types";
import { useStored } from "@/lib/use-stored";

import consoleStyles from "./score-console.module.css";
import styles from "./court-sheet.module.css";

const SPORT_KEY = "mgames26:coord-sport";
const courtsKey = (sport: string) => `mgames26:coord-courts:${sport}`;

/** A save this old that the feed still disagrees with is dropped: the feed wins. */
const OVERRIDE_MS = 90_000;
/** How long "Finished 21–19 · Undo" stays on a court. */
const UNDO_MS = 2 * 60_000;

type Override = GameChange & { at: number; startedAt?: string; finishedAt?: string };
type Recent = { fixtureId: string; from: FixtureStatus; to: FixtureStatus; at: number; text: string };

/**
 * The coordinators' screen for the day — the spreadsheet they used to keep,
 * where starting a game, scoring it and moving its time are one tap each.
 *
 * Pick a sport (remembered on the phone), narrow to the courts you look
 * after — two coordinators a sport, so badminton's eight courts split between
 * them — and each court shows what is on, what is next and how far behind it
 * is. "All sports" is the committee's view: every court, and anything that
 * looks wrong — a game live for far too long, one due and not started.
 *
 * Scores and status come from the shared live feed. A coordinator's own
 * saves are applied straight away rather than after the next poll, so a
 * started game moves into "Now playing" the moment the save lands.
 */
export function CourtSheet({
  initial,
  sports,
  askedSport,
  signedInAs,
}: {
  initial: Fixture[];
  sports: Sport[];
  askedSport: string | null;
  /** The coordinator account's name; null in a local rehearsal. */
  signedInAs: string | null;
}) {
  const feed = useLiveFixtures(initial);
  const now = useMinute();
  const [storedSport, setStoredSport] = useStored(SPORT_KEY);
  const [picked, setPicked] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Map<string, Override>>(new Map());
  const [recent, setRecent] = useState<Recent[]>([]);

  const sport = picked ?? askedSport ?? storedSport ?? "all";

  const fixtures = useMemo(() => applyOverrides(feed, overrides, now), [feed, overrides, now]);
  const expected = useMemo(
    () => (now === null ? new Map<string, Expected>() : expectedStarts(fixtures, now)),
    [fixtures, now],
  );
  const states = useMemo(
    () => (now === null ? [] : courtStates(fixtures, expected, now)),
    [fixtures, expected, now],
  );

  const pick = (slug: string) => {
    setPicked(slug);
    setStoredSport(slug);
    const url = new URL(window.location.href);
    url.searchParams.set("sport", slug);
    window.history.replaceState(window.history.state, "", url);
    window.scrollTo({ top: 0 });
  };

  const onChange = (change: GameChange) => {
    const before = fixtures.find((f) => f.id === change.fixtureId);
    const stamp = new Date().toISOString();
    setOverrides((current) => {
      const next = new Map(current);
      next.set(change.fixtureId, {
        ...change,
        at: Date.now(),
        startedAt: change.status === "live" && before?.status === "upcoming" ? stamp : undefined,
        finishedAt: change.status === "finished" ? stamp : undefined,
      });
      return next;
    });
    if (before && before.status !== change.status) {
      const text =
        change.status === "live"
          ? before.status === "upcoming"
            ? `Started ${before.teamA} v ${before.teamB}.`
            : `Reopened ${before.teamA} v ${before.teamB}.`
          : change.status === "finished"
            ? `Finished ${before.teamA} ${change.scoreA}–${change.scoreB} ${before.teamB}.`
            : `Reset ${before.teamA} v ${before.teamB} to not started.`;
      setRecent((list) => [
        { fixtureId: before.id, from: before.status, to: change.status, at: Date.now(), text },
        ...list.filter((r) => r.fixtureId !== before.id),
      ]);
    } else if (before) {
      setRecent((list) => list.filter((r) => r.fixtureId !== before.id || r.to === change.status));
    }
  };

  const forget = (fixtureId: string) =>
    setRecent((list) => list.filter((r) => r.fixtureId !== fixtureId));

  return (
    <div className={styles.page}>
      <div className={`mg-wrap ${styles.top}`}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Court sheet</h1>
          {signedInAs ? (
            // The way out on a borrowed or shared phone.
            <form action={signOut} className={styles.account}>
              <span className={styles.accountName}>{signedInAs}</span>
              <button type="submit" className={styles.signOut}>
                Sign out
              </button>
            </form>
          ) : null}
        </div>
        <p className={styles.lede}>
          Tap <strong>Start game</strong> when a game begins and <strong>Finish game</strong> when
          it ends. Times for every later game work themselves out.
        </p>

        <div className={styles.sports} role="tablist" aria-label="Sport">
          <button
            type="button"
            role="tab"
            aria-selected={sport === "all"}
            className={`${styles.sportTab} ${sport === "all" ? styles.sportTabOn : ""}`}
            onClick={() => pick("all")}
          >
            All sports
          </button>
          {sports.map((s) => (
            <button
              key={s.slug}
              type="button"
              role="tab"
              aria-selected={sport === s.slug}
              className={`${styles.sportTab} ${sport === s.slug ? styles.sportTabOn : ""}`}
              onClick={() => pick(s.slug)}
            >
              <SportBadge code={s.code} color={s.color} slug={s.slug} size={20} />
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mg-wrap">
        {now === null ? (
          <p className={styles.loading}>Loading courts…</p>
        ) : sport === "all" ? (
          <Overview states={states} sports={sports} fixtures={fixtures} expected={expected} now={now} onPick={pick} />
        ) : (
          <SportCourts
            key={sport}
            sport={sports.find((s) => s.slug === sport) ?? null}
            states={states.filter((c) => c.games.some((g) => g.sportSlug === sport))}
            fixtures={fixtures}
            expected={expected}
            recent={recent}
            now={now}
            onChange={onChange}
            onForget={forget}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The feed's fixtures with this phone's own recent saves laid over them,
 * until the feed has caught up with each one (or long enough has passed
 * that the feed must be right).
 */
function applyOverrides(
  feed: readonly Fixture[],
  overrides: ReadonlyMap<string, Override>,
  now: number | null,
): Fixture[] {
  if (overrides.size === 0) return [...feed];
  return feed.map((f) => {
    const o = overrides.get(f.id);
    if (!o || (now !== null && now - o.at > OVERRIDE_MS)) return f;
    if (f.status === o.status && f.scoreA === o.scoreA && f.scoreB === o.scoreB) return f;
    return {
      ...f,
      status: o.status,
      scoreA: o.scoreA,
      scoreB: o.scoreB,
      startedAt: o.status === "upcoming" ? null : (o.startedAt ?? f.startedAt),
      finishedAt: o.status === "finished" ? (o.finishedAt ?? f.finishedAt) : null,
    };
  });
}

// ------------------------------------------------------------ one sport ----

function SportCourts({
  sport,
  states,
  fixtures,
  expected,
  recent,
  now,
  onChange,
  onForget,
}: {
  sport: Sport | null;
  states: CourtState[];
  fixtures: Fixture[];
  expected: ReadonlyMap<string, Expected>;
  recent: Recent[];
  now: number;
  onChange: (change: GameChange) => void;
  onForget: (fixtureId: string) => void;
}) {
  const [stored, setStored] = useStored(courtsKey(sport?.slug ?? "none"));
  const chosen = parseCourts(stored).filter((key) => states.some((c) => c.key === key));
  const shown = chosen.length === 0 ? states : states.filter((c) => chosen.includes(c.key));

  const toggle = (key: string) => {
    const next = chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key];
    setStored(next.length === 0 || next.length === states.length ? null : JSON.stringify(next));
  };

  if (!sport || states.length === 0) {
    return <p className={styles.empty}>No games for this sport yet.</p>;
  }

  return (
    <>
      {states.length > 1 ? (
        <div className={styles.filter}>
          <p className={styles.filterLabel}>Your courts</p>
          <div className={styles.filterChips}>
            <button
              type="button"
              className={`${styles.courtChip} ${chosen.length === 0 ? styles.courtChipOn : ""}`}
              aria-pressed={chosen.length === 0}
              onClick={() => setStored(null)}
            >
              All {states.length}
            </button>
            {states.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`${styles.courtChip} ${chosen.includes(c.key) ? styles.courtChipOn : ""}`}
                aria-pressed={chosen.includes(c.key)}
                onClick={() => toggle(c.key)}
              >
                {c.courtName}
                {c.lateMin > 0 ? <span className={styles.chipLate}>+{c.lateMin}</span> : null}
                {c.alerts.length > 0 ? <AlertIcon size={13} /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.courts}>
        {shown.map((state) => (
          <CourtCard
            key={state.key}
            state={state}
            fixtures={fixtures}
            expected={expected}
            recent={recent.filter(
              (r) => now - r.at < UNDO_MS && state.games.some((g) => g.id === r.fixtureId),
            )}
            onChange={onChange}
            onForget={onForget}
          />
        ))}
      </div>
    </>
  );
}

function parseCourts(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function CourtCard({
  state,
  fixtures,
  expected,
  recent,
  onChange,
  onForget,
}: {
  state: CourtState;
  fixtures: Fixture[];
  expected: ReadonlyMap<string, Expected>;
  recent: Recent[];
  onChange: (change: GameChange) => void;
  onForget: (fixtureId: string) => void;
}) {
  const { live, next, lateMin, alerts, games } = state;
  const played = games.filter((g) => g.status === "finished").length;

  return (
    <section className={styles.court} aria-label={`${state.courtName}, ${state.venueShortName}`}>
      <header className={styles.courtHead}>
        <div>
          <h2 className={styles.courtName}>{state.courtName}</h2>
          <p className={styles.courtVenue}>{state.venueShortName}</p>
        </div>
        {next === null && live === null ? (
          <span className={styles.statusDone}>Done for the day</span>
        ) : lateMin > 0 ? (
          <span className={styles.statusLate}>
            <ClockIcon size={14} />
            {lateMin} min behind
          </span>
        ) : (
          <span className={styles.statusOk}>
            <CheckIcon size={14} />
            On time
          </span>
        )}
      </header>

      {recent.map((r) => (
        <UndoBar key={r.fixtureId} recent={r} fixtures={fixtures} onChange={onChange} onForget={onForget} />
      ))}

      {alerts.map((alert) => (
        <AlertBox key={`${alert.kind}-${alert.fixtureId}`} alert={alert} fixtures={fixtures} onChange={onChange} />
      ))}

      <div className={styles.block}>
        <p className={styles.blockLabel}>Now playing</p>
        {live ? (
          <LiveGame key={live.id} fixture={live} onChange={onChange} />
        ) : (
          <p className={styles.free}>Court free</p>
        )}
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>Up next</p>
        {next ? (
          <NextGame
            key={next.id}
            fixture={next}
            fixtures={fixtures}
            expected={expected.get(next.id)}
            courtBusy={live !== null}
            onChange={onChange}
          />
        ) : (
          <p className={styles.free}>No more games on this court.</p>
        )}
      </div>

      <details className={styles.day}>
        <summary className={styles.daySummary}>
          Full day on {state.courtName}
          <span className={styles.dayCount}>
            {played} of {games.length} played
          </span>
        </summary>
        <ol className={styles.dayList}>
          {games.map((g) => (
            <DayRow key={g.id} fixture={g} expected={expected.get(g.id)} current={g.id === live?.id || g.id === next?.id} />
          ))}
        </ol>
      </details>
    </section>
  );
}

/** The game being played: score it, finish it. */
function LiveGame({ fixture, onChange }: { fixture: Fixture; onChange: (change: GameChange) => void }) {
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
    </div>
  );
}

/** The game to start next: when it is now due, and the button. */
function NextGame({
  fixture,
  fixtures,
  expected,
  courtBusy,
  onChange,
}: {
  fixture: Fixture;
  fixtures: Fixture[];
  expected: Expected | undefined;
  courtBusy: boolean;
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
    </div>
  );
}

function DayRow({
  fixture,
  expected,
  current,
}: {
  fixture: Fixture;
  expected: Expected | undefined;
  current: boolean;
}) {
  const lateMin = fixture.status === "upcoming" ? (expected?.lateMin ?? 0) : 0;
  const shown = new Date(Date.parse(fixture.scheduledTime) + lateMin * 60_000).toISOString();
  return (
    <li>
      <Link href={`/match/${fixture.id}`} className={`${styles.row} ${current ? styles.rowCurrent : ""}`}>
        <span className={styles.rowTime}>
          {lateMin > 0 ? (
            <>
              <s>{formatTime(fixture.scheduledTime)}</s>
              <span className={styles.rowLate}>{formatTime(shown)}</span>
            </>
          ) : (
            formatTime(fixture.startedAt ?? fixture.scheduledTime)
          )}
        </span>
        <span className={styles.rowTeams}>
          {fixture.teamA} v {fixture.teamB}
        </span>
        <span className={styles.rowState}>
          {fixture.status === "finished"
            ? `${fixture.scoreA}–${fixture.scoreB}`
            : fixture.status === "live"
              ? "Live"
              : ""}
        </span>
        <ChevronRightIcon size={16} />
      </Link>
    </li>
  );
}

/** "Finished 21–19 · Undo" for a couple of minutes after a Start or Finish. */
function UndoBar({
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
function AlertBox({
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

// ----------------------------------------------------------- overview ----

/**
 * Every court on one screen, for whoever is running the day: what is on,
 * how far behind, when anyone last tapped anything there — and at the top,
 * the courts that need a phone call.
 */
function Overview({
  states,
  sports,
  fixtures,
  expected,
  now,
  onPick,
}: {
  states: CourtState[];
  sports: Sport[];
  fixtures: Fixture[];
  expected: ReadonlyMap<string, Expected>;
  now: number;
  onPick: (slug: string) => void;
}) {
  const sportOf = (c: CourtState) => c.games[0]?.sportSlug ?? "";
  const attention = states.flatMap((c) => c.alerts.map((alert) => ({ court: c, alert })));

  return (
    <div className={styles.overview}>
      <section className={styles.attention} aria-labelledby="attention-title">
        <h2 id="attention-title" className={styles.sectionTitle}>
          Needs attention
        </h2>
        {attention.length === 0 ? (
          <p className={styles.allGood}>
            <CheckIcon size={16} />
            Nothing looks wrong on any court.
          </p>
        ) : (
          <ul className={styles.attentionList}>
            {attention.map(({ court, alert }) => {
              const game = fixtures.find((f) => f.id === alert.fixtureId);
              return (
                <li key={`${court.key}-${alert.kind}-${alert.fixtureId}`}>
                  <button type="button" className={styles.attentionItem} onClick={() => onPick(sportOf(court))}>
                    <AlertIcon size={16} />
                    <span>
                      <strong>
                        {court.venueShortName} {court.courtName}
                      </strong>{" "}
                      — {game ? `${game.teamA} v ${game.teamB}` : "a game"}{" "}
                      {alert.kind === "long-live"
                        ? `live for ${alert.minutes} min`
                        : alert.kind === "left-live"
                          ? "still marked live after the next game began"
                          : `due ${alert.minutes} min ago, not started`}
                    </span>
                    <ChevronRightIcon size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {sports.map((sport) => {
        const courts = states.filter((c) => sportOf(c) === sport.slug);
        if (courts.length === 0) return null;
        const worst = Math.max(0, ...courts.map((c) => c.lateMin));
        return (
          <section key={sport.slug} className={styles.sportBlock}>
            <button type="button" className={styles.sportHead} onClick={() => onPick(sport.slug)}>
              <SportBadge code={sport.code} color={sport.color} slug={sport.slug} size={22} />
              <span className={styles.sportName}>{sport.name}</span>
              {worst > 0 ? (
                <span className={styles.chipLate}>up to {worst} min behind</span>
              ) : (
                <span className={styles.chipOk}>on time</span>
              )}
              <ChevronRightIcon size={18} />
            </button>
            <ul className={styles.overviewCourts}>
              {courts.map((c) => (
                <li key={c.key} className={styles.overviewCourt}>
                  <span className={styles.ocName}>
                    {c.courtName}
                    {c.alerts.length > 0 ? <AlertIcon size={13} /> : null}
                  </span>
                  <span className={styles.ocNow}>
                    {c.live ? (
                      <>
                        <span className={styles.liveDot} aria-hidden="true" />
                        {c.live.teamA} {c.live.scoreA ?? 0}–{c.live.scoreB ?? 0} {c.live.teamB}
                      </>
                    ) : c.next ? (
                      <>
                        Next {formatTime(new Date(Date.parse(c.next.scheduledTime) + (expected.get(c.next.id)?.lateMin ?? 0) * 60_000).toISOString())}
                        {" · "}
                        {c.next.teamA} v {c.next.teamB}
                      </>
                    ) : (
                      "Done for the day"
                    )}
                  </span>
                  <span className={styles.ocMeta}>
                    {c.lateMin > 0 ? <span className={styles.rowLate}>+{c.lateMin}</span> : null}
                    {c.lastTap !== null ? ` last tap ${relative(c.lastTap, now)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
