import type { Metadata } from "next";

import { AlertIcon, BusIcon, ChevronDownIcon, InfoIcon, PhoneIcon } from "@/components/icons";
import { EMERGENCY_CONTACTS, FACILITIES, FAQ } from "@/lib/info-content";

import styles from "./info.module.css";

export const metadata: Metadata = {
  title: "Info & Help",
  description:
    "First aid, prayer rooms, emergency contacts, travel and FAQs for MGames 2026 at Trinity and Sugden.",
};

const ICON_CLASS = {
  red: styles.iconRed,
  purple: styles.iconPurple,
  gold: styles.iconGold,
} as const;

export default function InfoPage() {
  return (
    <div className="mg-page mg-container-wide" style={{ padding: 0 }}>
      <div style={{ padding: "16px var(--mg-gutter) 10px" }}>
        <h1 className="mg-page-title">Info &amp; Help</h1>
      </div>

      <section className={styles.emergency} aria-labelledby="emergency-heading">
        <h2 id="emergency-heading" className={styles.emergencyHead}>
          <AlertIcon size={16} />
          Emergency contacts
        </h2>
        <div className={styles.contacts}>
          {EMERGENCY_CONTACTS.map((contact) => (
            <a
              key={contact.tel}
              href={`tel:${contact.tel}`}
              className={`${styles.contact} ${"urgent" in contact && contact.urgent ? styles.contactUrgent : ""}`}
            >
              <span>{contact.label}</span>
              <span className={styles.contactAction}>
                {"urgent" in contact && contact.urgent ? null : <PhoneIcon size={14} />}
                {contact.display}
              </span>
            </a>
          ))}
        </div>
      </section>

      <div className={styles.cards}>
        {FACILITIES.map((facility) => (
          <section key={facility.title} className={styles.card}>
            <span className={`${styles.cardIcon} ${ICON_CLASS[facility.tone]}`}>
              {facility.title === "Getting There" ? <BusIcon size={19} /> : <InfoIcon size={19} />}
            </span>
            <h2 className={styles.cardTitle}>{facility.title}</h2>
            <p className={styles.cardLines}>
              {facility.lines.map((line, index) => (
                <span key={line}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </p>
          </section>
        ))}
      </div>

      <h2 className="mg-section-title" style={{ margin: "20px var(--mg-gutter) 10px" }}>
        FAQ
      </h2>

      <div className={styles.faq}>
        {FAQ.map((entry) => (
          <details key={entry.question} className={styles.item}>
            <summary className={styles.summary}>
              {entry.question}
              <ChevronDownIcon size={18} className={styles.chevron} />
            </summary>
            <p className={styles.answer}>{entry.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
