// Local stand-in for Supabase's PostgREST API.
//
// Lets the app run before a real Supabase project exists: it ignores the
// select string and returns a small fixed set of rows in exactly the shape
// src/lib/queries.ts expects. It is NOT a database — no filtering, no writes,
// no auth, no realtime — so the coordinator login and live score updates will
// not work against it.
//
// Delete this file and tools/ once `supabase db push` has run against a real
// project and .env.local points at it.
//
//   node tools/mock-supabase.mjs
import { createServer } from "node:http";

const sport = (slug, name, code, color, order) => ({
  id: `s-${slug}`, slug, name, code, color, sort_order: order,
});

const SPORTS = [
  sport("football", "Football", "FB", "#3C2A6E", 1),
  sport("basketball", "Basketball", "BB", "#C77D18", 2),
];

const VENUES = [
  { id: "v-sugden", slug: "sugden", name: "Sugden Sports Centre", short_name: "Sugden",
    address: "Grosvenor St, Manchester M1 7HL", latitude: 53.4727, longitude: -2.2343, sort_order: 2 },
  { id: "v-trinity", slug: "trinity", name: "Trinity Sports Centre", short_name: "Trinity",
    address: "Cambridge St, Manchester M15 6HE", latitude: 53.4702, longitude: -2.2439, sort_order: 1 },
];

const cat = (sportSlug) => ({
  id: `c-${sportSlug}`, name: "Open", slug: "open", sport: SPORTS.find((s) => s.slug === sportSlug),
});

const court = (id, name, venue) => ({ id, name, venue });

const fixture = (o) => ({
  id: o.id, stage: o.stage, status: o.status,
  score_a: o.sa ?? null, score_b: o.sb ?? null,
  scheduled_time: o.time, placeholder_a: o.pa ?? null, placeholder_b: o.pb ?? null,
  group_id: o.group ?? null,
  team_a: o.a ? { id: `t-${o.a}`, name: o.a } : null,
  team_b: o.b ? { id: `t-${o.b}`, name: o.b } : null,
  category: cat(o.sport),
  court: court(o.courtId, o.court, VENUES.find((v) => v.slug === o.venue)),
});

const FIXTURES = [
  fixture({ id: "f1", sport: "football", stage: "quarterfinal", status: "live", sa: 1, sb: 0,
    time: "2026-10-24T12:15:00Z", a: "KL Tigers", b: "Penang Panthers",
    courtId: "ct1", court: "Court 1", venue: "sugden" }),
  fixture({ id: "f2", sport: "basketball", stage: "group", status: "finished", sa: 42, sb: 38,
    time: "2026-10-24T09:00:00Z", a: "Penang Panthers", b: "Sabah Rhinos", group: "g-bb",
    courtId: "ct2", court: "Court 2", venue: "trinity" }),
  fixture({ id: "f3", sport: "football", stage: "final", status: "upcoming",
    time: "2026-10-24T15:00:00Z", pa: "Winner SF1", pb: "Winner SF2",
    courtId: "ct1", court: "Court 1", venue: "sugden" }),
];

const TABLES = {
  sports: SPORTS,
  venues: VENUES,
  categories: [{ id: "c-football" }, { id: "c-basketball" }],
  groups: [{ id: "g-bb", name: "Group A", sort_order: 1, category_id: "c-basketball",
             categories: { sports: { slug: "basketball" } } }],
  teams: [
    { id: "t-KL Tigers", name: "KL Tigers", group_id: null,
      categories: { sports: { slug: "football" } }, category: { sport: { name: "Football", slug: "football" } } },
    { id: "t-Penang Panthers", name: "Penang Panthers", group_id: "g-bb",
      categories: { sports: { slug: "basketball" } }, category: { sport: { name: "Basketball", slug: "basketball" } } },
    { id: "t-Sabah Rhinos", name: "Sabah Rhinos", group_id: "g-bb",
      categories: { sports: { slug: "basketball" } }, category: { sport: { name: "Basketball", slug: "basketball" } } },
  ],
  courts: [
    { id: "ct1", name: "Court 1", sort_order: 1, venue: { slug: "sugden" },
      sport: { name: "Football", code: "FB", color: "#3C2A6E" } },
    { id: "ct2", name: "Court 2", sort_order: 2, venue: { slug: "trinity" },
      sport: { name: "Basketball", code: "BB", color: "#C77D18" } },
  ],
  fixtures: FIXTURES,
  vendors: [{
    id: "vd1", name: "Nasi Lemak Corner", cuisine: "Malaysian", location: "Foyer · Stall 1",
    photo_url: null, sort_order: 1, venue: { slug: "sugden", short_name: "Sugden" },
    menu_items: [
      { id: "mi1", name: "Nasi Lemak Ayam", price_pence: 650, sort_order: 1 },
      { id: "mi2", name: "Teh Tarik", price_pence: 250, sort_order: 2 },
    ],
  }],
  announcements: [{
    id: "a1", type: "delay", title: "Basketball QF pushed back 15 min",
    body: "Sabah vs Selangor now tipping off at 13:30.", published_at: "2026-10-24T12:15:00Z",
  }],
};

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const table = url.pathname.replace(/^\/rest\/v1\//, "");

  if (url.pathname.startsWith("/auth/v1/")) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "no session" }));
    return;
  }

  let rows = TABLES[table];
  if (!rows) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: `no mock for ${table}`, code: "PGRST205" }));
    return;
  }

  // Honour the one filter the app relies on for the home rail.
  const status = url.searchParams.get("status");
  if (table === "fixtures" && status?.startsWith("eq.")) {
    rows = rows.filter((r) => r.status === status.slice(3));
  }

  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(rows));
});

server.listen(54999, () => console.log("mock supabase on :54999"));
