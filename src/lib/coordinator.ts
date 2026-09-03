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
  /** Null means a committee admin, allowed to edit every sport. */
  sportId: string | null;
};

/**
 * Whether this coordinator may edit fixtures belonging to `sportId`.
 *
 * Presentation only. The boundary that actually holds is the RLS policy on
 * `fixtures`; this just avoids offering an action that Postgres would refuse.
 */
export function coordinatorCanEdit(
  coordinator: Coordinator | null,
  sportId: string,
): boolean {
  if (!coordinator) return false;
  return coordinator.sportId === null || coordinator.sportId === sportId;
}
