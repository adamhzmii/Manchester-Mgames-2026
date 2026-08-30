"use client";

import { APIProvider, InfoWindow, Map, Marker, useApiIsLoaded } from "@vis.gl/react-google-maps";
import { useState } from "react";

import type { Venue } from "@/lib/queries";

import styles from "./google-venue-map.module.css";

/**
 * A muted, decluttered style so the embed reads as part of this app rather
 * than a raw Google Maps iframe: default POI icons and transit clutter add
 * nothing for "where is the sports centre", and the saturated default palette
 * fights the app's own purple/gold system.
 */
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ saturation: -75 }, { lightness: 8 }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "simplified" }] },
];

/** A teardrop pin as a data URI — Google's default red pin clashes with the brand. */
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

export function GoogleVenueMap({
  apiKey,
  venues,
  selectedSlug,
}: {
  apiKey: string;
  venues: Venue[];
  selectedSlug: string;
}) {
  return (
    <APIProvider apiKey={apiKey}>
      <VenueMapInner venues={venues} selectedSlug={selectedSlug} />
    </APIProvider>
  );
}

/**
 * Split from GoogleVenueMap because `pinIcon()` touches `google.maps.*`
 * directly, which does not exist until the Maps script `<APIProvider>` loads
 * has finished loading. `useApiIsLoaded` only works below `<APIProvider>` in
 * the tree, so the gate has to live in a child, not the wrapper itself — the
 * pins are just skipped for the one render or two before it flips to true,
 * which is fast enough that there is no visible empty-map flash worth a
 * loading spinner over.
 */
function VenueMapInner({
  venues,
  selectedSlug,
}: {
  venues: Venue[];
  selectedSlug: string;
}) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const apiIsLoaded = useApiIsLoaded();

  const selected = venues.find((v) => v.slug === selectedSlug);
  const withCoords = venues.filter((v) => v.latitude != null && v.longitude != null);

  if (!selected || selected.latitude == null || selected.longitude == null) {
    return null;
  }

  return (
    <Map
      className={styles.map}
      center={{ lat: selected.latitude, lng: selected.longitude }}
      zoom={16}
      styles={MAP_STYLE}
      disableDefaultUI
      zoomControl
      gestureHandling="cooperative"
      clickableIcons={false}
    >
      {apiIsLoaded &&
        withCoords.map((v) => {
          const isSelected = v.slug === selectedSlug;
          return (
            <Marker
              key={v.slug}
              position={{ lat: v.latitude!, lng: v.longitude! }}
              icon={pinIcon(isSelected ? "#D4A93C" : "#3C2A6E", isSelected ? 2.1 : 1.5)}
              zIndex={isSelected ? 2 : 1}
              onClick={() => setOpenSlug(v.slug)}
              title={v.name}
            />
          );
        })}

      {apiIsLoaded &&
        openSlug &&
        (() => {
          const v = venues.find((x) => x.slug === openSlug);
          if (!v || v.latitude == null || v.longitude == null) return null;
          return (
            <InfoWindow
              position={{ lat: v.latitude, lng: v.longitude }}
              onCloseClick={() => setOpenSlug(null)}
              headerContent={<strong>{v.name}</strong>}
            >
              {v.address ? <span>{v.address}</span> : null}
            </InfoWindow>
          );
        })()}
    </Map>
  );
}
