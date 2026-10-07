import { InstagramIcon, PinIcon } from "@/components/icons";
import { formatPrice } from "@/lib/format";
import type { Vendor, Venue } from "@/lib/queries";
import { fromPrice, instagramHref, stallDirections } from "@/lib/vendors";

import styles from "./vendor-card.module.css";

/**
 * A stall, presented to be chosen: what it cooks, the line that sells it,
 * where it is, the menu with prices, and a way to find it and follow it.
 * Every card has the same shape — no photo or logo slot, since only some
 * stalls would have one to put in it.
 */
export function VendorCard({ vendor, venue }: { vendor: Vendor; venue?: Venue }) {
  const from = fromPrice(vendor);
  const directions = stallDirections(vendor, venue);

  return (
    // The id is the anchor other pages link to ("Food at Sugden" → this card).
    <article id={vendor.id} className={styles.card}>
      <div className={styles.body}>
        <div className={styles.head}>
          <p className={styles.cuisine}>{vendor.cuisine}</p>
          {from !== null ? <span className={styles.from}>from {formatPrice(from)}</span> : null}
        </div>
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
          {vendor.venueShortName
            ? `${vendor.venueShortName}${vendor.location ? ` · ${vendor.location}` : ""}`
            : "Stall location to be confirmed"}
        </p>
        {/* A line of its own, so the whole handle shows — squeezed into a
            button beside "Find the stall" it was cut to "@dem…". */}
        {vendor.instagram ? (
          <a
            href={instagramHref(vendor.instagram)}
            target="_blank"
            rel="noreferrer"
            className={styles.insta}
          >
            <InstagramIcon size={14} />
            <span className={styles.handle}>@{vendor.instagram}</span>
          </a>
        ) : null}

        {vendor.menu.length > 0 ? (
          <ul className={styles.menu} aria-label={`${vendor.name} menu`}>
            {vendor.menu.map((item) => (
              <li key={item.id} className={styles.item}>
                <span className={styles.itemLine}>
                  <span className={styles.itemName}>{item.name}</span>
                  {item.pricePence !== null ? (
                    <>
                      <span className={styles.leader} aria-hidden="true" />
                      <span className={styles.price}>{formatPrice(item.pricePence)}</span>
                    </>
                  ) : null}
                </span>
                {item.description ? <span className={styles.itemNote}>{item.description}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}

        {directions ? (
          <div className={styles.actions}>
            <a href={directions} target="_blank" rel="noreferrer" className={`mg-btn ${styles.find}`}>
              Find the stall
            </a>
          </div>
        ) : null}
      </div>
    </article>
  );
}
