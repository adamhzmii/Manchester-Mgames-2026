"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AlertBox,
  CourtMoves,
  LiveGame,
  NextGame,
  UndoBar,
  type Recent,
} from "@/components/court-game";
import { CloseIcon } from "@/components/icons";
import type { GameChange } from "@/components/scorer-controls";
import { courtKey, type CourtState, type Expected } from "@/lib/delays";
import { byKickoff, categoryCode, type Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";

import styles from "./court-sheet.module.css";

const STAGE_TAG: Record<string, string> = {
  playoff: "PO",
  round_of_16: "R16",
  quarterfinal: "QF",
  semifinal: "SF",
  third_place: "3RD",
  final: "FINAL",
};

/**
 * The spreadsheet view of a sport's day: courts across, printed times down,
 * every game in its cell — done, live, next, still to come — so what is
 * happening on every court, and what follows, is one look. Badminton's and
 * pickleball's many courts are where the cards fell short.
 *
 * Tap a game to start, score, finish, move or award it; tap a court's name
 * for that court's own moves.
 */
export function CourtGrid({
  courts,
  allCourts,
  sportSlug,
  fixtures,
  expected,
  recent,
  onChange,
  onForget,
}: {
  /** The courts on screen (the coordinator's own). */
  courts: CourtState[];
  /** Every court of the sport, for moving games between them. */
  allCourts: CourtState[];
  sportSlug: string;
  fixtures: Fixture[];
  expected: ReadonlyMap<string, Expected>;
  recent: Recent[];
  onChange: (change: GameChange) => void;
  onForget: (fixtureId: string) => void;
}) {
  const [openGame, setOpenGame] = useState<string | null>(null);
  const [openCourt, setOpenCourt] = useState<string | null>(null);

  const { times, cells } = useMemo(() => {
    const at = new Map<string, Fixture[]>();
    const seen = new Set<string>();
    for (const court of courts) {
      for (const g of [...court.games].sort(byKickoff)) {
        const time = formatTime(g.scheduledTime);
        seen.add(`${Date.parse(g.scheduledTime)}|${time}`);
        const key = `${court.key}|${time}`;
        at.set(key, [...(at.get(key) ?? []), g]);
      }
    }
    const ordered = [...seen].sort((a, b) => Number(a.split("|")[0]) - Number(b.split("|")[0]));
    return { times: ordered.map((t) => t.split("|")[1]), cells: at };
  }, [courts]);

  const nextIds = new Set(courts.map((c) => c.next?.id).filter(Boolean) as string[]);
  const shownIds = new Set(courts.flatMap((c) => c.games.map((g) => g.id)));

  // Open where the day is up to: the first row with a game on or next.
  const grid = useRef<HTMLDivElement | null>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current) return;
    const target = grid.current?.querySelector<HTMLElement>("[data-now]");
    if (!target) return;
    scrolled.current = true;
    target.scrollIntoView({ block: "center" });
  }, [times]);

  const game = openGame ? fixtures.find((f) => f.id === openGame) ?? null : null;
  const gameCourt = game ? allCourts.find((c) => c.key === courtKey(game)) ?? null : null;
  const court = openCourt ? allCourts.find((c) => c.key === openCourt) ?? null : null;

  return (
    <>
      {recent
        .filter((r) => shownIds.has(r.fixtureId))
        .map((r) => (
          <UndoBar key={r.fixtureId} recent={r} fixtures={fixtures} onChange={onChange} onForget={onForget} />
        ))}
      {courts.flatMap((c) =>
        c.alerts.map((alert) => (
          <AlertBox
            key={`${c.key}-${alert.kind}-${alert.fixtureId}`}
            alert={alert}
            fixtures={fixtures}
            onChange={onChange}
          />
        )),
      )}

      {/* Up to four courts fit a phone, with their names pinned while the
          day scrolls past; more scroll sideways instead. */}
      <div className={courts.length > 4 ? styles.gridWrapScroll : styles.gridWrap}>
        <div
          ref={grid}
          className={styles.grid}
          style={{
            gridTemplateColumns: `40px repeat(${courts.length}, minmax(0, 1fr))`,
            minWidth: courts.length > 4 ? 40 + courts.length * 96 : undefined,
          }}
        >
          <div className={styles.gridCorner} />
          {courts.map((c) => (
            <button
              key={c.key}
              type="button"
              className={styles.gridHead}
              onClick={() => setOpenCourt(c.key)}
            >
              <span>{c.courtName.replace(/^Court\s+/, "")}</span>
              {c.lateMin > 0 ? <span className={styles.gridHeadLate}>+{c.lateMin}</span> : null}
            </button>
          ))}

          {times.map((time) => {
            const row = courts.map((c) => cells.get(`${c.key}|${time}`) ?? []);
            const now = row.some((games) => games.some((g) => g.status === "live" || nextIds.has(g.id)));
            return (
              <div key={time} className={styles.gridRow}>
                <div className={styles.gridTime} data-now={now ? "" : undefined}>
                  {time}
                </div>
                {row.map((games, i) => (
                  <div key={courts[i].key} className={styles.gridCell}>
                    {games.map((g) => (
                      <GameCell
                        key={g.id}
                        game={g}
                        next={nextIds.has(g.id)}
                        expected={expected.get(g.id)}
                        onOpen={() => setOpenGame(g.id)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {game ? (
        <Panel title={`${game.teamA} v ${game.teamB}`} sub={panelSub(game)} onClose={() => setOpenGame(null)}>
          {game.status === "live" ? (
            <LiveGame key={`${game.id}-live`} fixture={game} onChange={onChange} />
          ) : game.status === "upcoming" ? (
            <NextGame
              key={`${game.id}-next`}
              fixture={game}
              fixtures={fixtures}
              expected={expected.get(game.id)}
              courtBusy={gameCourt?.live != null && gameCourt.live.id !== game.id}
              courts={allCourts}
              onChange={onChange}
            />
          ) : (
            <div className={styles.game}>
              <p className={styles.teams}>
                {game.teamA} {game.scoreA}–{game.scoreB} {game.teamB}
              </p>
              <p className={styles.gameMeta}>
                Finished{game.finishedAt ? ` at ${formatTime(game.finishedAt)}` : ""}.
              </p>
            </div>
          )}
          <Link href={`/match/${game.id}`} className={styles.panelLink}>
            {game.status === "finished" ? "Open the game to correct or reopen it →" : "Open the full game page →"}
          </Link>
        </Panel>
      ) : null}

      {court ? (
        <Panel title={court.courtName} sub={court.venueShortName} onClose={() => setOpenCourt(null)}>
          <p className={styles.gameMeta}>
            {court.live ? `Now: ${court.live.teamA} v ${court.live.teamB}. ` : "Free right now. "}
            {court.next ? `Next: ${court.next.teamA} v ${court.next.teamB}.` : "No more games here."}
          </p>
          <CourtMoves court={court} courts={allCourts} sportSlug={sportSlug} />
        </Panel>
      ) : null}
    </>
  );
}

function panelSub(game: Fixture): string {
  const code = categoryCode(game);
  return [code, game.stageLabel, game.courtName, formatTime(game.scheduledTime)].filter(Boolean).join(" · ");
}

/** One game in the grid: what it is, and where it stands, at a glance. */
function GameCell({
  game,
  next,
  expected,
  onOpen,
}: {
  game: Fixture;
  next: boolean;
  expected: Expected | undefined;
  onOpen: () => void;
}) {
  const tag = STAGE_TAG[game.stage] ?? categoryCode(game) ?? (game.groupName?.replace(/^Group\s+/i, "GRP ") ?? "");
  const state = game.status === "live" ? "live" : game.status === "finished" ? "done" : next ? "next" : "later";
  const late = game.status === "upcoming" && (expected?.lateMin ?? 0) > 0;
  const moved = late
    ? formatTime(new Date(Date.parse(game.scheduledTime) + expected!.lateMin * 60_000).toISOString())
    : null;

  return (
    <button type="button" className={styles.cell} data-state={state} onClick={onOpen}>
      <span className={styles.cellTop}>
        <span className={styles.cellTag}>{tag}</span>
        <span className={styles.cellStatus}>
          {state === "live" ? "LIVE" : state === "done" ? "FT" : state === "next" ? "NEXT" : moved ? `→${moved}` : ""}
        </span>
      </span>
      <span className={styles.cellTeam}>
        <span className={styles.cellName}>{game.teamA}</span>
        {game.status !== "upcoming" ? <span className={styles.cellScore}>{game.scoreA}</span> : null}
      </span>
      <span className={styles.cellTeam}>
        <span className={styles.cellName}>{game.teamB}</span>
        {game.status !== "upcoming" ? <span className={styles.cellScore}>{game.scoreB}</span> : null}
      </span>
      {state === "next" && moved ? <span className={styles.cellMoved}>now {moved}</span> : null}
    </button>
  );
}

/** A sheet over the grid, for one game or one court. */
function Panel({
  title,
  sub,
  onClose,
  children,
}: {
  title: string;
  sub: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.panelBackdrop} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.panelHead}>
          <div>
            <p className={styles.panelTitle}>{title}</p>
            <p className={styles.panelSub}>{sub}</p>
          </div>
          <button type="button" className={styles.panelClose} onClick={onClose} aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
