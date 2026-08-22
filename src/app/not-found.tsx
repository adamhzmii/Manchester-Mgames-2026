import Link from "next/link";

import styles from "./error.module.css";

export default function NotFound() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.body}>
        That link doesn&rsquo;t go anywhere. Everything for the day is reachable from the home
        page.
      </p>
      <div className={styles.actions}>
        <Link href="/" className={styles.button}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
