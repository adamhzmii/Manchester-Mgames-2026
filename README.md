# MGames 2026

Web app for **Manchester MGames 2026** — the Malaysian Students' Society of
Manchester one-day multi-sport tournament, Saturday 24 October 2026 at the
Trinity and Sugden sports centres.

Two audiences, one app:

- **Attendees** browse the schedule, live scores, venue info and food with no
  account at all.
- **Coordinators** sign in with their own per-sport account, which reveals
  inline edit controls on that sport's fixtures for pushing scores during the
  day. There is no separate admin dashboard.

Built from `mgames26_system_design_spec.md` and the Claude Design prototype.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, React 19, TypeScript) |
| Data + auth | Supabase (Postgres, Auth, Realtime) |
| Maps | Google Maps JavaScript API via `@vis.gl/react-google-maps` |
| Styling | CSS Modules over the design tokens in `src/app/globals.css` |
| Hosting | Vercel (free tier is sufficient for this event's scale) |

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in your Supabase project settings
npm run dev                    # http://localhost:3000
```

The app boots without configuration, but every data-backed page will report
that it cannot reach Supabase until `.env.local` is filled in.

### Running without Supabase

`.env.local` points at the real project, so `npm run dev` is all you need.
`tools/mock-supabase.mjs` remains as a local stand-in for Supabase's REST API,
useful for working offline or on the UI without touching the live project:

```bash
npm run mock     # serves fixed rows on :54999
npm run dev      # with NEXT_PUBLIC_SUPABASE_URL=http://localhost:54999
```

It returns a handful of canned rows in the shape `src/lib/queries.ts` expects.
It is not a database: no filtering, no writes, no auth, no realtime — so
coordinator sign-in and live score updates do nothing against it. Delete
`tools/` once a real project is up.

### Setting up the database

The schema lives in `supabase/` as ordinary SQL, so it can be applied with the
Supabase CLI or pasted into the dashboard's SQL editor.

```bash
supabase link --project-ref <your-project-ref>
supabase db push                       # applies supabase/migrations/*
psql "$DATABASE_URL" -f supabase/seed.sql   # optional: prototype data
```

- `migrations/20260822120000_init_schema.sql` — tables, enums, constraints, indexes
- `migrations/20260822120100_rls_and_realtime.sql` — RLS policies and the realtime publication
- `seed.sql` — a full day of realistic fixtures, vendors and announcements for
  local development. Truncates first, so it is safe to re-run and **must not**
  be run against production once real data exists.

Both migrations have been applied to the **Manchester-Mgames-2026** project
(`wtpujwtubqasofesvwki`, eu-west-2), and `seed.sql` has been loaded there.
Verified after the push: all ten tables readable by `anon`, anonymous writes
refused by RLS, the `fixtures` embed query resolving both team foreign keys,
and a score change propagating over realtime to an open page without a reload.

### Creating coordinator accounts

Each coordinator is a Supabase auth user plus a row in `coordinators` naming
the sport they cover. A row with a null `sport_id` is a committee admin who can
edit every sport.

1. **Authentication → Users → Add user**, with **Auto Confirm User** on — an
   unconfirmed account cannot sign in, and no SMTP is configured to send the
   verification email.
2. Add the matching row (SQL editor, which runs as the service role):

```sql
insert into coordinators (user_id, name, sport_id)
values (
  '<the new user id>',
  'Aisyah — Netball',
  (select id from sports where slug = 'netball')   -- or NULL for an admin
);
```

The restriction is enforced by the RLS policy on `fixtures`, not by the UI: a
netball coordinator who forges a request to change a football score has it
rejected by Postgres. Verified with a scoped test account — its own sport
wrote one row, another sport wrote zero.

### Regenerating database types

`src/lib/supabase/types.ts` is currently hand-written to mirror the migrations.
Once the project is linked it can be replaced wholesale:

```bash
npx supabase gen types typescript --linked > src/lib/supabase/types.ts
```

### Setting up Google Maps

`/map` embeds a real Google Map (via `@vis.gl/react-google-maps`) once
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set; without it, the page falls back to a
plain venue list and a `geo:` directions link — no crash, no broken embed.

1. In [Google Cloud Console](https://console.cloud.google.com), create a
   project (or reuse one) and enable the **Maps JavaScript API**.
2. **APIs & Services → Credentials → Billing** — link a billing account. A
   card is required to activate the API at all, even to stay within the free
   tier (10,000 map loads/month; well above what a one-day, ~1,000-attendee
   event will use). Google does not hard-stop at the free quota — set a budget
   alert in Cloud Console so an unexpected traffic spike doesn't run up a
   real bill unnoticed.
3. **Credentials → Create Credentials → API Key.**
4. **Restrict the key** before using it anywhere real — an unrestricted key is
   visible in the browser's page source and can be used from any site:
   - *Application restrictions* → **Websites**, add
     `localhost:3000/*` (dev) and your production domain (`*.vercel.app/*`
     or your custom domain once one is set).
   - *API restrictions* → restrict to **Maps JavaScript API** only.
5. Add it to `.env.local` and to Vercel's Environment Variables (Production
   *and* Preview, since preview deployments run on `*.vercel.app` too):

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-key-here
```

## Routes

| Route | Realtime | Notes |
|---|---|---|
| `/` | ✅ | Hero, latest announcement, "Happening now" rail |
| `/schedule` | ✅ | All fixtures; sport/venue/stage filters, My Games, coordinator editing |
| `/scores` | ✅ | Group tables (computed client-side) and knockout brackets |
| `/map` | — | Live Google Map plus a per-venue list of courts and stalls |
| `/food` | — | Vendors and menus |
| `/info` | — | First aid, prayer rooms, emergency contacts, FAQ |
| `/announcements` | ✅ | Committee feed, newest first |
| `/login` | — | Per-sport coordinator sign-in |

"Your team" is not a route. It is a sport → category → team drill-down
(`team-picker.tsx`), surfaced on the home page and as a filter toggle on
`/schedule`, backed by team ids in `localStorage` so attendees never need an
account. The drill-down exists because a flat roster does not disambiguate:
several clubs field a same-named side in more than one sport, and the category
is the only thing that tells them apart.

## How it fits together

```
src/
  app/                    routes; each data page is force-dynamic
  components/             presentational + client-interactive pieces
  lib/
    queries.ts            every server-side read, in one place
    coordinator.ts        coordinator identity + per-sport edit predicate
    fixtures.ts           fixture row → view model, filtering, sorting
    standings.ts          group tables computed from finished fixtures
    use-live-fixtures.ts  realtime subscription that patches scores in place
    use-favourite-teams.ts  localStorage store behind useSyncExternalStore
    actions/              server actions (score updates, auth)
    supabase/             browser + server clients, env, database types
  proxy.ts                session refresh (Next 16's renamed middleware)
```

**Security model.** Every page is public and read-only for anonymous visitors.
The only write is a coordinator updating a fixture, and the boundary that
enforces it is the RLS policy on `fixtures` — not the UI. The React tree
decides whether an Edit button *renders*; Postgres decides whether the write
*lands*, and it scopes that to the coordinator's own sport. A forged client can
show itself the edit sheet for another sport and still be refused.

**Realtime.** Fixture payloads carry the bare row, with no joined team or venue,
so `use-live-fixtures.ts` patches the three columns coordinators actually touch
(`score_a`, `score_b`, `status`) onto data the page already holds, and falls
back to `router.refresh()` for anything structural. Announcements are
self-contained and are prepended straight from the payload.

## Testing

```bash
npm test        # Node's test runner over the pure logic
npm run lint
npx tsc --noEmit
```

The tests cover the parts where a bug would be silent and wrong rather than
loud and broken: standings maths (including the per-sport points rules and
excluding in-progress matches), fixture filtering, and time formatting across
the BST/GMT boundary — the event is on the last BST weekend of 2026.

## Still open

Carried over from the spec, none of them blocking:

- **Announcements linking to a fixture** — deferred, no schema support yet.
- **Splitting coordinator editing into `/coordinator`** — the route structure
  supports it cleanly if the inline approach proves awkward on the day.
- **`.live` vs `.com` domain** — currently `mgames26.live`.
