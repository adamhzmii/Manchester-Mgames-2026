"use client";

import { useActionState, useEffect, useRef } from "react";

import { CloseIcon } from "@/components/icons";
import type { PickerTeam } from "@/components/schedule-view";
import {
  assignFixtureTeam,
  updateFixtureScore,
  type AssignTeamState,
  type UpdateFixtureState,
} from "@/lib/actions/fixtures";
import type { Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";

import styles from "./score-editor.module.css";

const INITIAL: UpdateFixtureState = { status: "idle", message: null };
const ASSIGN_INITIAL: AssignTeamState = { status: "idle", message: null };

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "live", label: "Live" },
  { value: "finished", label: "Finished" },
] as const;

/**
 * The coordinator's edit sheet: two score boxes and a status.
 *
 * Deliberately a bottom sheet — it is used one-handed, standing courtside,
 * usually while the game is still going.
 */
export function ScoreEditor({
  fixture,
  teams,
  onClose,
}: {
  fixture: Fixture;
  teams: PickerTeam[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateFixtureScore, INITIAL);
  const sheetRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Close on a successful save; realtime pushes the new score to every open
  // client, this one included.
  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  useEffect(() => {
    firstFieldRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        // Only a press that starts on the backdrop itself dismisses — a drag
        // that began inside the sheet and ended out here should not.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="score-editor-title"
      >
        <div className={styles.head}>
          <div>
            <h2 id="score-editor-title" className={styles.title}>
              Update score
            </h2>
            <p className={styles.subtitle}>
              {fixture.sportName} · {fixture.stageLabel} · {formatTime(fixture.scheduledTime)}{" "}
              {fixture.venueShortName} {fixture.courtName}
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </div>

        {!fixture.teamAId || !fixture.teamBId ? (
          <div className={styles.assignSection}>
            <p className={styles.legend}>Assign the winner into this slot</p>
            {!fixture.teamAId ? (
              <AssignTeamPicker fixture={fixture} slot="a" teams={teams} />
            ) : null}
            {!fixture.teamBId ? (
              <AssignTeamPicker fixture={fixture} slot="b" teams={teams} />
            ) : null}
          </div>
        ) : null}

        <form action={formAction}>
          <input type="hidden" name="fixtureId" value={fixture.id} />

          <div className={styles.row}>
            <label className={styles.teamName} htmlFor="scoreA">
              {fixture.teamA}
            </label>
            <input
              ref={firstFieldRef}
              id="scoreA"
              name="scoreA"
              className={styles.input}
              // inputMode numeric with type text: type="number" brings spinners
              // and scroll-to-change, both hazards on a phone held courtside.
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={fixture.scoreA ?? ""}
              autoComplete="off"
            />
          </div>

          <div className={styles.row}>
            <label className={styles.teamName} htmlFor="scoreB">
              {fixture.teamB}
            </label>
            <input
              id="scoreB"
              name="scoreB"
              className={styles.input}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={fixture.scoreB ?? ""}
              autoComplete="off"
            />
          </div>

          <fieldset className={styles.statuses}>
            <legend className={styles.legend}>Status</legend>
            {STATUS_OPTIONS.map((option) => (
              <StatusOption
                key={option.value}
                value={option.value}
                label={option.label}
                defaultChecked={fixture.status === option.value}
              />
            ))}
          </fieldset>

          {state.status === "error" && state.message ? (
            <p className={styles.error} role="alert">
              {state.message}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.save} disabled={pending}>
              {pending ? "Saving…" : "Save score"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * One knockout slot's "pick the real team" control.
 *
 * Its own form, not nested inside the score form below — the two save
 * independently, since a coordinator assigning a semi-final's teams the
 * moment a quarter-final ends has no score to enter yet, and browsers don't
 * allow a <form> inside a <form> in any case.
 */
function AssignTeamPicker({
  fixture,
  slot,
  teams,
}: {
  fixture: Fixture;
  slot: "a" | "b";
  teams: PickerTeam[];
}) {
  const [state, formAction, pending] = useActionState(assignFixtureTeam, ASSIGN_INITIAL);
  const eligible = teams.filter((t) => t.categoryId === fixture.categoryId);
  const placeholder = slot === "a" ? fixture.teamA : fixture.teamB;
  const fieldId = `assign-${slot}-${fixture.id}`;

  return (
    <form action={formAction} className={styles.assignRow}>
      <input type="hidden" name="fixtureId" value={fixture.id} />
      <input type="hidden" name="slot" value={slot} />
      <label className="mg-sr-only" htmlFor={fieldId}>
        Team for &ldquo;{placeholder}&rdquo;
      </label>
      <select id={fieldId} name="teamId" className={styles.assignSelect} defaultValue="">
        <option value="" disabled>
          {placeholder} — choose team
        </option>
        {eligible.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      <button type="submit" className={styles.assignButton} disabled={pending}>
        {pending ? "Saving…" : "Assign"}
      </button>
      {state.status === "error" && state.message ? (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/**
 * A radio styled as a segmented button. Kept as a real radio so the group is
 * keyboard-navigable and submits with the form.
 */
function StatusOption({
  value,
  label,
  defaultChecked,
}: {
  value: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className={styles.statusOption}>
      <input type="radio" name="status" value={value} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}
