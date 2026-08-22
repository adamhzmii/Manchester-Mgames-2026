"use client";

import { useMemo, useState } from "react";

import { BusIcon, MapIcon, PinIcon } from "@/components/icons";
import type { Court, Vendor, Venue } from "@/lib/queries";

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
 * The interactive map itself is not built yet: the provider (Google Maps vs
 * Mapbox vs Leaflet/OSM) is still an open decision in the spec, and each one
 * needs different keys, billing and a different component. Rather than guess,
 * this ships the parts that do not depend on that choice — the per-venue list
 * of what is where, and a directions link that hands the venue's coordinates
 * to whatever map app the visitor already has. Swapping the placeholder for a
 * real embed later touches only this file.
 */
export function MapView({ venues, courts, vendors, initialVenue }: MapViewProps) {
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
        color: court.sportColor ?? "#3C2A6E",
        name: court.sportName ?? court.name,
        where: court.sportName ? court.name : "Shared space",
      }));

    const food = vendors
      .filter((v) => v.venueSlug === venueSlug)
      .map((vendor) => ({
        key: `vendor-${vendor.id}`,
        badge: "F",
        color: FOOD_COLOR,
        name: vendor.name,
        where: vendor.location ?? "Food stall",
      }));

    return [...here, ...food];
  }, [courts, vendors, venueSlug]);

  // geo: is understood by iOS, Android and most desktop map apps, and needs no
  // API key or provider decision.
  const directionsHref =
    venue?.latitude != null && venue?.longitude != null
      ? `geo:${venue.latitude},${venue.longitude}?q=${encodeURIComponent(venue.name)}`
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
        <div className={styles.canvas}>
          <MapIcon size={28} />
          <p className={styles.canvasTitle}>Interactive map coming soon</p>
          <p className={styles.canvasHint}>
            The mapping provider is still being chosen. In the meantime, open the venue in your
            own maps app and use the list below for what is where inside.
          </p>
          {directionsHref ? (
            <a className={styles.directions} href={directionsHref}>
              <PinIcon size={14} />
              Directions to {venue?.shortName}
            </a>
          ) : null}
        </div>
        {venue?.address ? <p className={styles.address}>{venue.address}</p> : null}
      </div>

      <h2 className="mg-section-title" style={{ margin: "16px var(--mg-gutter) 8px" }}>
        At {venue?.name ?? "this venue"}
      </h2>

      <div className={styles.zones}>
        {zones.map((zone) => (
          <div key={zone.key} className={styles.zone}>
            <span className={styles.zoneBadge} style={{ background: zone.color }}>
              {zone.badge}
            </span>
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
