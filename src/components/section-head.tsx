import Link from "next/link";

import { ChevronRightIcon } from "@/components/icons";

import styles from "./section-head.module.css";

/**
 * The heading over a block of content: an uppercase broadcast-style label, an
 * optional count, and an optional "see all" link on the right.
 */
export function SectionHead({
  title,
  count,
  href,
  action = "See all",
  id,
  tone,
}: {
  title: React.ReactNode;
  count?: number;
  href?: string;
  action?: string;
  id?: string;
  /** "night" when the heading sits on a night band. */
  tone?: "night";
}) {
  return (
    <div className={styles.head} data-tone={tone} id={id}>
      <h2 className={styles.title}>
        {title}
        {count !== undefined ? <span className={styles.count}>{count}</span> : null}
      </h2>
      {href ? (
        <Link href={href} className={styles.action}>
          {action}
          <ChevronRightIcon size={14} />
        </Link>
      ) : null}
    </div>
  );
}
