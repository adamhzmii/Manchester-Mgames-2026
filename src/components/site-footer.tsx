import Image from "next/image";
import Link from "next/link";

import { INFO_PACK_URL, RULEBOOK_URL } from "@/lib/info-content";

import styles from "./site-footer.module.css";

const LINKS = [
  { href: "/schedule", label: "Schedule" },
  { href: "/standings", label: "Standings" },
  { href: "/venues", label: "Venues" },
  { href: "/food", label: "Food & drink" },
  { href: "/updates", label: "Updates" },
  { href: "/info", label: "Info & help" },
  { href: "/committee", label: "Committee" },
] as const;

/**
 * MGames 2026's sponsors, on white tiles so every logo reads the same in
 * light and dark mode. Singapore Global Network is the main sponsor: first,
 * and on a tile of its own.
 */
const SPONSORS = [
  { name: "Singapore Global Network", src: "/sponsors/sgn.png", width: 300, height: 205, main: true },
  { name: "MABECS", src: "/sponsors/mabecs.png", width: 990, height: 360, main: false },
  { name: "UKEC — United Kingdom Education Centre", src: "/sponsors/ukec.png", width: 198, height: 290, main: false },
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
            <p className={styles.when}>
              Sat 24 October 2026 · Trinity, Sugden &amp; Denmark Road Sports Centres
            </p>
          </div>
        </div>

        <nav className={styles.links} aria-label="Footer">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          <a href={RULEBOOK_URL} target="_blank" rel="noreferrer">
            Rulebook
          </a>
          <a href={INFO_PACK_URL} target="_blank" rel="noreferrer">
            Info pack
          </a>
        </nav>

        <section className={styles.sponsors} aria-labelledby="sponsors-title">
          <p id="sponsors-title" className={styles.sponsorsTitle}>
            Supported by
          </p>
          <ul className={styles.sponsorList}>
            {SPONSORS.map((s) => (
              <li key={s.src} className={`${styles.sponsor} ${s.main ? styles.mainSponsor : ""}`}>
                <Image src={s.src} alt={s.name} width={s.width} height={s.height} className={styles.sponsorLogo} />
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.bottom}>
          <Link href="/coordinate" className={styles.staff}>
            Coordinators
          </Link>
        </div>
      </div>
    </footer>
  );
}
