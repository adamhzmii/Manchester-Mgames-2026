"use client";

import Link from "next/link";
import { useEffect } from "react";

import { AlertIcon } from "@/components/icons";

import styles from "./error.module.css";

/**
 * Route-level error boundary.
 *
 * The realistic failure on the day is Supabase being unreachable from a packed
 * sports hall's wifi, so the copy points at a retry rather than suggesting
 * something is broken. `reset()` re-renders the segment, which re-runs the
 * server query.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.wrap}>
      <AlertIcon size={32} className={styles.icon} />
      <h1 className={styles.title}>That didn&rsquo;t load</h1>
      <p className={styles.body}>
        We couldn&rsquo;t reach the scores service. If you&rsquo;re on venue wifi, this is
        usually momentary — try again.
        {error.digest ? <span className={styles.detail}>Reference: {error.digest}</span> : null}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={reset}>
          Try again
        </button>
        <Link href="/" className={`${styles.button} ${styles.secondary}`}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
