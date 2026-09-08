"use client";

import { useMemo, useState } from "react";

import { BusIcon, MapIcon, PinIcon } from "@/components/icons";
import { GoogleVenueMap } from "@/components/google-venue-map";
import { SPORT_ICONS } from "@/components/sport-icons";
import type { Court, Vendor, Venue } from "@/lib/queries";
import { googleMapsApiKey } from "@/lib/maps-env";

import styles from "./map-view.module.css";

/** Gold, matching the food pins on the prototype's map. */
const FOOD_COLOR = "#D4A93C";

type MapViewProps = {
  venues: Venue[];
  courts: Court[];
  vendors: Vendor[];
  /** Venue slug from ?venue= — the Food page links straight to a venue. */
  initialVenue?: string;
};

/**
 * Venue map.
 *
 * The interactive embed needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, which isn't
 * guaranteed to be set (local dev, a fresh clone before setup). Without it
 * this falls back to the venue list plus a `geo:` directions link — no crash,
 * no broken embed, just a plainer page until the key exists.
 */
/** Mirrors SportBadge: a glyph where there is one, the code otherwise. */
function ZoneBadge({
  badge,
  slug,
  color,
}: {
  badge: string;
  slug: string | null;
  color: string;
}) {
  const Icon = slug ? SPORT_ICONS[slug] : undefined;
  return (
    <span className={styles.zoneBadge} style={{ background: color }}>
      {Icon ? <Icon size={17} /> : badge}
    </span>
  );
}

export function MapView({ venues, courts, vendors, initialVenue }: MapViewProps) {
  const apiKey = googleMapsApiKey();
  const [venueSlug, setVenueSlug] = useState(
    initialVenue && venues.some((v) => v.slug === initialVenue)
      ? initialVenue
      : (venues[0]?.slug ?? ""),
  );

  const venue = venues.find((v) => v.slug === venueSlug);

  const zones = useMemo(() => {
    const here = courts
      .filter((c) => c.venueSlug === venueSlug)
      .map((court) => ({
        key: `court-${court.id}`,
        badge: court.sportCode ?? "··",
        slug: court.sportSlug,
        color: court.sportColor ?? "#3C2A6E",
        name: court.sportName ?? court.name,
        where: court.sportName ? court.name : "Shared space",
      }));

    const food = vendors
      .filter((v) => v.venueSlug === venueSlug)
      .map((vendor) => ({
        key: `vendor-${vendor.id}`,
        badge: "F",
        slug: null as string | null,
        color: FOOD_COLOR,
        name: vendor.name,
        where: vendor.location ?? "Food stall",
      }));

    return [...here, ...food];
  }, [courts, vendors, venueSlug]);

  // A Google Maps URL rather than a `geo:` URI: `geo:` opens the native app on
  // a phone but does nothing at all in a desktop browser, and a coordinator or
  // spectator checking the venue from a laptop is a normal case.
  const directionsHref =
    venue?.latitude != null && venue?.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}&travelmode=walking`
      : null;

  return (
    <div className="mg-page mg-container-wide" style={{ padding: 0 }}>
      <div className={styles.head}>
        <h1 className="mg-page-title">Venue Map</h1>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Choose a venue">
        {venues.map((v) => (
          <button
            key={v.slug}
            type="button"
            role="tab"
            aria-selected={v.slug === venueSlug}
            className={`${styles.tab} ${v.slug === venueSlug ? styles.tabOn : ""}`}
            onClick={() => setVenueSlug(v.slug)}
          >
            {v.name}
          </button>
        ))}
      </div>

      <div className={styles.placeholder}>
        {apiKey ? (
          <div className={styles.mapCanvas}>
            <GoogleVenueMap
              apiKey={apiKey}
              venues={venues}
              vendors={vendors}
              selectedSlug={venueSlug}
            />
          </div>
        ) : (
          <div className={styles.canvas}>
            <MapIcon size={28} />
            <p className={styles.canvasTitle}>Map unavailable</p>
            <p className={styles.canvasHint}>
              Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Use the venue list below and your own maps
              app in the meantime.
            </p>
          </div>
        )}
        <div className={styles.placeholderFoot}>
          {directionsHref ? (
            <a
              className={styles.directions}
              href={directionsHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <PinIcon size={14} />
              Directions to {venue?.shortName}
            </a>
          ) : null}
          {venue?.address ? <p className={styles.address}>{venue.address}</p> : null}
        </div>
      </div>

      <h2 className="mg-section-title" style={{ margin: "16px var(--mg-gutter) 8px" }}>
        At {venue?.name ?? "this venue"}
      </h2>

      <div className={styles.zones}>
        {zones.map((zone) => (
          <div key={zone.key} className={styles.zone}>
            <ZoneBadge badge={zone.badge} slug={zone.slug} color={zone.color} />
            <div>
              <p className={styles.zoneName}>{zone.name}</p>
              <p className={styles.zoneWhere}>{zone.where}</p>
            </div>
          </div>
        ))}
      </div>

      <section className={styles.travel}>
        <h2 className={styles.travelHead}>
          <BusIcon size={18} />
          Getting between venues
        </h2>
        <div className={styles.travelGrid}>
          <div className={styles.travelCard}>
            <p className={styles.travelBig}>12 min</p>
            <p className={styles.travelSmall}>Walk · 0.6 mi</p>
          </div>
          <div className={styles.travelCard}>
            <p className={styles.travelBig}>6 min</p>
            <p className={styles.travelSmall}>Bus 142 · every 10 min</p>
          </div>
        </div>
        <p className={styles.travelNote}>
          Your wristband gives entry to both venues all day. Shuttle stewards in gold hi-vis at
          each reception.
        </p>
      </section>
    </div>
  );
}
