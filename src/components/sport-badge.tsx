import { SPORT_ICONS } from "@/components/sport-icons";

type SportBadgeProps = {
  code: string;
  color: string;
  slug?: string;
  name?: string;
  size?: number;
};

/**
 * The sport chip. Its colour comes from the `sports` row, not from CSS, so the
 * committee can add a sport without a code change.
 *
 * Shows a glyph where one exists and the two-letter code otherwise. That
 * fallback is the point rather than an edge case: sports are rows in a table,
 * and a sport added the week before the event still has to render something a
 * player can tell apart.
 */
export function SportBadge({ code, color, slug, name, size = 22 }: SportBadgeProps) {
  const Icon = slug ? SPORT_ICONS[slug] : undefined;

  return (
    <span
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        alignItems: "center",
        justifyContent: "center",
        fontSize: size <= 20 ? 9 : 10,
        fontWeight: 800,
        color: "#fff",
        background: color,
        flex: "0 0 auto",
      }}
    >
      {Icon ? <Icon size={Math.round(size * 0.72)} /> : code}
      {name ? <span className="mg-sr-only">{name}</span> : null}
    </span>
  );
}
