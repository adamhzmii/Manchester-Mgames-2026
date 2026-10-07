"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { VendorCard } from "@/components/vendor-card";
import type { Vendor, Venue } from "@/lib/queries";

import styles from "./food-view.module.css";

/**
 * Food & drink: every stall, presented to be chosen.
 *
 * The stalls are part of what makes the day, and helping them sell out is
 * part of the committee's job — so this is a page of its own in the main
 * navigation, not a list under Venues. Filtered by building, because what
 * you can eat depends on where you are standing; the filter is in the URL so
 * "Food at Sugden" is a link.
 */
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
  const router = useRouter();
  const pathname = usePathname();
  const [venue, setVenue] = useState(initialVenue);

  const choose = (next: string) => {
    setVenue(next);
    router.replace(next === "all" ? pathname : `${pathname}?venue=${next}`, { scroll: false });
  };

  const visible = venue === "all" ? vendors : vendors.filter((v) => v.venueSlug === venue);
  const count = (slug: string) => vendors.filter((v) => v.venueSlug === slug).length;
  // Only venues with stalls: Denmark Road has none, and a filter that shows
  // nothing is a dead end.
  const withFood = venues.filter((v) => count(v.slug) > 0);
  const where = new Intl.ListFormat("en-GB", { type: "conjunction" }).format(
    withFood.map((v) => v.shortName),
  );

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className="mg-wrap">
          <p className={styles.eyebrow}>Eat at MGames</p>
          <h1 className={styles.title}>Food &amp; drink</h1>
          <p className={styles.lede}>
            {vendors.length} stalls at {where}, serving all day. Find one near your next game.
          </p>

          <div className={styles.filter} role="radiogroup" aria-label="Venue">
            {[{ slug: "all", shortName: "All" }, ...withFood].map((v) => {
              const on = venue === v.slug;
              return (
                <button
                  key={v.slug}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`${styles.filterItem} ${on ? styles.filterOn : ""}`}
                  onClick={() => choose(v.slug)}
                >
                  {v.shortName}
                  <span className={styles.filterCount}>
                    {v.slug === "all" ? vendors.length : count(v.slug)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className={`mg-wrap ${styles.grid}`}>
        {visible.map((vendor) => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            venue={venues.find((v) => v.slug === vendor.venueSlug)}
          />
        ))}
        {visible.length === 0 ? (
          <p className={styles.empty}>No stalls listed here yet.</p>
        ) : null}
      </div>
    </div>
  );
}
