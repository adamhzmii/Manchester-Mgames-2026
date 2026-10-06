/**
 * Coordinator identity, shared between server and client.
 *
 * Deliberately its own module rather than living in `queries.ts`: that file is
 * `server-only`, and the schedule view is a Client Component. Importing a
 * *value* from there — even one as small as the predicate below — pulls the
 * Supabase server client into the browser bundle and fails the build. Types
 * alone would be erased and fine; a function is not.
 */
export type Coordinator = {
  name: string;
  /**
   * The sport the account was set up for, or null for a committee admin.
   * No longer a limit: every coordinator can edit every game.
   */
  sportId: string | null;
};

/**
 * Whether this visitor may edit a game: any signed-in coordinator, for any
 * sport. On the day coordinators cover for each other — a scorer at the next
 * court, moving a game, marking one late — so nobody is fenced into one sport.
 *
 * Presentation only. The boundary that actually holds is the RLS policy on
 * `fixtures`; this just avoids offering an action that Postgres would refuse.
 */
export function coordinatorCanEdit(coordinator: Coordinator | null): boolean {
  return coordinator !== null;
}
