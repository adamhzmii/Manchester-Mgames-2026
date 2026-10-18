#!/usr/bin/env node
// Builds MGames 2026's timetable — every game at the time and on the court in
// the committee's fixture spreadsheet ("[INTERNAL] MGAMES 26 FIXTURE
// SCHEDULE") — and writes it as a migration:
//
//   python3 tools/extract-schedule.py "<sheet>.xlsx" > tools/schedule-2026.json
//   node tools/schedule-2026.mjs > supabase/migrations/<stamp>_timetable.sql
//
// Teams and group games come from the sheet, via the JSON. Knockouts are
// written below: the sheet numbers knockout games its own way (down one
// pitch, then the next); the site numbers them by kick-off, then court, so
// references like "Winner 7" are translated here, not copied.
//
// Checks as it goes and reports to stderr: a court booked for two games at
// once, or a team in two games at once.

import { readFileSync } from "node:fs";

const DAY = "2026-10-24";
const OFFSET = "+01"; // British Summer Time on the day

// ------------------------------------------------------------- helpers ----

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toClock = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Knockout references in the sheet's own numbering, translated below.
const win = (stage, n) => ({ ref: stage, n, outcome: "Winner" });
const lose = (stage, n) => ({ ref: stage, n, outcome: "Loser" });
const KO_STAGE = { R16: "round_of_16", QF: "quarterfinal", SF: "semifinal" };

/** A knockout game: the sheet's number for it within its round, when and where, and who. */
const ko = (stage, n, time, court, a, b) => ({ stage, n, time, court, a, b });

const thirdAndFinal = (thirdTime, thirdCourt, finalTime, finalCourt) => [
  ko("third_place", 1, thirdTime, thirdCourt, lose("SF", 1), lose("SF", 2)),
  ko("final", 1, finalTime, finalCourt, win("SF", 1), win("SF", 2)),
];

// ------------------------------------------------------------- the day ----

// Group games and teams, read from the sheet by tools/extract-schedule.py.
const SHEET = JSON.parse(readFileSync(new URL("./schedule-2026.json", import.meta.url), "utf8"));

// Names the committee has confirmed since the sheet was last saved.
const RENAMES = {
  "Mamak Teh Beng Goreng": "Mamak Teh Beng",
};
for (const entry of SHEET) {
  const rename = (name) => RENAMES[name] ?? name;
  for (const letter of Object.keys(entry.groups)) entry.groups[letter] = entry.groups[letter].map(rename);
  for (const game of entry.games) Object.assign(game, { a: rename(game.a), b: rename(game.b) });
}

// `len` is how long a game holds its court, from each tab's heading (playing
// time plus interval) — used only to check for clashes. Knockouts are the
// sheet's, numbered the sheet's way; the site's numbers are worked out below.
const SPORTS = [
  {
    slug: "football",
    venue: "denmark-road",
    courts: ["Pitch A", "Pitch B", "Pitch C"],
    len: { group: 13, knockout: 15, semifinal: 18, final: 22 },
    categories: [
      {
        slug: "open",
        name: "Open",
        knockouts: [
          ko("R16", 1, "12:00", "Pitch A", "Group A winner", "Best 3rd (3)"),
          ko("R16", 2, "12:20", "Pitch A", "Group B winner", "Best 3rd (1)"),
          ko("R16", 3, "12:40", "Pitch A", "Group C winner", "Group D runner-up"),
          ko("R16", 4, "12:00", "Pitch B", "Group D winner", "Best 3rd (2)"),
          ko("R16", 5, "12:20", "Pitch B", "Group A runner-up", "Group C runner-up"),
          ko("R16", 6, "12:40", "Pitch B", "Group B runner-up", "Best 3rd (4)"),
          ko("R16", 7, "12:00", "Pitch C", "Group E winner", "Group F runner-up"),
          ko("R16", 8, "12:20", "Pitch C", "Group F winner", "Group E runner-up"),
          ko("QF", 1, "14:00", "Pitch A", win("R16", 1), win("R16", 7)),
          ko("QF", 2, "14:20", "Pitch A", win("R16", 2), win("R16", 8)),
          ko("QF", 3, "14:00", "Pitch B", win("R16", 3), win("R16", 5)),
          ko("QF", 4, "14:20", "Pitch B", win("R16", 4), win("R16", 6)),
          ko("SF", 1, "15:00", "Pitch A", win("QF", 1), win("QF", 2)),
          ko("SF", 2, "15:00", "Pitch B", win("QF", 3), win("QF", 4)),
          ...thirdAndFinal("15:40", "Pitch A", "15:40", "Pitch B"),
        ],
      },
    ],
  },
  {
    slug: "basketball",
    venue: "sugden",
    courts: ["Hall A"],
    len: { group: 15, knockout: 21, final: 21 },
    categories: [
      {
        slug: "open",
        name: "Open",
        // Two groups: straight to the semi-finals.
        knockouts: [
          ko("SF", 1, "11:40", "Hall A", "Group A winner", "Group B runner-up"),
          ko("SF", 2, "12:10", "Hall A", "Group B winner", "Group A runner-up"),
          ...thirdAndFinal("13:40", "Hall A", "14:10", "Hall A"),
        ],
      },
    ],
  },
  {
    slug: "volleyball",
    venue: "sugden",
    courts: ["Hall B"],
    len: { group: 22, knockout: 22, semifinal: 25, final: 25 },
    categories: [
      {
        slug: "open",
        name: "Open",
        knockouts: [
          ko("QF", 1, "15:00", "Hall B", "Group A winner", "Group C runner-up"),
          ko("QF", 2, "15:22", "Hall B", "Group B winner", "Group D runner-up"),
          ko("QF", 3, "15:44", "Hall B", "Group C winner", "Group A runner-up"),
          ko("QF", 4, "16:08", "Hall B", "Group D winner", "Group B runner-up"),
          ko("SF", 1, "16:40", "Hall B", win("QF", 1), win("QF", 2)),
          ko("SF", 2, "17:05", "Hall B", win("QF", 3), win("QF", 4)),
          ...thirdAndFinal("17:35", "Hall B", "18:00", "Hall B"),
        ],
      },
    ],
  },
  {
    slug: "netball",
    venue: "trinity",
    courts: ["Netball Court A", "Netball Court B"],
    len: { group: 15, knockout: 15, semifinal: 18, final: 22 },
    categories: [
      {
        slug: "open",
        name: "Open",
        knockouts: [
          ko("QF", 1, "12:30", "Netball Court A", "Group A winner", "Group C runner-up"),
          ko("QF", 2, "12:50", "Netball Court A", "Group B winner", "Group D runner-up"),
          ko("QF", 3, "12:30", "Netball Court B", "Group C winner", "Group A runner-up"),
          ko("QF", 4, "12:50", "Netball Court B", "Group D winner", "Group B runner-up"),
          ko("SF", 1, "14:10", "Netball Court A", win("QF", 1), win("QF", 2)),
          ko("SF", 2, "14:40", "Netball Court A", win("QF", 3), win("QF", 4)),
          ...thirdAndFinal("15:30", "Netball Court A", "16:00", "Netball Court A"),
        ],
      },
    ],
  },
  {
    slug: "frisbee",
    venue: "trinity",
    courts: ["Sport Hall"],
    len: { group: 20, knockout: 20, final: 20 },
    categories: [
      {
        slug: "open",
        name: "Open",
        knockouts: [
          ko("QF", 1, "15:20", "Sport Hall", "Group A winner", "Group B runner-up"),
          ko("QF", 2, "15:42", "Sport Hall", "Group B winner", "Group A runner-up"),
          ko("QF", 3, "16:04", "Sport Hall", "Group C winner", "Group D runner-up"),
          ko("QF", 4, "16:26", "Sport Hall", "Group D winner", "Group C runner-up"),
          ko("SF", 1, "16:53", "Sport Hall", win("QF", 1), win("QF", 3)),
          ko("SF", 2, "17:15", "Sport Hall", win("QF", 2), win("QF", 4)),
          ...thirdAndFinal("17:45", "Sport Hall", "18:07", "Sport Hall"),
        ],
      },
    ],
  },
  {
    slug: "badminton",
    venue: "sugden",
    courts: ["Court C1", "Court C2", "Court C3", "Court C4", "Court D1", "Court D2", "Court D3", "Court D4"],
    len: { group: 12, knockout: 12, semifinal: 18, final: 18 },
    categories: [
      {
        slug: "ms",
        name: "Men's Singles",
        // Three groups of three: winners, runners-up and the two best thirds.
        knockouts: [
          ko("QF", 1, "09:40", "Court C1", "Group A winner", "Group C runner-up"),
          ko("QF", 2, "09:40", "Court C2", "Group B winner", "Best 3rd (1)"),
          ko("QF", 3, "09:40", "Court C3", "Group C winner", "Group B runner-up"),
          ko("QF", 4, "09:40", "Court C4", "Group A runner-up", "Best 3rd (2)"),
          ko("SF", 1, "11:30", "Court D1", win("QF", 1), win("QF", 2)),
          ko("SF", 2, "11:30", "Court D2", win("QF", 3), win("QF", 4)),
          ...thirdAndFinal("12:00", "Court D1", "12:00", "Court D2"),
        ],
      },
      {
        slug: "wd",
        name: "Women's Doubles",
        knockouts: [
          ko("SF", 1, "09:50", "Court D1", "Group A winner", "Group B runner-up"),
          ko("SF", 2, "09:50", "Court D2", "Group B winner", "Group A runner-up"),
          ...thirdAndFinal("10:15", "Court D1", "10:15", "Court D2"),
        ],
      },
      {
        slug: "md",
        name: "Men's Doubles",
        knockouts: [
          ko("R16", 1, "14:00", "Court C1", "Group A winner", "Best 3rd (3)"),
          ko("R16", 2, "14:00", "Court C2", "Group B winner", "Best 3rd (1)"),
          ko("R16", 3, "14:00", "Court C3", "Group C winner", "Group D runner-up"),
          ko("R16", 4, "14:00", "Court C4", "Group D winner", "Best 3rd (2)"),
          ko("R16", 5, "14:15", "Court C1", "Group A runner-up", "Group C runner-up"),
          ko("R16", 6, "14:15", "Court C2", "Group B runner-up", "Best 3rd (4)"),
          ko("R16", 7, "14:15", "Court C3", "Group E winner", "Group F runner-up"),
          ko("R16", 8, "14:15", "Court C4", "Group F winner", "Group E runner-up"),
          ko("QF", 1, "14:35", "Court C1", win("R16", 1), win("R16", 5)),
          ko("QF", 2, "14:35", "Court C2", win("R16", 2), win("R16", 6)),
          ko("QF", 3, "14:35", "Court C3", win("R16", 3), win("R16", 7)),
          ko("QF", 4, "14:35", "Court C4", win("R16", 4), win("R16", 8)),
          ko("SF", 1, "15:00", "Court C1", win("QF", 1), win("QF", 2)),
          ko("SF", 2, "15:00", "Court C2", win("QF", 3), win("QF", 4)),
          ...thirdAndFinal("15:30", "Court C1", "15:30", "Court C2"),
        ],
      },
      {
        slug: "xd",
        name: "Mixed Doubles",
        knockouts: [
          ko("QF", 1, "13:10", "Court C1", "Group A winner", "Group E winner"),
          ko("QF", 2, "13:10", "Court C2", "Group B winner", "Best 2nd (1)"),
          ko("QF", 3, "13:10", "Court C3", "Group C winner", "Best 2nd (2)"),
          ko("QF", 4, "13:10", "Court C4", "Group D winner", "Best 2nd (3)"),
          ko("SF", 1, "16:00", "Court C1", win("QF", 1), win("QF", 2)),
          ko("SF", 2, "16:00", "Court C2", win("QF", 3), win("QF", 4)),
          ...thirdAndFinal("16:30", "Court C1", "16:30", "Court C2"),
        ],
      },
    ],
  },
  {
    slug: "pickleball",
    venue: "sugden",
    // Hall D, once badminton is out of it. Group games are first to 15 under
    // a 15-minute cap; knockouts after the quarter-finals are best of three
    // to 11, given 30 minutes by the sheet.
    courts: ["Court D1", "Court D2", "Court D3", "Court D4"],
    len: { group: 15, quarterfinal: 15, knockout: 30, final: 30 },
    categories: [
      {
        slug: "md",
        name: "Men's Doubles",
        knockouts: [
          ko("QF", 1, "16:05", "Court D1", "Group A winner", "Group B runner-up"),
          ko("QF", 2, "16:05", "Court D2", "Group B winner", "Group A runner-up"),
          ko("QF", 3, "16:05", "Court D3", "Group C winner", "Group D runner-up"),
          ko("QF", 4, "16:25", "Court D1", "Group D winner", "Group C runner-up"),
          ko("SF", 1, "16:50", "Court D2", win("QF", 1), win("QF", 3)),
          ko("SF", 2, "16:50", "Court D1", win("QF", 2), win("QF", 4)),
          ...thirdAndFinal("17:30", "Court D2", "17:30", "Court D1"),
        ],
      },
      {
        slug: "xd",
        name: "Mixed Doubles",
        // One group of five: third v fourth for bronze, first v second for gold.
        knockouts: [
          ko("third_place", 1, "16:40", "Court D4", "Group A 3rd", "Group A 4th"),
          ko("final", 1, "17:15", "Court D4", "Group A 1st", "Group A 2nd"),
        ],
      },
    ],
  },
  {
    slug: "table-tennis",
    venue: "trinity",
    courts: ["Temple Gym 1", "Temple Gym 2"],
    len: { group: 12, knockout: 27, final: 27 },
    categories: [
      {
        slug: "open",
        name: "Open",
        // The sheet gives the third-place game and the final a time, not a
        // table: one each.
        knockouts: [
          ko("SF", 1, "16:00", "Temple Gym 1", "Group A winner", "Group B runner-up"),
          ko("SF", 2, "16:00", "Temple Gym 2", "Group B winner", "Group A runner-up"),
          ...thirdAndFinal("16:45", "Temple Gym 1", "16:45", "Temple Gym 2"),
        ],
      },
    ],
  },
];

// ------------------------------------------------------------ building ----

const LETTERS = "ABCDEFGH";
const courtOrder = (name) => name.replace(/\d+/g, (d) => d.padStart(3, "0"));

const courtRows = [];
const categoryRows = [];
const groupRows = [];
const teamRows = [];
const fixtureRows = [];
/** For the clash checks: [sport, court, start minute, end minute, label, teams]. */
const bookings = [];

const seenCourts = new Set();

for (const sport of SPORTS) {
  sport.courts.forEach((court, i) => {
    const key = `${sport.venue}|${court}`;
    if (seenCourts.has(key)) return;
    seenCourts.add(key);
    courtRows.push([sport.venue, sport.slug, court, i + 1]);
  });

  sport.categories.forEach((cat, c) => {
    categoryRows.push([sport.slug, cat.slug, cat.name, c + 1]);
    const tag = `${sport.slug}${cat.slug === "open" ? "" : ` ${cat.slug.toUpperCase()}`}`;

    const sheet = SHEET.find((x) => x.sport === sport.slug && x.category === cat.slug);
    if (!sheet) throw new Error(`${tag}: not in schedule-2026.json`);
    Object.entries(sheet.groups).forEach(([letter, members], g) => {
      const groupName = `Group ${letter}`;
      groupRows.push([sport.slug, cat.slug, groupName, g + 1]);
      members.forEach((name) => teamRows.push([sport.slug, cat.slug, groupName, name]));
      for (const game of sheet.games.filter((x) => x.group === letter)) {
        if (!sport.courts.includes(game.court)) throw new Error(`${tag}: no court ${game.court}`);
        fixtureRows.push([sport.slug, cat.slug, groupName, "group", game.a, game.b, null, null, sport.venue, game.court, `${DAY} ${game.time}${OFFSET}`]);
        bookings.push([sport, game.court, toMin(game.time), toMin(game.time) + sport.len.group, `${tag} ${groupName}`, [`${tag}:${game.a}`, `${tag}:${game.b}`]]);
      }
    });

    // Knockouts: number each round the way the site will (kick-off, then
    // court), and translate the sheet's references into those numbers.
    const siteNumber = new Map();
    for (const ref of Object.keys(KO_STAGE)) {
      const round = cat.knockouts
        .filter((k) => k.stage === ref)
        .sort((x, y) => toMin(x.time) - toMin(y.time) || courtOrder(x.court).localeCompare(courtOrder(y.court)));
      round.forEach((k, i) => siteNumber.set(`${ref}:${k.n}`, i + 1));
    }
    const label = (side) => {
      if (typeof side === "string") return side;
      const n = siteNumber.get(`${side.ref}:${side.n}`);
      if (!n) throw new Error(`${tag}: no ${side.ref} ${side.n} to refer to`);
      return side.ref === "R16" ? `${side.outcome} R16 ${n}` : `${side.outcome} ${side.ref}${n}`;
    };
    for (const k of cat.knockouts) {
      const stage = KO_STAGE[k.stage] ?? k.stage;
      fixtureRows.push([sport.slug, cat.slug, null, stage, null, null, label(k.a), label(k.b), sport.venue, k.court, `${DAY} ${k.time}${OFFSET}`]);
      const len =
        stage === "final" || stage === "third_place" ? sport.len.final : (sport.len[stage] ?? sport.len.knockout);
      bookings.push([sport, k.court, toMin(k.time), toMin(k.time) + len, `${tag} ${stage}`, []]);
    }
  });
}

// -------------------------------------------------------------- checks ----

const problems = [];
for (let i = 0; i < bookings.length; i += 1) {
  for (let j = i + 1; j < bookings.length; j += 1) {
    const [sa, ca, a0, a1, la, ta] = bookings[i];
    const [sb, cb, b0, b1, lb, tb] = bookings[j];
    const overlap = a0 < b1 && b0 < a1;
    if (!overlap) continue;
    if (sa.venue === sb.venue && ca === cb) {
      problems.push(`court ${sa.venue} ${ca}: ${la} at ${toClock(a0)} and ${lb} at ${toClock(b0)}`);
    }
    const both = ta.filter((t) => tb.includes(t));
    if (a0 === b0 && both.length > 0) problems.push(`team ${both[0]} twice at ${toClock(a0)}`);
  }
}

// --------------------------------------------------------------- SQL out ----

const q = (v) => (v === null ? "null" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const values = (rows) => rows.map((r) => `  (${r.map(q).join(", ")})`).join(",\n");

const sql = `-- MGames 2026's timetable, generated by tools/schedule-2026.mjs from the
-- committee's fixture spreadsheet (version 10): every game at its time and on
-- its court, every knockout slot wired to the game that feeds it, and the
-- registered teams.
--
-- ${teamRows.length} teams, ${groupRows.length} groups, ${fixtureRows.length} games.

create or replace function reset_demo_day_to_pre_event()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- \`id is not null\`: pg-safeupdate refuses an UPDATE or DELETE without a WHERE.
  update fixtures
  set status = 'upcoming', score_a = null, score_b = null,
      started_at = null, finished_at = null,
      delay_minutes = 0, delay_notified_minutes = 0, planned_start = null
  where id is not null;

  -- A slot with a label is decided by an earlier game: until then, no team.
  update fixtures set team_a_id = null where placeholder_a is not null and team_a_id is not null;
  update fixtures set team_b_id = null where placeholder_b is not null and team_b_id is not null;

  -- Updates narrate a day in progress; keep only what is posted before doors.
  delete from announcements where id is not null;
  insert into announcements (type, title, body, published_at) values
    ('notice', 'Welcome to MGames 2026!',
     'MGames runs 8am to 8pm. Check in at your sport''s venue at least 20 minutes before your first game to collect your wristband.',
     '${DAY} 08:00${OFFSET}');
end;
$$;

revoke all on function reset_demo_day_to_pre_event() from public;
revoke all on function reset_demo_day_to_pre_event() from anon, authenticated;
grant execute on function reset_demo_day_to_pre_event() to service_role;

-- The welcome update already posted says what the rulebook says.
update announcements
  set body = 'MGames runs 8am to 8pm. Check in at your sport''s venue at least 20 minutes before your first game to collect your wristband.'
  where title = 'Welcome to MGames 2026!';

-- Updates posted during the dry runs name teams that no longer exist.
delete from announcements where title <> 'Welcome to MGames 2026!';

-- Out with the old: categories take their groups, teams and games — and every
-- dry-run result, delay and start time — with them.
delete from categories where id is not null;
delete from courts where id is not null;

insert into courts (venue_id, sport_id, name, sort_order)
select v.id, s.id, x.name, x.sort_order
from (values
${values(courtRows)}
) as x(venue, sport, name, sort_order)
join venues v on v.slug = x.venue
join sports s on s.slug = x.sport;

insert into categories (sport_id, slug, name, sort_order)
select s.id, x.slug, x.name, x.sort_order
from (values
${values(categoryRows)}
) as x(sport, slug, name, sort_order)
join sports s on s.slug = x.sport;

insert into groups (category_id, name, sort_order)
select c.id, x.name, x.sort_order
from (values
${values(groupRows)}
) as x(sport, category, name, sort_order)
join sports s on s.slug = x.sport
join categories c on c.sport_id = s.id and c.slug = x.category;

insert into teams (category_id, group_id, name)
select c.id, g.id, x.name
from (values
${values(teamRows)}
) as x(sport, category, group_name, name)
join sports s on s.slug = x.sport
join categories c on c.sport_id = s.id and c.slug = x.category
join groups g on g.category_id = c.id and g.name = x.group_name;

insert into fixtures (category_id, group_id, stage, team_a_id, team_b_id,
                      placeholder_a, placeholder_b, court_id, scheduled_time, status)
select c.id, g.id, x.stage::fixture_stage, ta.id, tb.id,
       x.slot_a, x.slot_b, ct.id, x.kickoff::timestamptz, 'upcoming'
from (values
${values(fixtureRows)}
) as x(sport, category, group_name, stage, team_a, team_b, slot_a, slot_b, venue, court, kickoff)
join sports s on s.slug = x.sport
join categories c on c.sport_id = s.id and c.slug = x.category
left join groups g on g.category_id = c.id and g.name = x.group_name
left join teams ta on ta.category_id = c.id and ta.name = x.team_a
left join teams tb on tb.category_id = c.id and tb.name = x.team_b
join venues v on v.slug = x.venue
join courts ct on ct.venue_id = v.id and ct.name = x.court;
`;

process.stdout.write(sql);
console.error(`${teamRows.length} teams, ${groupRows.length} groups, ${fixtureRows.length} games`);
for (const sport of SPORTS) {
  const own = fixtureRows.filter((f) => f[0] === sport.slug);
  const times = own.map((f) => f[10].slice(11, 16)).sort();
  console.error(`  ${sport.slug.padEnd(13)} ${String(own.length).padStart(3)} games  ${times[0]}–${times[times.length - 1]}`);
}
if (problems.length > 0) {
  console.error(`\n${problems.length} clash(es):`);
  for (const p of problems) console.error(`  ${p}`);
}
