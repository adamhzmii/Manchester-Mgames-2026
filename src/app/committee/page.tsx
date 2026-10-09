import type { Metadata } from "next";
import Image from "next/image";

import { InstagramIcon } from "@/components/icons";
import { SportBadge } from "@/components/sport-badge";
import {
  DIRECTORS,
  GROUP_PHOTO,
  OPERATIONS,
  SOCIETY_INSTAGRAM,
  SPORT_HEADS,
  WEBSITE_BY,
} from "@/lib/committee";
import { getSports } from "@/lib/queries";

import styles from "./committee.module.css";

export const metadata: Metadata = {
  title: "Committee",
  description: "The Malaysian Students' Society Manchester committee running MGames 2026.",
};

/** Initials for a name's badge: "Adam Hazmi" → "AH", "Jonny" → "J". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Who runs the day, in the committee's own order: the directors, each
 * sport's heads, then the heads keeping the day going around them.
 */
export default async function CommitteePage() {
  const sports = await getSports();

  return (
    <div className={`mg-wrap ${styles.page}`}>
      <header className={styles.head}>
        <p className={styles.kicker}>Malaysian Students&rsquo; Society Manchester</p>
        <h1 className="mg-page-title">Meet the committee</h1>
        <p className={styles.lede}>The people behind Manchester MGames 2026.</p>
      </header>

      {GROUP_PHOTO ? (
        <div className={styles.photo}>
          <Image
            src={GROUP_PHOTO}
            alt="The MGames 2026 committee"
            fill
            sizes="(max-width: 700px) 100vw, 700px"
            className={styles.photoImg}
            priority
          />
        </div>
      ) : null}

      <section className={styles.section} aria-labelledby="directors">
        <h2 id="directors" className={styles.title}>
          Directors
        </h2>
        <ul className={styles.directors}>
          {DIRECTORS.map((name) => (
            <li key={name} className={styles.director}>
              <span className={styles.avatar} aria-hidden="true">
                {initials(name)}
              </span>
              <span className={styles.directorName}>{name}</span>
              <span className={styles.directorRole}>MGames Director</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="sports">
        <h2 id="sports" className={styles.title}>
          Heads of sport
        </h2>
        <ul className={styles.rows}>
          {sports
            .filter((sport) => SPORT_HEADS[sport.slug])
            .map((sport) => (
              <li key={sport.slug} className={styles.row}>
                <span className={styles.rowRole}>
                  <SportBadge code={sport.code} color={sport.color} slug={sport.slug} size={24} />
                  {sport.name}
                </span>
                <span className={styles.rowNames}>{SPORT_HEADS[sport.slug].join(" · ")}</span>
              </li>
            ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="operations">
        <h2 id="operations" className={styles.title}>
          Running the day
        </h2>
        <ul className={styles.rows}>
          {OPERATIONS.map((team) => (
            <li key={team.role} className={styles.row}>
              <span className={styles.rowRole}>{team.role}</span>
              <span className={styles.rowNames}>{team.names.join(" · ")}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.thanks}>
        <p>
          Thank you to every volunteer, referee and coordinator who made the day happen, and to
          every player who turned up to play.
        </p>
        <div className={styles.socials}>
          {SOCIETY_INSTAGRAM.map((handle) => (
            <a
              key={handle}
              href={`https://instagram.com/${handle}`}
              target="_blank"
              rel="noreferrer"
              className={styles.social}
            >
              <InstagramIcon size={16} />@{handle}
            </a>
          ))}
        </div>
      </section>

      <p className={styles.credit}>Website by {WEBSITE_BY}</p>
    </div>
  );
}
