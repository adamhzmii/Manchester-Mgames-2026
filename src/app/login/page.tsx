import type { Metadata } from "next";

import { signOut } from "@/lib/actions/auth";
import { getCoordinator, getSports } from "@/lib/queries";

import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Coordinator sign-in",
  description: "Sign in to update MGames 2026 scores and fixture status.",
  // Nothing here is useful in a search result, and the fewer people who find
  // the login by accident the better.
  robots: { index: false, follow: false },
};

/**
 * Live data — never prerendered or cached. Scores and announcements change
 * during the event, and a stale page is worse than a slower one.
 */
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [coordinator, sports] = await Promise.all([getCoordinator(), getSports()]);
  const sportName = coordinator?.sportId
    ? (sports.find((s) => s.id === coordinator.sportId)?.name ?? "your sport")
    : null;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {coordinator ? (
          <div className={styles.signedIn}>
            <h1 className={styles.signedInTitle}>Signed in as {coordinator.name}</h1>
            <p className={styles.intro}>
              {sportName
                ? `You can edit ${sportName} fixtures. Edit buttons appear on those games on the Schedule — tap one to push a score or change a game's status.`
                : "You're a committee admin, so you can edit every sport. Edit buttons appear on every fixture on the Schedule."}
            </p>
            <form action={signOut}>
              <button type="submit" className={styles.signOut}>
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <>
            <h1 className={styles.title}>Coordinator sign-in</h1>
            <p className={styles.intro}>
              For coordinators updating their sport&rsquo;s scores on the day. Attendees
              don&rsquo;t need an account — everything else on the site is open.
            </p>
            <LoginForm />
          </>
        )}
      </div>

      <p className={styles.note}>
        One account per sport. Don&rsquo;t post the password anywhere public.
      </p>
    </div>
  );
}
