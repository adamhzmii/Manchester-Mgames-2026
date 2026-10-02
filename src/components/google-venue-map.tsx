"use client";

import { APIProvider, InfoWindow, Map, Marker, useApiIsLoaded, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useState, useSyncExternalStore } from "react";

import type { Vendor, Venue } from "@/lib/queries";

import styles from "./google-venue-map.module.css";

/**
 * A muted, decluttered style so the embed reads as part of this app rather
 * than a raw Google Maps iframe. Roads and their labels stay — people orient
 * by street names — but the saturated default palette and the generic POI
 * pins go, since neither helps anyone find a sports hall.
 */
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ saturation: -60 }, { lightness: 6 }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const GOLD = "#F2B630";
const PURPLE = "#3C2A6E";

/**
 * Google calls a global `gm_authFailure` when it rejects the API key — most
 * often because the page's address is not on the key's allowed list, which is
 * exactly what happened when the site moved to manchestermgames.com. Left
 * alone, the map becomes Google's grey "Sorry! Something went wrong" box. This
 * store lets the component notice and show a plain fallback instead.
 */
let authFailed = false;
const authListeners = new Set<() => void>();

function subscribeAuth(onChange: () => void): () => void {
  authListeners.add(onChange);
  (window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
    authFailed = true;
    for (const listener of authListeners) listener();
  };
  return () => authListeners.delete(onChange);
}

function useMapsAuthFailed(): boolean {
  return useSyncExternalStore(subscribeAuth, () => authFailed, () => false);
}

/**
 * A Google Maps link rather than a `geo:` URI. `geo:` is understood by native
 * apps but does nothing in a desktop browser, and this link has to work from
 * a laptop as well as a phone — where it opens the Maps app directly.
 */
function directionsHref(lat: number, lng: number, label: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=walking#${encodeURIComponent(label)}`;
}

/** Teardrop pin. Google's default red clashes with the brand palette. */
function pinIcon(color: string, scale: number): google.maps.Symbol {
  return {
    path: "M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z",
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 1.5,
    scale,
    anchor: new google.maps.Point(12, 22),
  };
}

type Selected =
  | { kind: "venue"; slug: string }
  | { kind: "vendor"; id: string }
  | null;

export function GoogleVenueMap({
  apiKey,
  venues,
  vendors,
  selectedSlug,
}: {
  apiKey: string;
  venues: Venue[];
  vendors: Vendor[];
  selectedSlug: string;
}) {
  const failed = useMapsAuthFailed();

  if (failed) {
    const venue = venues.find((v) => v.slug === selectedSlug);
    const href =
      venue?.latitude != null && venue?.longitude != null
        ? `https://www.google.com/maps/search/?api=1&query=${venue.latitude},${venue.longitude}`
        : "https://www.google.com/maps";
    return (
      <div className={styles.fallback}>
        <p className={styles.fallbackText}>The map can&rsquo;t load here right now.</p>
        <a href={href} target="_blank" rel="noreferrer" className={styles.fallbackLink}>
          Open {venue?.shortName ?? "the venue"} in Google Maps
        </a>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <VenueMapInner venues={venues} vendors={vendors} selectedSlug={selectedSlug} />
    </APIProvider>
  );
}

/**
 * Split from the wrapper because `pinIcon()` touches `google.maps.*`, which
 * does not exist until `<APIProvider>` has loaded the script — and
 * `useApiIsLoaded` only reports that from inside the provider.
 */
function VenueMapInner({
  venues,
  vendors,
  selectedSlug,
}: {
  venues: Venue[];
  vendors: Vendor[];
  selectedSlug: string;
}) {
  const [open, setOpen] = useState<Selected>(null);
  const apiIsLoaded = useApiIsLoaded();

  const selected = venues.find((v) => v.slug === selectedSlug);
  const venuePins = venues.filter((v) => v.latitude != null && v.longitude != null);

  // Only stalls at the venue being shown, and only those someone has actually
  // placed — the column is nullable precisely so an unplaced stall is listed
  // without being pinned to a guess.
  const vendorPins = vendors.filter(
    (v) => v.venueSlug === selectedSlug && v.latitude != null && v.longitude != null,
  );

  if (!selected || selected.latitude == null || selected.longitude == null) return null;

  const openVenue = open?.kind === "venue" ? venues.find((v) => v.slug === open.slug) : null;
  const openVendor = open?.kind === "vendor" ? vendors.find((v) => v.id === open.id) : null;

  return (
    <Map
      className={styles.map}
      // `defaultCenter`/`defaultZoom`, deliberately NOT `center`/`zoom`.
      // The latter make the map a controlled component: every pan re-renders
      // and snaps the camera straight back to the prop, which reads as a map
      // that simply will not move. Re-centring on a venue change is handled
      // imperatively by <RecenterOnVenue> below instead.
      defaultCenter={{ lat: selected.latitude, lng: selected.longitude }}
      defaultZoom={17}
      styles={MAP_STYLE}
      disableDefaultUI
      zoomControl
      fullscreenControl
      // `greedy`, not `cooperative`: the map sits in a fixed-height box that
      // cannot swallow the page scroll, and requiring ctrl-scroll or two
      // fingers made it feel frozen.
      gestureHandling="greedy"
      clickableIcons={false}
    >
      <RecenterOnVenue
        lat={selected.latitude}
        lng={selected.longitude}
        venueSlug={selectedSlug}
      />

      {apiIsLoaded &&
        venuePins.map((v) => {
          const isSelected = v.slug === selectedSlug;
          return (
            <Marker
              key={v.slug}
              position={{ lat: v.latitude!, lng: v.longitude! }}
              icon={pinIcon(isSelected ? PURPLE : "#9b93b5", isSelected ? 2.2 : 1.5)}
              zIndex={isSelected ? 3 : 1}
              onClick={() => setOpen({ kind: "venue", slug: v.slug })}
              title={v.name}
            />
          );
        })}

      {apiIsLoaded &&
        vendorPins.map((v) => (
          <Marker
            key={v.id}
            position={{ lat: v.latitude!, lng: v.longitude! }}
            icon={pinIcon(GOLD, 1.7)}
            zIndex={2}
            onClick={() => setOpen({ kind: "vendor", id: v.id })}
            title={v.name}
          />
        ))}

      {apiIsLoaded && openVenue && openVenue.latitude != null && openVenue.longitude != null ? (
        <InfoWindow
          position={{ lat: openVenue.latitude, lng: openVenue.longitude }}
          onCloseClick={() => setOpen(null)}
          headerContent={<strong>{openVenue.name}</strong>}
        >
          <div className={styles.info}>
            {openVenue.address ? <p className={styles.infoLine}>{openVenue.address}</p> : null}
            <a
              className={styles.infoLink}
              href={directionsHref(openVenue.latitude, openVenue.longitude, openVenue.name)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Directions in Google Maps ↗
            </a>
          </div>
        </InfoWindow>
      ) : null}

      {apiIsLoaded && openVendor && openVendor.latitude != null && openVendor.longitude != null ? (
        <InfoWindow
          position={{ lat: openVendor.latitude, lng: openVendor.longitude }}
          onCloseClick={() => setOpen(null)}
          headerContent={<strong>{openVendor.name}</strong>}
        >
          <div className={styles.info}>
            <p className={styles.infoLine}>
              {openVendor.cuisine}
              {openVendor.location ? ` · ${openVendor.location}` : ""}
            </p>
            <a
              className={styles.infoLink}
              href={directionsHref(openVendor.latitude, openVendor.longitude, openVendor.name)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Directions in Google Maps ↗
            </a>
          </div>
        </InfoWindow>
      ) : null}
    </Map>
  );
}

/**
 * Pans the map when the visitor switches venue tab.
 *
 * Done imperatively rather than by binding `center`, so the map stays
 * uncontrolled and free to drag between switches. Keyed on the slug, not the
 * coordinates, so it only fires on a real tab change — not on every render
 * that happens to rebuild the latitude/longitude object.
 */
function RecenterOnVenue({
  lat,
  lng,
  venueSlug,
}: {
  lat: number;
  lng: number;
  venueSlug: string;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo({ lat, lng });
    map.setZoom(17);
    // `lat`/`lng` are intentionally not dependencies: they are derived from
    // venueSlug, and including them would re-centre mid-drag if a parent
    // re-rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, venueSlug]);

  return null;
}
