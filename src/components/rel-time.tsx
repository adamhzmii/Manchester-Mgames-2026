"use client";

import { useMinute } from "@/lib/clock";
import { relative } from "@/lib/matchday";

/**
 * "in 12 min" / "8 min ago", kept current. Renders nothing until the client
 * clock is running, so the server's HTML never carries a stale relative time.
 */
export function RelTime({ iso, className }: { iso: string; className?: string }) {
  const now = useMinute();
  if (now === null) return null;
  return <span className={className}>{relative(Date.parse(iso), now)}</span>;
}
