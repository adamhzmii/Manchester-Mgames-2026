import { ExternalIcon, PinIcon } from "@/components/icons";
import { formatPrice } from "@/lib/format";
import type { Vendor, Venue } from "@/lib/queries";
import { fromPrice, instagramHref, monogram, stallDirections, stallTone } from "@/lib/vendors";

import styles from "./vendor-card.module.css";

/**
 * A stall, presented to be chosen: a poster header (its photo, or its
 * initials on a colour of its own), then the line that sells it, where it
 * is, the menu with prices, and a way to find it and follow it.
 */
export function VendorCard({ vendor, venue }: { vendor: Vendor; venue?: Venue }) {
  const from = fromPrice(vendor);
  const directions = stallDirections(vendor, venue);

  return (
    // The id is the anchor other pages link to ("Food at Sugden" → this card).
    <article id={vendor.id} className={styles.card}>
      <div
        className={styles.visual}
        style={{ "--tone": stallTone(vendor.name) } as React.CSSProperties}
        data-photo={vendor.photoUrl ? "" : undefined}
      >
        {vendor.photoUrl ? (
          // Vendor photos are arbitrary URLs pasted by the committee;
          // next/image would need every host allow-listed up front.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vendor.photoUrl} alt="" className={styles.photo} />
        ) : (
          <span className={styles.monogram} aria-hidden="true">
            {monogram(vendor.name)}
          </span>
        )}
        <span className={styles.venue}>
          <PinIcon size={12} />
          {vendor.venueShortName}
        </span>
        {from !== null ? <span className={styles.from}>from {formatPrice(from)}</span> : null}
      </div>

      <div className={styles.body}>
        <p className={styles.cuisine}>{vendor.cuisine}</p>
        <h2 className={styles.name}>{vendor.name}</h2>
        {vendor.tagline ? <p className={styles.tagline}>{vendor.tagline}</p> : null}

        {vendor.tags.length > 0 ? (
          <ul className={styles.tags} aria-label="Good to know">
            {vendor.tags.map((tag) => (
              <li key={tag} className={styles.tag}>
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <p className={styles.where}>
          <PinIcon size={14} />
          {vendor.venueShortName}
          {vendor.location ? ` · ${vendor.location}` : ""}
        </p>

        {vendor.menu.length > 0 ? (
          <ul className={styles.menu} aria-label={`${vendor.name} menu`}>
            {vendor.menu.map((item) => (
              <li key={item.id} className={styles.item}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.leader} aria-hidden="true" />
                <span className={styles.price}>{formatPrice(item.pricePence)}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className={styles.actions}>
          {directions ? (
            <a href={directions} target="_blank" rel="noreferrer" className={`mg-btn ${styles.find}`}>
              Find the stall
            </a>
          ) : null}
          {vendor.instagram ? (
            <a
              href={instagramHref(vendor.instagram)}
              target="_blank"
              rel="noreferrer"
              className={`mg-btn ${styles.insta}`}
            >
              {/* The handle truncates; the icon after it stays put. */}
              <span className={styles.handle}>@{vendor.instagram}</span>
              <ExternalIcon size={15} />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
