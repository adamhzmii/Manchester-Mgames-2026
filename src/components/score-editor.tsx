"use client";

import { useActionState, useEffect, useRef } from "react";

import { CloseIcon } from "@/components/icons";
import { updateFixtureScore, type UpdateFixtureState } from "@/lib/actions/fixtures";
import type { Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";

import styles from "./score-editor.module.css";

const INITIAL: UpdateFixtureState = { status: "idle", message: null };

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
  onClose,
}: {
  fixture: Fixture;
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
