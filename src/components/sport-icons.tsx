/**
 * One glyph per sport, keyed by the `sports.slug` in the database.
 *
 * Drawn in the same 24×24 stroke style as icons.tsx so a sport chip sits
 * alongside the nav and star icons without looking imported from somewhere
 * else. Everything is `currentColor`, so a chip only has to set a colour.
 *
 * Shapes are chosen for silhouette rather than accuracy: at 22px nobody reads
 * the seams on a ball, they read "round with a cross" vs "round with panels"
 * vs "paddle". Netball is a hoop rather than a ball precisely because a netball
 * and a volleyball are indistinguishable at this size.
 *
 * Lookup is deliberately partial — see SPORT_ICONS below.
 */

type SportIconProps = {
  size?: number;
  className?: string;
};

function sportIcon(path: React.ReactNode) {
  return function SportIcon({ size = 22, className }: SportIconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
      >
        {path}
      </svg>
    );
  };
}

/** Ball with the classic pentagon-and-spokes panelling. */
const FootballIcon = sportIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8.8 15.04 11.01 13.88 14.59H10.12L8.96 11.01Z" />
    <path d="M12 8.8V3.2M15.04 11.01 20.5 9.2M13.88 14.59 17.3 19.3M10.12 14.59 6.7 19.3M8.96 11.01 3.5 9.2" />
  </>,
);

/** One straight seam across the middle, two arcs bowing inward from the sides.
    An earlier version added a vertical seam too and the result read as a globe
    — and as an identical twin of the volleyball. */
const BasketballIcon = sportIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M5.6 5.6c3.9 3.4 3.9 9.4 0 12.8" />
    <path d="M18.4 5.6c-3.9 3.4-3.9 9.4 0 12.8" />
  </>,
);

/** The ring and net, not a ball: a netball is indistinguishable from a
    volleyball at chip size. An earlier version balanced a ball on top of the
    ring, which just read as a head above a pair of shoulders. */
const NetballIcon = sportIcon(
  <>
    <ellipse cx="12" cy="7" rx="6.4" ry="2.3" />
    <path d="M6.1 8.1c1.2 5.2 3.2 8.6 5.9 10.4" />
    <path d="M17.9 8.1c-1.2 5.2-3.2 8.6-5.9 10.4" />
    <path d="M8.4 13.2c2.4 1 4.8 1 7.2 0" />
  </>,
);

/** Panels that sweep across rather than meeting in a cross — the asymmetry is
    what stops it reading as a globe next to the basketball. */
const VolleyballIcon = sportIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M4.1 7.4c5.4 3.2 11 4.9 16.7 5.1" />
    <path d="M8.9 20.4c1.2-5.8 4-10.8 8.4-14.9" />
    <path d="M3.2 13c4.7.8 8.9 3.5 11.9 7.6" />
  </>,
);

/** Shuttlecock: cork below, feathers flaring to a rim. */
const BadmintonIcon = sportIcon(
  <>
    <circle cx="12" cy="17.6" r="2.7" />
    <path d="M9.7 16.1 5.6 5.4M14.3 16.1 18.4 5.4M11 15.2 12 4.4M13 15.2 12 4.4" />
    <path d="M5.6 5.4c4.2-1.9 8.6-1.9 12.8 0" />
  </>,
);

/** Round bat and ball. */
const TableTennisIcon = sportIcon(
  <>
    <circle cx="9.5" cy="9.3" r="5.6" />
    <path d="m13.3 13.4 4.4 4.9" />
    <circle cx="18.6" cy="8.4" r="1.9" />
  </>,
);

/** Square-ish perforated paddle — the detail that separates it from a bat. */
const PickleballIcon = sportIcon(
  <>
    <rect x="4.2" y="2.9" width="10.6" height="12.6" rx="3.2" />
    <path d="M8 6.8h.01M11.5 6.8h.01M8 10.4h.01M11.5 10.4h.01" />
    <path d="M9.5 15.5v5.2" />
    <circle cx="19" cy="15" r="2.4" />
  </>,
);

/** A disc seen edge-on. */
const FrisbeeIcon = sportIcon(
  <>
    <ellipse cx="12" cy="13.2" rx="9" ry="4.6" />
    <ellipse cx="12" cy="12.2" rx="4.4" ry="2.1" />
  </>,
);

/**
 * Partial on purpose. The sports table is data the committee can add rows to,
 * and a new sport must not render a blank chip while it waits for a glyph —
 * SportBadge falls back to the two-letter code for anything missing here.
 */
export const SPORT_ICONS: Record<string, ReturnType<typeof sportIcon>> = {
  football: FootballIcon,
  basketball: BasketballIcon,
  netball: NetballIcon,
  volleyball: VolleyballIcon,
  badminton: BadmintonIcon,
  "table-tennis": TableTennisIcon,
  pickleball: PickleballIcon,
  frisbee: FrisbeeIcon,
};
