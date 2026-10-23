import type { Metadata } from "next";
import Link from "next/link";

import {
  BookIcon,
  BusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExternalIcon,
  InfoIcon,
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
  INFO_PACK_URL,
  RULEBOOK_URL,
  BUSES,
  PRAYER_ROOMS,
  QUOTAS,
  VENUE_CONTACTS,
  STATIONS,
  TRAVEL_APPS,
  WRISTBANDS,
  walkingRouteTo,
} from "@/lib/info-content";
import { getFixtures, getSports, getStandingsData, getVenues } from "@/lib/queries";
import { describeFormat } from "@/lib/tournament-format";

import styles from "./info.module.css";

export const metadata: Metadata = {
  title: "Info & help",
  description:
    "The MGames 2026 rulebook and info pack, first aid, getting there, prayer rooms, questions and how each sport's tournament works.",
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

      {/* The two documents first: the rules, and everything else to know. */}
      <div className={styles.documents}>
        <a href={RULEBOOK_URL} target="_blank" rel="noreferrer" className={styles.handbook}>
          <span className={styles.handbookIcon}>
            <BookIcon size={22} />
          </span>
          <span className={styles.handbookText}>
            <span className={styles.handbookTitle}>Rulebook</span>
            <span className={styles.handbookSub}>General and sport-by-sport rules</span>
          </span>
          <ExternalIcon size={18} />
        </a>
        <a href={INFO_PACK_URL} target="_blank" rel="noreferrer" className={styles.handbook}>
          <span className={styles.handbookIcon}>
            <InfoIcon size={22} />
          </span>
          <span className={styles.handbookText}>
            <span className={styles.handbookTitle}>Info pack</span>
            <span className={styles.handbookSub}>Everything to know for the day</span>
          </span>
          <ExternalIcon size={18} />
        </a>
      </div>

      {/* First aid, kept short: who to call, and that someone will come. */}
      <section className={styles.firstAid} aria-labelledby="first-aid">
        <span className={styles.firstAidIcon}>
          <FirstAidIcon size={20} />
        </span>
        <div className={styles.firstAidText}>
          <h2 id="first-aid" className={styles.firstAidTitle}>
            Need first aid?
          </h2>
          <p className={styles.firstAidBody}>
            There&rsquo;s a first aider at every venue. Call the {FIRST_AID.role} and they&rsquo;ll
            send one to you. If someone&rsquo;s life is in danger, call 999.
          </p>
        </div>
        <a href={`tel:${FIRST_AID.tel}`} className={styles.firstAidCall}>
          <PhoneIcon size={16} />
          Call
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
      </section>

      <section className={styles.section} aria-labelledby="venue-contacts">
        <h2 id="venue-contacts" className={styles.title}>
          Who to contact at each venue
        </h2>
        <div className={styles.travel}>
          {VENUE_CONTACTS.map(({ venue, people }) => (
            <div key={venue} className={styles.travelCard}>
              <p className={styles.travelHead}>{venue}</p>
              <ul className={styles.contacts}>
                {people.map((p) => (
                  <li key={p.tel}>
                    <a
                      href={p.whatsapp ? `https://wa.me/${p.tel.replace(/\D/g, "")}` : `tel:${p.tel}`}
                      target={p.whatsapp ? "_blank" : undefined}
                      rel="noreferrer"
                      className={`${styles.contact} ${styles.venueContact}`}
                    >
                      <span>
                        <span className={styles.contactLabel}>{p.name}</span>
                        <span className={styles.contactNote}>
                          {p.role ? `${p.role} · ` : ""}
                          {p.display}
                        </span>
                      </span>
                      <span className={styles.contactCall}>
                        <PhoneIcon size={15} />
                        {p.whatsapp ? "WhatsApp" : "Call"}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="getting-there">
        <h2 id="getting-there" className={styles.title}>
          Getting there
        </h2>
        <div className={styles.travel}>
          {STATIONS.map((station) => (
            <div key={station.name} className={styles.travelCard}>
              <p className={styles.travelHead}>
                <TrainIcon size={18} />
                {station.name}
              </p>
              <table className={styles.quotaTable}>
                <thead>
                  <tr>
                    <th scope="col">To</th>
                    <th scope="col">Walk</th>
                    <th scope="col">Bus</th>
                  </tr>
                </thead>
                <tbody>
                  {station.times.map((t) => (
                    <tr key={t.venue}>
                      <th scope="row">{t.venue}</th>
                      <td>{t.walk} min</td>
                      <td>{t.bus} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <div className={styles.travelCard}>
            <p className={styles.travelHead}>
              <BusIcon size={18} />
              {BUSES.network} buses
            </p>
            <p className={styles.routes}>
              {BUSES.routes.map((route) => (
                <span key={route} className={styles.route}>
                  {route}
                </span>
              ))}
            </p>
            <ul className={styles.wristbands}>
              {BUSES.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className={styles.travelCard}>
            <p className={styles.travelHead}>Useful apps</p>
            <p className={styles.routes}>
              {TRAVEL_APPS.map((app) => (
                <span key={app} className={styles.app}>
                  {app}
                </span>
              ))}
            </p>
          </div>
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

      <section className={styles.section} aria-labelledby="quotas">
        <h2 id="quotas" className={styles.title}>
          Malaysian players &amp; wristbands
        </h2>
        <div className={styles.quotas}>
          <table className={styles.quotaTable}>
            <thead>
              <tr>
                <th scope="col">Sport</th>
                <th scope="col">On court</th>
                <th scope="col">Malaysians, at least</th>
              </tr>
            </thead>
            <tbody>
              {QUOTAS.map((q) => (
                <tr key={q.sport}>
                  <th scope="row">
                    {q.sport}
                    {q.also ? <span className={styles.quotaAlso}>{q.also}</span> : null}
                  </th>
                  <td>{q.onCourt}</td>
                  <td>{q.malaysians}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className={styles.wristbands}>
            {WRISTBANDS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className={styles.quotaNote}>
            The short version. The{" "}
            <a href={RULEBOOK_URL} target="_blank" rel="noreferrer">
              rulebook
            </a>{" "}
            has the full rules and exceptions, and the Head of Sports has the final say.
          </p>
        </div>
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
