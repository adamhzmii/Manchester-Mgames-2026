"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { GoogleVenueMap } from "@/components/google-venue-map";
import {
  BusIcon,
  ChevronRightIcon,
  ExternalIcon,
  FirstAidIcon,
  PinIcon,
  PrayerIcon,
  ToiletIcon,
  WalkIcon,
} from "@/components/icons";
import { MatchList, MatchRow } from "@/components/match-row";
import { SportBadge } from "@/components/sport-badge";
import { byKickoff, type Fixture } from "@/lib/fixtures";
import { formatPrice, formatTime } from "@/lib/format";
import { TRAVEL, VENUE_FACILITIES } from "@/lib/info-content";
import { useLiveFixtures } from "@/lib/live-feed";
import type { Vendor, Venue } from "@/lib/queries";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";

import styles from "./venues-view.module.css";

type VenuesViewProps = {
  venues: Venue[];
  vendors: Vendor[];
  fixtures: Fixture[];
  mapsKey: string | null;
  initialVenue: string;
};

/**
 * Everything about one building: where it is, what is on in it now, which
 * court hosts what, where to eat, and where first aid and the prayer room
 * are. Organised by place because that is how the question arrives — someone
 * standing in Trinity wants Trinity's answers.
 */
export function VenuesView({ venues, vendors, fixtures: initial, mapsKey, initialVenue }: VenuesViewProps) {
  const fixtures = useLiveFixtures(initial);
  const favourites = useFavouriteTeams();
  const router = useRouter();
  const pathname = usePathname();
  const [slug, setSlug] = useState(initialVenue);

  const venue = venues.find((v) => v.slug === slug) ?? venues[0];
  if (!venue) return null;

  const choose = (next: string) => {
    setSlug(next);
    router.replace(`${pathname}?v=${next}`, { scroll: false });
  };

  const here = fixtures.filter((f) => f.venueSlug === venue.slug);
  const live = here.filter((f) => f.status === "live");
  const courts = courtsAt(here);
  const food = vendors.filter((v) => v.venueSlug === venue.slug);
  const facilities = VENUE_FACILITIES[venue.slug];
  const other = venues.find((v) => v.slug !== venue.slug);
  const directions =
    venue.latitude !== null && venue.longitude !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`
      : null;

  return (
    <div className={styles.page}>
      <div className="mg-wrap">
        <h1 className="mg-page-title">Venues</h1>

        <div className={styles.switch} role="tablist" aria-label="Venue">
          {venues.map((v) => (
            <button
              key={v.slug}
              type="button"
              role="tab"
              aria-selected={v.slug === venue.slug}
              className={`${styles.switchItem} ${v.slug === venue.slug ? styles.switchOn : ""}`}
              onClick={() => choose(v.slug)}
            >
              {v.shortName}
              {fixtures.some((f) => f.venueSlug === v.slug && f.status === "live") ? (
                <span className={styles.switchLive} aria-label="games live">
                  ●
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className={`mg-wrap ${styles.body}`}>
        <section className={styles.card}>
          <h2 className={styles.venueName}>{venue.name}</h2>
          {venue.address ? (
            <p className={styles.address}>
              <PinIcon size={15} />
              {venue.address}
            </p>
          ) : null}
          {directions ? (
            <a href={directions} target="_blank" rel="noreferrer" className={`mg-btn mg-btn-plum ${styles.directions}`}>
              Directions
              <ExternalIcon size={16} />
            </a>
          ) : null}
        </section>

        {mapsKey ? (
          <div className={styles.map}>
            <GoogleVenueMap apiKey={mapsKey} venues={venues} vendors={vendors} selectedSlug={venue.slug} />
          </div>
        ) : null}

        {live.length > 0 ? (
          <section className={styles.section}>
            <h2 className={styles.title}>
              <span className={styles.liveDot} aria-hidden="true" />
              On now at {venue.shortName}
            </h2>
            <MatchList>
              {live.map((f) => (
                <MatchRow key={f.id} fixture={f} followed={favourites.teamIds} />
              ))}
            </MatchList>
          </section>
        ) : null}

        <section className={styles.section}>
          <h2 className={styles.title}>Courts</h2>
          <ul className={styles.courts}>
            {courts.map((court) => (
              <li key={court.name} className={styles.court}>
                <div className={styles.courtHead}>
                  <span className={styles.courtName}>{court.name}</span>
                  <span className={styles.courtSports}>
                    {court.sports.map((f) => (
                      <span key={f.sportSlug} className={styles.courtSport}>
                        <SportBadge code={f.sportCode} color={f.sportColor} slug={f.sportSlug} size={20} />
                        {f.sportName}
                      </span>
                    ))}
                  </span>
                </div>
                {court.current ? (
                  <Link href={`/match/${court.current.id}`} className={styles.courtNow}>
                    <span className={court.current.status === "live" ? styles.courtLive : styles.courtNext}>
                      {court.current.status === "live" ? "Live" : formatTime(court.current.scheduledTime)}
                    </span>
                    <span className={styles.courtMatch}>
                      {court.current.teamA} v {court.current.teamB}
                    </span>
                    <ChevronRightIcon size={16} />
                  </Link>
                ) : (
                  <p className={styles.courtDone}>No more games here today</p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {food.length > 0 ? (
          <section className={styles.section}>
            <div className={styles.titleRow}>
              <h2 className={styles.title}>Food &amp; drink</h2>
              <Link href={`/food?venue=${venue.slug}`} className={styles.more}>
                Full menus <ChevronRightIcon size={14} />
              </Link>
            </div>
            <ul className={styles.vendors}>
              {food.map((v) => {
                const cheapest = v.menu.reduce<number | null>(
                  (min, item) => (min === null || item.pricePence < min ? item.pricePence : min),
                  null,
                );
                return (
                  <li key={v.id}>
                    <Link href={`/food?venue=${venue.slug}#${v.id}`} className={styles.vendor}>
                      <span className={styles.vendorText}>
                        <span className={styles.vendorName}>{v.name}</span>
                        <span className={styles.vendorMeta}>
                          {v.cuisine}
                          {v.location ? ` · ${v.location}` : ""}
                        </span>
                      </span>
                      {cheapest !== null ? (
                        <span className={styles.vendorPrice}>from {formatPrice(cheapest)}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {facilities ? (
          <section className={styles.section}>
            <h2 className={styles.title}>Facilities</h2>
            <ul className={styles.facilities}>
              <Facility icon={<FirstAidIcon size={20} />} label="First aid" value={facilities.firstAid} tone="red" />
              <Facility icon={<PrayerIcon size={20} />} label="Prayer room" value={facilities.prayer} />
              <Facility icon={<ToiletIcon size={20} />} label="Toilets" value={facilities.toilets} />
            </ul>
          </section>
        ) : null}

        {other ? (
          <section className={styles.section}>
            <h2 className={styles.title}>Getting to {other.shortName}</h2>
            <div className={styles.travel}>
              <div className={styles.travelItem}>
                <WalkIcon size={22} />
                <span className={styles.travelBig}>{TRAVEL.walk.minutes} min</span>
                <span className={styles.travelSmall}>Walk · {TRAVEL.walk.distance}</span>
              </div>
              <div className={styles.travelItem}>
                <BusIcon size={22} />
                <span className={styles.travelBig}>{TRAVEL.bus.minutes} min</span>
                <span className={styles.travelSmall}>
                  Bus {TRAVEL.bus.route} · {TRAVEL.bus.every}
                </span>
              </div>
            </div>
            <p className={styles.note}>{TRAVEL.note}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Facility({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "red";
}) {
  return (
    <li className={styles.facility} data-tone={tone}>
      <span className={styles.facilityIcon}>{icon}</span>
      <span>
        <span className={styles.facilityLabel}>{label}</span>
        <span className={styles.facilityValue}>{value}</span>
      </span>
    </li>
  );
}

/**
 * The courts in a building, from the games scheduled on them rather than the
 * court's single sport column: Trinity's Main Hall hosts both volleyball and
 * frisbee, and listing it as "Shared space" told a player looking for
 * volleyball nothing.
 */
function courtsAt(fixtures: Fixture[]) {
  const byCourt = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    const list = byCourt.get(f.courtName) ?? [];
    list.push(f);
    byCourt.set(f.courtName, list);
  }
  return [...byCourt.entries()]
    .map(([name, games]) => {
      const sorted = [...games].sort(byKickoff);
      const sports = [...new Map(sorted.map((f) => [f.sportSlug, f])).values()].sort(
        (a, b) => a.sportOrder - b.sportOrder,
      );
      const current =
        sorted.find((f) => f.status === "live") ?? sorted.find((f) => f.status === "upcoming") ?? null;
      return { name, sports, current };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
