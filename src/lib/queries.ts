import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { cache } from "react";

import {
  FIXTURE_SELECT,
  toFixture,
  byRelevance,
  type Fixture,
  type FixtureRow,
} from "@/lib/fixtures";
import { applyDemo, applyDemoVendors, demoAnnouncements, demoScenario } from "@/lib/demo";
import type { GroupMeta, TeamMeta } from "@/lib/standings";
import { createClient } from "@/lib/supabase/server";
import type { Coordinator } from "@/lib/coordinator";
import type { AnnouncementType } from "@/lib/supabase/types";

/**
 * Every read the app does, in one place.
 *
 * None of these are cached across requests. Scores and announcements change
 * during the event and a stale render is worse than an extra query against a
 * dataset this size; the pages that use them render dynamically on purpose.
 *
 * The common reads are wrapped in React's cache(), which only memoises within
 * one request: a match page's generateMetadata and its body both need the
 * fixture list, and this makes that one query rather than two.
 */

export type Sport = {
  id: string;
  slug: string;
  name: string;
  code: string;
  color: string;
};

export type Venue = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type Announcement = {
  id: string;
  type: AnnouncementType;
  title: string;
  body: string | null;
  publishedAt: string;
};

export type Vendor = {
  id: string;
  name: string;
  cuisine: string;
  location: string | null;
  photoUrl: string | null;
  venueSlug: string;
  venueShortName: string;
  /** Null until someone places the stall on the venue map; unplaced stalls are listed, not pinned. */
  latitude: number | null;
  longitude: number | null;
  tagline: string | null;
  /** Handle without the @, or null. */
  instagram: string | null;
  tags: string[];
  menu: { id: string; name: string; pricePence: number }[];
};

/**
 * A team as the "find my team" flow needs it: enough sport and category
 * metadata to drill down sport -> category -> team without another query.
 * Team names repeat across sports (KL Tigers field a side in several), so the
 * category is what actually disambiguates one from another.
 */
export type PickerTeam = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  sportId: string;
  sportName: string;
  sportSlug: string;
  sportCode: string;
  sportColor: string;
  sportOrder: number;
};

export type Court = {
  id: string;
  name: string;
  venueSlug: string;
  sportName: string | null;
  sportSlug: string | null;
  sportColor: string | null;
  sportCode: string | null;
};

/**
 * supabase-js reports failures in `error` rather than throwing. Swallowing one
 * would render an empty schedule that looks like "no games today", so every
 * read funnels through here and fails loudly instead.
 *
 * The parameter is written as a discriminated union rather than
 * `{ data: T | null }` — with the latter, TypeScript infers `T` as `never`
 * from supabase's own success/failure union and every field access downstream
 * silently becomes an error.
 */
function unwrap<T>(
  what: string,
  result: { data: T; error: null } | { data: null; error: PostgrestError },
): T {
  if (result.error) {
    throw new Error(`Failed to load ${what}: ${result.error.message}`);
  }
  if (result.data === null) {
    throw new Error(`Failed to load ${what}: no data returned`);
  }
  return result.data;
}

export const getSports = cache(async function getSports(): Promise<Sport[]> {
  const supabase = await createClient();
  const rows = unwrap(
    "sports",
    await supabase
      .from("sports")
      .select("id, slug, name, code, color")
      .order("sort_order"),
  );
  return rows;
});

export const getVenues = cache(async function getVenues(): Promise<Venue[]> {
  const supabase = await createClient();
  const rows = unwrap(
    "venues",
    await supabase
      .from("venues")
      .select("id, slug, name, short_name, address, latitude, longitude")
      .order("sort_order"),
  );
  return rows.map((v) => ({
    id: v.id,
    slug: v.slug,
    name: v.name,
    shortName: v.short_name,
    address: v.address,
    latitude: v.latitude,
    longitude: v.longitude,
  }));
});

/** Every fixture in the tournament, sorted live → upcoming → finished. */
export const getFixtures = cache(async function getFixtures(): Promise<Fixture[]> {
  const supabase = await createClient();
  const rows = unwrap(
    "fixtures",
    await supabase.from("fixtures").select(FIXTURE_SELECT).order("scheduled_time"),
  );
  return (await withDemo((rows as unknown as FixtureRow[]).map(toFixture))).sort(byRelevance);
});

/**
 * Passes fixtures through the matchday rehearsal when one is running locally
 * (see demo.ts), and straight through otherwise. Exported for /api/live, which
 * reads fixtures through its own cookie-free client.
 */
export async function withDemo(fixtures: Fixture[]): Promise<Fixture[]> {
  if (!demoScenario()) return fixtures;
  return applyDemo(fixtures, await getStandingsData());
}

/** The "Happening now" rail on the home page. */
export async function getLiveFixtures(): Promise<Fixture[]> {
  // A rehearsal decides what is live in memory, so the database's own status
  // column would disagree with it.
  if (demoScenario()) {
    return (await getFixtures())
      .filter((f) => f.status === "live")
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  }
  const supabase = await createClient();
  const rows = unwrap(
    "live fixtures",
    await supabase
      .from("fixtures")
      .select(FIXTURE_SELECT)
      .eq("status", "live")
      .order("scheduled_time"),
  );
  return (rows as unknown as FixtureRow[]).map(toFixture);
}

export async function getFixturesForSport(sportSlug: string): Promise<Fixture[]> {
  const all = await getFixtures();
  return all.filter((f) => f.sportSlug === sportSlug);
}

/**
 * Groups and team→group membership, needed to build the standings tables.
 *
 * Resolved step by step (sport → its categories → their groups and teams)
 * rather than one query filtering across two levels of embedded resource. The
 * extra round trips are nothing at this size and the filters stay obvious.
 */
export async function getGroupsAndTeams(
  sportSlug: string,
): Promise<{ groups: GroupMeta[]; teams: TeamMeta[] }> {
  const supabase = await createClient();

  // limit(1) + [0] rather than maybeSingle(): an unknown slug is a normal
  // outcome here (empty tables), not a query failure to throw on.
  const sports = unwrap(
    "sport",
    await supabase.from("sports").select("id").eq("slug", sportSlug).limit(1),
  );
  const sport = sports[0];
  if (!sport) return { groups: [], teams: [] };

  const categories = unwrap(
    "categories",
    await supabase.from("categories").select("id").eq("sport_id", sport.id),
  );

  const categoryIds = categories.map((c) => c.id);
  if (categoryIds.length === 0) return { groups: [], teams: [] };

  const groupRows = unwrap(
    "groups",
    await supabase
      .from("groups")
      .select("id, name, sort_order, category_id")
      .in("category_id", categoryIds)
      .order("sort_order"),
  );

  const teamRows = unwrap(
    "teams",
    await supabase
      .from("teams")
      .select("id, name, group_id")
      .in("category_id", categoryIds)
      .order("name"),
  );

  return {
    groups: groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      sortOrder: g.sort_order,
      categoryId: g.category_id,
    })),
    teams: teamRows.map((t) => ({ id: t.id, name: t.name, groupId: t.group_id })),
  };
}

/**
 * Group and team metadata for every sport at once, tagged with the sport slug.
 *
 * The scores screen switches sports with a chip. Fetching per sport would put
 * a round trip behind every tap; the whole tournament's groups and teams are a
 * couple of hundred rows, so they are loaded once and the tables are computed
 * in the browser.
 */
export const getStandingsData = cache(async function getStandingsData(): Promise<{
  groups: (GroupMeta & { sportSlug: string })[];
  teams: (TeamMeta & { sportSlug: string })[];
}> {
  const supabase = await createClient();

  const groupRows = unwrap(
    "groups",
    await supabase
      .from("groups")
      .select("id, name, sort_order, category_id, categories!inner ( sports!inner ( slug ) )")
      .order("sort_order"),
  );

  const teamRows = unwrap(
    "teams",
    await supabase
      .from("teams")
      .select("id, name, group_id, categories!inner ( sports!inner ( slug ) )")
      .order("name"),
  );

  type GroupRow = {
    id: string;
    name: string;
    sort_order: number;
    category_id: string;
    categories: { sports: { slug: string } | null } | null;
  };
  type TeamRow = {
    id: string;
    name: string;
    group_id: string | null;
    categories: { sports: { slug: string } | null } | null;
  };

  return {
    groups: (groupRows as unknown as GroupRow[]).map((g) => ({
      id: g.id,
      name: g.name,
      sortOrder: g.sort_order,
      categoryId: g.category_id,
      sportSlug: g.categories?.sports?.slug ?? "",
    })),
    teams: (teamRows as unknown as TeamRow[]).map((t) => ({
      id: t.id,
      name: t.name,
      groupId: t.group_id,
      sportSlug: t.categories?.sports?.slug ?? "",
    })),
  };
});

/**
 * Every team, for the "My Games" picker and the coordinator's bracket-slot
 * assignment picker. `categoryId` is what the latter filters on — a sport can
 * have several categories (Pickleball's Men's/Women's Doubles) with disjoint
 * team pools, and sport alone isn't a fine-grained enough filter to stop a
 * women's doubles team showing up as a candidate for a men's doubles slot.
 */
export const getTeams = cache(async function getTeams(): Promise<PickerTeam[]> {
  const supabase = await createClient();
  const rows = unwrap(
    "teams",
    await supabase
      .from("teams")
      .select(
        `id, name, category_id,
         category:categories ( name, sport:sports ( id, name, slug, code, color, sort_order ) )`,
      )
      .order("name"),
  );

  type Row = {
    id: string;
    name: string;
    category_id: string;
    category: {
      name: string;
      sport: {
        id: string;
        name: string;
        slug: string;
        code: string;
        color: string;
        sort_order: number;
      } | null;
    } | null;
  };

  return (rows as unknown as Row[]).map((t) => ({
    id: t.id,
    name: t.name,
    categoryId: t.category_id,
    categoryName: t.category?.name ?? "",
    sportId: t.category?.sport?.id ?? "",
    sportName: t.category?.sport?.name ?? "",
    sportSlug: t.category?.sport?.slug ?? "",
    sportCode: t.category?.sport?.code ?? "??",
    sportColor: t.category?.sport?.color ?? "#3C2A6E",
    sportOrder: t.category?.sport?.sort_order ?? 0,
  }));
});

export async function getAnnouncements(limit?: number): Promise<Announcement[]> {
  const rehearsal = demoAnnouncements();
  if (rehearsal) return limit === undefined ? rehearsal : rehearsal.slice(0, limit);

  const supabase = await createClient();
  let query = supabase
    .from("announcements")
    .select("id, type, title, body, published_at")
    .order("published_at", { ascending: false });

  if (limit !== undefined) query = query.limit(limit);

  const rows = unwrap("announcements", await query);
  return rows.map((a) => ({
    id: a.id,
    type: a.type,
    title: a.title,
    body: a.body,
    publishedAt: a.published_at,
  }));
}

export async function getVendors(): Promise<Vendor[]> {
  const supabase = await createClient();
  const rows = unwrap(
    "vendors",
    await supabase
      .from("vendors")
      .select(
        `id, name, cuisine, location, photo_url, sort_order, latitude, longitude,
         tagline, instagram, tags,
         venue:venues ( slug, short_name ),
         menu_items ( id, name, price_pence, sort_order )`,
      )
      .order("sort_order"),
  );

  type Row = {
    id: string;
    name: string;
    cuisine: string;
    location: string | null;
    photo_url: string | null;
    latitude: number | null;
    longitude: number | null;
    tagline: string | null;
    instagram: string | null;
    tags: string[] | null;
    venue: { slug: string; short_name: string } | null;
    menu_items: { id: string; name: string; price_pence: number; sort_order: number }[];
  };

  return applyDemoVendors((rows as unknown as Row[]).map((v) => ({
    id: v.id,
    name: v.name,
    cuisine: v.cuisine,
    location: v.location,
    photoUrl: v.photo_url,
    venueSlug: v.venue?.slug ?? "",
    venueShortName: v.venue?.short_name ?? "",
    latitude: v.latitude,
    longitude: v.longitude,
    tagline: v.tagline?.trim() || null,
    instagram: v.instagram?.trim().replace(/^@/, "") || null,
    tags: (v.tags ?? []).filter((t) => t.trim() !== ""),
    // Nested rows come back in insertion order, not the order requested on the
    // parent — sort the menu here so prices read top to bottom as intended.
    menu: [...v.menu_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({ id: m.id, name: m.name, pricePence: m.price_pence })),
  })));
}

export async function getCourts(): Promise<Court[]> {
  const supabase = await createClient();
  const rows = unwrap(
    "courts",
    await supabase
      .from("courts")
      .select("id, name, sort_order, venue:venues ( slug ), sport:sports ( name, slug, code, color )")
      .order("sort_order"),
  );

  type Row = {
    id: string;
    name: string;
    venue: { slug: string } | null;
    sport: { name: string; slug: string; code: string; color: string } | null;
  };

  return (rows as unknown as Row[]).map((c) => ({
    id: c.id,
    name: c.name,
    venueSlug: c.venue?.slug ?? "",
    sportName: c.sport?.name ?? null,
    sportSlug: c.sport?.slug ?? null,
    sportColor: c.sport?.color ?? null,
    sportCode: c.sport?.code ?? null,
  }));
}

/**
 * Who, if anyone, is signed in as a coordinator on this request.
 *
 * Drives whether edit affordances render — it is not the security boundary.
 * That is the RLS policy on `fixtures`: a forged client can show itself the
 * edit UI for another sport and still have the write rejected by Postgres.
 *
 * `sportId: null` means a committee admin who may edit every sport.
 */
export const getCoordinator = cache(async function getCoordinator(): Promise<Coordinator | null> {
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return null;

  // The signed-in user may be authenticated without being a coordinator (the
  // row is provisioned separately), so an empty result here is a normal
  // outcome, not an error. RLS limits this to the caller's own row.
  const { data, error } = await supabase
    .from("coordinators")
    .select("name, sport_id")
    .limit(1);

  if (error || !data || data.length === 0) return null;

  return { name: data[0].name, sportId: data[0].sport_id };
});

