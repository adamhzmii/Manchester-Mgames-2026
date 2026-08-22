type SportBadgeProps = {
  code: string;
  color: string;
  name?: string;
  size?: number;
};

/**
 * The two-letter sport chip. Its colour comes from the `sports` row, not from
 * CSS, so the committee can add a sport without a code change.
 */
export function SportBadge({ code, color, name, size = 22 }: SportBadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
        fontSize: size <= 20 ? 9 : 10,
        fontWeight: 800,
        color: "#fff",
        background: color,
        flex: "0 0 auto",
      }}
    >
      {code}
      {name ? <span className="mg-sr-only">{name}</span> : null}
    </span>
  );
}
