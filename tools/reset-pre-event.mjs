#!/usr/bin/env node
// Resets the tournament data to its pre-event state, for a dry run.
//
// Calls reset_demo_day_to_pre_event(), which is granted to service_role only —
// so this needs SUPABASE_SERVICE_ROLE_KEY and cannot be triggered from a
// browser. Prints the resulting state rather than just "ok", because the whole
// point of a reset is to be sure of what you are starting from.

import { readFileSync } from "node:fs";

// Read .env.local directly: this is a plain node script, not a Next process,
// so nothing has loaded it for us.
function loadEnv() {
  let text = "";
  try {
    text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

const reset = await fetch(`${url}/rest/v1/rpc/reset_demo_day_to_pre_event`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: "{}",
});

if (!reset.ok) {
  console.error(`Reset failed (HTTP ${reset.status}):`, await reset.text());
  process.exit(1);
}

// Timings from the dry run: real kick-offs, "starts at" times, the slips
// followers were told about. The reset puts statuses back; these go too, or
// the first court of the real day would start out "running late".
const timings = await fetch(`${url}/rest/v1/fixtures?id=not.is.null`, {
  method: "PATCH",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    started_at: null,
    finished_at: null,
    delay_minutes: 0,
    delay_notified_minutes: 0,
    planned_start: null,
  }),
});

if (!timings.ok) {
  console.error(`Clearing timings failed (HTTP ${timings.status}):`, await timings.text());
  process.exit(1);
}

const fixtures = await (
  await fetch(
    `${url}/rest/v1/fixtures?select=status,score_a,score_b,stage,team_a_id,placeholder_a,started_at,delay_minutes,planned_start`,
    { headers },
  )
).json();
const announcements = await (
  await fetch(`${url}/rest/v1/announcements?select=title`, { headers })
).json();

const byStatus = fixtures.reduce((acc, f) => {
  acc[f.status] = (acc[f.status] ?? 0) + 1;
  return acc;
}, {});
const scored = fixtures.filter((f) => f.score_a !== null || f.score_b !== null).length;
const awaiting = fixtures.filter((f) => f.placeholder_a !== null).length;
const timed = fixtures.filter((f) => f.started_at !== null || f.delay_minutes !== 0 || f.planned_start !== null).length;

console.log("Reset to pre-event.\n");
console.log(`  fixtures        ${fixtures.length}`);
for (const [status, n] of Object.entries(byStatus)) {
  console.log(`    ${status.padEnd(12)}  ${n}`);
}
console.log(`  with a score    ${scored}`);
console.log(`  awaiting a feed ${awaiting}  (knockout slots showing a placeholder)`);
console.log(`  with timings    ${timed}`);
console.log(`  announcements   ${announcements.length}`);

if (scored !== 0 || timed !== 0 || byStatus.upcoming !== fixtures.length) {
  console.error("\nUnexpected state after reset — check the migration.");
  process.exit(1);
}
