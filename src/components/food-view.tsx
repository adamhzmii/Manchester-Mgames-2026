"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { FilterChips, type ChipOption } from "@/components/filter-chips";
import { PinIcon } from "@/components/icons";
import { formatPrice } from "@/lib/format";
import type { Vendor, Venue } from "@/lib/queries";

import styles from "./food-view.module.css";

export function FoodView({ vendors, venues }: { vendors: Vendor[]; venues: Venue[] }) {
  const [venue, setVenue] = useState("all");

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
          <article key={vendor.id} className={styles.vendor}>
            <div className={styles.photo}>
              {vendor.photoUrl ? (
                /* Vendor photos are arbitrary external URLs supplied by the
                   committee, and next/image needs every host allow-listed in
                   next.config up front. A plain <img> accepts whatever they
                   paste. */
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vendor.photoUrl} alt="" />
              ) : (
                <span>{vendor.cuisine}</span>
              )}
              <span className={styles.photoTag}>
                <PinIcon size={11} />
                {vendor.venueShortName}
              </span>
              <span className={styles.cuisineTag}>{vendor.cuisine}</span>
            </div>

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
