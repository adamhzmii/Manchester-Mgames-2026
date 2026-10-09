import type { Metadata } from "next";
import Link from "next/link";

import {
  AlertIcon,
  BookIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExternalIcon,
  FirstAidIcon,
  PhoneIcon,
  PrayerIcon,
  TrainIcon,
} from "@/components/icons";
import { SportBadge } from "@/components/sport-badge";
import {
  EVENT_CONTACTS,
  FAQ,
  FIRST_AID,
  GETTING_THERE,
  HANDBOOK_URL,
  PRAYER_ROOMS,
  VENUE_FACILITIES,
  walkingRouteTo,
} from "@/lib/info-content";
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
          Injured or unwell?
        </h2>
        <a href={`tel:${FIRST_AID.tel}`} className={styles.callFirstAid}>
          <PhoneIcon size={20} />
          Call {FIRST_AID.name}
        </a>
        <p className={styles.firstAidWho}>
          <FirstAidIcon size={16} />
          <span>
            <strong>
              {FIRST_AID.name}, {FIRST_AID.role}
            </strong>{" "}
            · {FIRST_AID.display}
            <br />
            {FIRST_AID.note}
          </span>
        </p>
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
          Or find a steward in gold hi-vis — there is one at every reception. If someone&rsquo;s
          life is in danger, dial 999.
        </p>
      </section>

      <a href={HANDBOOK_URL} target="_blank" rel="noreferrer" className={styles.handbook}>
        <span className={styles.handbookIcon}>
          <BookIcon size={22} />
        </span>
        <span className={styles.handbookText}>
          <span className={styles.handbookTitle}>MGames handbook</span>
          <span className={styles.handbookSub}>The info pack and every sport&rsquo;s rules, in one PDF</span>
        </span>
        <ExternalIcon size={18} />
      </a>

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
              </Link>
            );
          })}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="prayer">
        <h2 id="prayer" className={styles.title}>
          Prayer rooms
        </h2>
        <ul className={styles.prayerRooms}>
          {PRAYER_ROOMS.map((room) => (
            <li key={room.name} className={styles.prayerRoom}>
              <span className={styles.prayerHead}>
                <PrayerIcon size={18} />
                <span className={styles.prayerName}>{room.name}</span>
              </span>
              <span className={styles.prayerWhere}>{room.where}</span>
              <span className={styles.prayerWalks}>
                {venues
                  .filter((v) => room.walk[v.slug] !== undefined)
                  .map((v) => `${room.walk[v.slug]} min from ${v.shortName}`)
                  .join(" · ")}
              </span>
              <span className={styles.prayerNotes}>{room.notes.join(" · ")}</span>
              <a
                href={walkingRouteTo(room.address)}
                target="_blank"
                rel="noreferrer"
                className={styles.prayerRoute}
              >
                Walking route <ExternalIcon size={14} />
              </a>
            </li>
          ))}
        </ul>
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

      <Link href="/committee" className={styles.handbook}>
        <span className={styles.handbookIcon}>
          <ChevronRightIcon size={22} />
        </span>
        <span className={styles.handbookText}>
          <span className={styles.handbookTitle}>Meet the committee</span>
          <span className={styles.handbookSub}>The MSSM team behind MGames 2026</span>
        </span>
      </Link>

      <p className={styles.staff}>
        On the committee? <Link href="/coordinate">Coordinator sign-in</Link>
      </p>
    </div>
  );
}
