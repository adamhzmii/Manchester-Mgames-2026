import type { Metadata } from "next";
import Link from "next/link";

import {
  AlertIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FirstAidIcon,
  PhoneIcon,
  PrayerIcon,
  TrainIcon,
} from "@/components/icons";
import { SportBadge } from "@/components/sport-badge";
import { EVENT_CONTACTS, FAQ, GETTING_THERE, VENUE_FACILITIES } from "@/lib/info-content";
import { getFixtures, getSports, getStandingsData, getVenues } from "@/lib/queries";
import { describeFormat } from "@/lib/tournament-format";

import styles from "./info.module.css";

export const metadata: Metadata = {
  title: "Info & help",
  description:
    "Emergency contacts, how each sport's tournament works, first aid, prayer rooms, travel and FAQs for MGames 2026.",
};

/** Reads the fixture list for the format section. */
export const dynamic = "force-dynamic";

export default async function InfoPage() {
  const [fixtures, sports, standings, venues] = await Promise.all([
    getFixtures(),
    getSports(),
    getStandingsData(),
    getVenues(),
  ]);
  const contacts = EVENT_CONTACTS.filter((c) => c.tel !== null);

  return (
    <div className={`mg-wrap ${styles.page}`}>
      <h1 className="mg-page-title">Info &amp; help</h1>

      {/* Emergency first, and in red: the one section on this page someone
          may need without having time to read the rest. */}
      <section className={styles.emergency} aria-labelledby="emergency">
        <h2 id="emergency" className={styles.emergencyTitle}>
          <AlertIcon size={18} />
          In an emergency
        </h2>
        <a href="tel:999" className={styles.call999}>
          <PhoneIcon size={20} />
          Call 999
        </a>
        {contacts.length > 0 ? (
          <ul className={styles.contacts}>
            {contacts.map((contact) => (
              <li key={contact.label}>
                <a href={`tel:${contact.tel}`} className={styles.contact}>
                  <span>
                    <span className={styles.contactLabel}>{contact.label}</span>
                    <span className={styles.contactNote}>{contact.note}</span>
                  </span>
                  <span className={styles.contactCall}>
                    <PhoneIcon size={15} />
                    Call
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <p className={styles.emergencyNote}>
          For anything else, find a steward in gold hi-vis — there is one at every reception.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="format">
        <h2 id="format" className={styles.title}>
          How each sport works
        </h2>
        <div className={styles.formats}>
          {sports.map((sport) => {
            const format = describeFormat(sport.slug, fixtures, standings.groups, standings.teams);
            return (
              <details key={sport.id} className={styles.format}>
                <summary className={styles.formatSummary}>
                  <SportBadge code={sport.code} color={sport.color} slug={sport.slug} size={28} />
                  <span className={styles.formatName}>{sport.name}</span>
                  <span className={styles.formatTeams}>{format.teams} teams</span>
                  <ChevronDownIcon size={18} className={styles.chevron} />
                </summary>
                <div className={styles.formatBody}>
                  <ul className={styles.formatLines}>
                    {format.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  {format.rounds.length > 0 ? (
                    <p className={styles.rounds}>
                      {format.rounds.map((round, i) => (
                        <span key={round}>
                          {i > 0 ? <ChevronRightIcon size={13} className={styles.arrow} /> : null}
                          {round}
                        </span>
                      ))}
                    </p>
                  ) : null}
                  <Link href={`/standings?sport=${sport.slug}`} className={styles.formatLink}>
                    {sport.name} standings
                  </Link>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="facilities">
        <h2 id="facilities" className={styles.title}>
          At the venues
        </h2>
        <div className={styles.venues}>
          {venues.map((venue) => {
            const f = VENUE_FACILITIES[venue.slug];
            if (!f) return null;
            return (
              <Link key={venue.id} href={`/venues?v=${venue.slug}`} className={styles.venue}>
                <span className={styles.venueName}>{venue.shortName}</span>
                <span className={styles.venueLine}>
                  <FirstAidIcon size={15} />
                  First aid · {f.firstAid}
                </span>
                <span className={styles.venueLine}>
                  <PrayerIcon size={15} />
                  Prayer room · {f.prayer}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="getting-there">
        <h2 id="getting-there" className={styles.title}>
          Getting there
        </h2>
        <ul className={styles.list}>
          {GETTING_THERE.map((line) => (
            <li key={line} className={styles.listItem}>
              <TrainIcon size={18} />
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="faq">
        <h2 id="faq" className={styles.title}>
          Questions
        </h2>
        <div className={styles.faqs}>
          {FAQ.map((item) => (
            <details key={item.question} className={styles.faq}>
              <summary className={styles.faqQ}>
                {item.question}
                <ChevronDownIcon size={18} className={styles.chevron} />
              </summary>
              <p className={styles.faqA}>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <p className={styles.staff}>
        On the committee? <Link href="/login">Coordinator sign-in</Link>
      </p>
    </div>
  );
}
