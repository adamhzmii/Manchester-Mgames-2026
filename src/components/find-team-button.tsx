"use client";

import { useState } from "react";

import { StarIcon } from "@/components/icons";
import { TeamPicker } from "@/components/team-picker";
import type { PickerTeam } from "@/lib/queries";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";

/**
 * Opens the find-my-team picker from anywhere. The picker writes to the same
 * favourites store everything else reads, so following a team from the hero
 * updates "Your team" further down the page immediately.
 */
export function FindTeamButton({
  teams,
  className,
  label = "Find your team",
}: {
  teams: PickerTeam[];
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const favourites = useFavouriteTeams();

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <StarIcon size={17} filled={favourites.teamIds.length > 0} />
        {label}
      </button>
      {open ? (
        <TeamPicker
          teams={teams}
          selected={favourites.teamIds}
          onToggle={(id) => favourites.toggle([id])}
          onClear={favourites.clear}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
