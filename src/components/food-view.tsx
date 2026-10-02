"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { FilterChips, type ChipOption } from "@/components/filter-chips";
import { PinIcon } from "@/components/icons";
import { formatPrice } from "@/lib/format";
import type { Vendor, Venue } from "@/lib/queries";

import styles from "./food-view.module.css";

export function FoodView({
  vendors,
  venues,
  initialVenue = "all",
}: {
  vendors: Vendor[];
  venues: Venue[];
  /** From ?venue=, so a link from a venue's page lands on that venue's stalls. */
  initialVenue?: string;
}) {
  const [venue, setVenue] = useState(initialVenue);

  const options: ChipOption[] = useMemo(
    () => [
      { value: "all", label: "All venues" },
      ...venues.map((v) => ({ value: v.slug, label: v.shortName })),
    ],
    [venues],
  );

  const visible = useMemo(
    () => (venue === "all" ? vendors : vendors.filter((v) => v.venueSlug === venue)),
    [vendors, venue],
  );

  return (
    <div className="mg-page mg-container-wide" style={{ padding: 0 }}>
      <div className={styles.head}>
        <h1 className="mg-page-title">Food &amp; Drink</h1>
      </div>

      <FilterChips label="Filter by venue" options={options} value={venue} onChange={setVenue} />

      <div className={styles.list}>
        {visible.map((vendor) => (
          // The id is the anchor the venue page links to.
          <article key={vendor.id} id={vendor.id} className={styles.vendor}>
            {/* No photo is the normal case, not a failure: vendors are booked
                long before anyone takes pictures of the stalls. Reserving the
                full photo band for them left 130px of empty grey per vendor
                with the cuisine name ghosted into the middle of it, directly
                beside the tag that already said the same word. Without a photo
                the labels collapse to a single compact row. */}
            {vendor.photoUrl ? (
              <div className={styles.photo}>
                {/* Vendor photos are arbitrary external URLs supplied by the
                    committee, and next/image needs every host allow-listed in
                    next.config up front. A plain <img> accepts whatever they
                    paste. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={vendor.photoUrl} alt="" />
                <span className={styles.photoTag}>
                  <PinIcon size={11} />
                  {vendor.venueShortName}
                </span>
                <span className={styles.cuisineTag}>{vendor.cuisine}</span>
              </div>
            ) : (
              <div className={styles.labelRow}>
                <span className={styles.photoTag}>
                  <PinIcon size={11} />
                  {vendor.venueShortName}
                </span>
                <span className={styles.cuisineTag}>{vendor.cuisine}</span>
              </div>
            )}

            <div className={styles.body}>
              <div className={styles.vendorHead}>
                <div>
                  <h2 className={styles.name}>{vendor.name}</h2>
                  {vendor.location ? <p className={styles.where}>{vendor.location}</p> : null}
                </div>
                <Link href={`/map?venue=${vendor.venueSlug}`} className={styles.mapLink}>
                  <PinIcon size={12} />
                  Map
                </Link>
              </div>

              <ul className={styles.menu}>
                {vendor.menu.map((item) => (
                  <li key={item.id} className={styles.menuRow}>
                    <span className={styles.menuName}>{item.name}</span>
                    <span className={styles.leader} aria-hidden="true" />
                    <span className={styles.price}>{formatPrice(item.pricePence)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
