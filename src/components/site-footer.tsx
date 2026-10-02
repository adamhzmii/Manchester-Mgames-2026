import Image from "next/image";
import Link from "next/link";

import styles from "./site-footer.module.css";

const LINKS = [
  { href: "/schedule", label: "Schedule" },
  { href: "/standings", label: "Standings" },
  { href: "/venues", label: "Venues" },
  { href: "/food", label: "Food & drink" },
  { href: "/updates", label: "Updates" },
  { href: "/info", label: "Info & help" },
] as const;

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`mg-wrap ${styles.inner}`}>
        <div className={styles.identity}>
          <Image src="/brand/logo-mark.png" alt="" width={908} height={889} className={styles.crest} />
          <div>
            <p className={styles.name}>Manchester MGames 2026</p>
            <p className={styles.host}>
              Hosted by the Malaysian Students&rsquo; Society of Manchester
            </p>
            <p className={styles.when}>Sat 24 October 2026 · Trinity &amp; Sugden Sports Centres</p>
          </div>
        </div>

        <nav className={styles.links} aria-label="Footer">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.bottom}>
          <Link href="/login" className={styles.staff}>
            Coordinator sign-in
          </Link>
        </div>
      </div>
    </footer>
  );
}
