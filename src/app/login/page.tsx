import type { Metadata } from "next";

import { signOut } from "@/lib/actions/auth";
import { getIsCoordinator } from "@/lib/queries";

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
  const signedIn = await getIsCoordinator();

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {signedIn ? (
          <div className={styles.signedIn}>
            <h1 className={styles.signedInTitle}>You&rsquo;re signed in</h1>
            <p className={styles.intro}>
              Edit buttons now appear on every fixture on the Schedule. Tap one to push a score
              or change a game&rsquo;s status.
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
              For committee members updating scores on the day. Attendees don&rsquo;t need an
              account — everything else on the site is open.
            </p>
            <LoginForm />
          </>
        )}
      </div>

      <p className={styles.note}>
        One shared login for the whole committee. Don&rsquo;t post the password anywhere public.
      </p>
    </div>
  );
}
