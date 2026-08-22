/**
 * Inline SVG icons, lifted from the prototype (Lucide-style 24×24 strokes).
 *
 * Kept as local components rather than pulling in an icon package: the app
 * uses about a dozen glyphs, and inlining them means no extra dependency and
 * no client bundle for what is mostly server-rendered markup.
 */

type IconProps = {
  size?: number;
  className?: string;
};

function icon(path: React.ReactNode, extra?: { fill?: string }) {
  return function Icon({ size = 22, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={extra?.fill ?? "none"}
        stroke="currentColor"
        strokeWidth={2.1}
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

export const HomeIcon = icon(
  <>
    <path d="M3 10.5 12 3l9 7.5V21H3V10.5Z" />
    <path d="M9 21v-6h6v6" />
  </>,
);

export const CalendarIcon = icon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18M8 15h4" />
  </>,
);

export const ScoresIcon = icon(
  <>
    <path d="M4 20v-6M10 20V6M16 20v-9M22 20V10" transform="translate(-1 0)" />
    <path d="M3 20.5h18" />
  </>,
);

export const MapIcon = icon(
  <>
    <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z" />
    <path d="M9 3v16M15 5v16" />
  </>,
);

export const FoodIcon = icon(
  <path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 3c-1.5 0-3 2-3 5s1.5 4 3 4 3-1 3-4-1.5-5-3-5Zm0 9v9" />,
);

export const InfoIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4M12 8h.01" />
  </>,
);

export const BellIcon = icon(
  <>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </>,
);

export const ClockIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);

export const PinIcon = icon(
  <>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="2.5" />
  </>,
);

export const ChevronRightIcon = icon(<path d="M9 18l6-6-6-6" />);

export const ChevronDownIcon = icon(<path d="M6 9l6 6 6-6" />);

export const TrophyIcon = icon(
  <path d="M6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4M6 5h12v4a6 6 0 0 1-12 0V5ZM12 15v4M8 22h8M9 19h6" />,
);

export const AlertIcon = icon(
  <path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />,
);

export const BusIcon = icon(
  <path d="M5 17H3V6a1 1 0 0 1 1-1h11v12h-2M9 17h6M9 17a2 2 0 1 1-4 0M19 17a2 2 0 1 1-4 0M15 8h4l2 4v5h-2" />,
);

export const PhoneIcon = icon(
  <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11 11 0 0 0 3.5.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11 11 0 0 0 .56 3.5 1 1 0 0 1-.24 1Z" />,
  { fill: "currentColor" },
);

export const CloseIcon = icon(<path d="M18 6 6 18M6 6l12 12" />);

/**
 * The favourites star. Unlike the rest, its fill is driven by state — a filled
 * gold star means "following", an outline means "not following".
 */
export function StarIcon({
  size = 20,
  filled = false,
  className,
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7-6.3-3.4L5.7 21l1.3-7-5-4.8 7-.9Z" />
    </svg>
  );
}
