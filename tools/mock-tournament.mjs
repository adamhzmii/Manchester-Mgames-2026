#!/usr/bin/env node
// Builds the mock tournament in the committee's 2026 format and writes it as a
// migration: every sport and category with the group sizes from the planning
// sheet, a round robin in every group, a knockout behind it, and a timetable
// that never puts a court or a team in two places at once.
//
//   node tools/mock-tournament.mjs > supabase/migrations/<stamp>_mock_tournament.sql
//
// Mock data for testing the site, not the real draw: the teams are fictional
// contingents, and the courts and timings are plausible rather than booked.

const DAY = "2026-10-24";
const OFFSET = "+01"; // British Summer Time on the day
const START = 8 * 60 + 30; // 08:30

// Fictional contingents, by state and city. A category takes its teams from
// this list, starting at a different place each time so groups vary.
const NAMES = [
  "KL Tigers", "Selangor Smashers", "Penang Panthers", "Johor Warriors",
  "Kedah Eagles", "Perak Bison", "Melaka Mariners", "Sabah Rhinos",
  "Sarawak Hornbills", "Terengganu Turtles", "Kelantan Kijangs", "Pahang Elephants",
  "Negeri Nine", "Perlis Pythons", "Putrajaya Pumas", "Labuan Lions",
  "Ipoh Iguanas", "Kuching Cats", "Kota Kinabalu Kings", "Miri Mantas",
  "Seremban Stags", "Kuantan Kites", "Langkawi Lynx", "Shah Alam Sharks",
];

// Knockouts, as lists of slot pairs per round, in the order each round is
// numbered (kick-off, then court). The labels are the site's slot grammar.
const W = (round, n) => `Winner ${round}${round === "R16" ? " " : ""}${n}`;
const KNOCKOUTS = {
  // Six groups of four: top two and the four best thirds, as MGames 2025.
  "r16-6": [
    ["round_of_16", [
      ["Group A winner", "Best 3rd (3)"], ["Group A runner-up", "Group C runner-up"],
      ["Group B winner", "Best 3rd (1)"], ["Group B runner-up", "Best 3rd (4)"],
      ["Group C winner", "Group D runner-up"], ["Group E winner", "Group F runner-up"],
      ["Group D winner", "Best 3rd (2)"], ["Group F winner", "Group E runner-up"],
    ]],
    ["quarterfinal", [
      [W("R16", 1), W("R16", 6)], [W("R16", 5), W("R16", 2)],
      [W("R16", 3), W("R16", 8)], [W("R16", 7), W("R16", 4)],
    ]],
    ["semifinal", [[W("QF", 1), W("QF", 3)], [W("QF", 2), W("QF", 4)]]],
  ],
  // Five groups into eight: the winners and the three best runners-up.
  "qf-5": [
    ["quarterfinal", [
      ["Group A winner", "Best 2nd (3)"], ["Group B winner", "Best 2nd (2)"],
      ["Group C winner", "Best 2nd (1)"], ["Group D winner", "Group E winner"],
    ]],
    ["semifinal", [[W("QF", 1), W("QF", 2)], [W("QF", 3), W("QF", 4)]]],
  ],
  // Four groups: top two, crossed.
  "qf-4": [
    ["quarterfinal", [
      ["Group A winner", "Group B runner-up"], ["Group C winner", "Group D runner-up"],
      ["Group B winner", "Group A runner-up"], ["Group D winner", "Group C runner-up"],
    ]],
    ["semifinal", [[W("QF", 1), W("QF", 2)], [W("QF", 3), W("QF", 4)]]],
  ],
  // Two groups of five: the top four of each, crossed.
  "qf-2x4": [
    ["quarterfinal", [
      ["Group A 1st", "Group B 4th"], ["Group B 2nd", "Group A 3rd"],
      ["Group B 1st", "Group A 4th"], ["Group A 2nd", "Group B 3rd"],
    ]],
    ["semifinal", [[W("QF", 1), W("QF", 2)], [W("QF", 3), W("QF", 4)]]],
  ],
  // Two groups of four: top two, crossed, straight into the semis.
  "sf-2": [
    ["semifinal", [["Group A winner", "Group B runner-up"], ["Group B winner", "Group A runner-up"]]],
  ],
  // One round robin: the top four, 1st v 4th and 2nd v 3rd.
  "sf-1": [
    ["semifinal", [["Group A 1st", "Group A 4th"], ["Group A 2nd", "Group A 3rd"]]],
  ],
};

const OPEN = { slug: "open", name: "Open" };

// Group sizes from the committee's planning sheet. Courts and slot lengths
// are the mock's own.
const SPORTS = [
  { slug: "football", venue: "denmark-road", courts: ["Pitch 1", "Pitch 2", "Pitch 3"], slot: 15,
    categories: [{ ...OPEN, groups: [4, 4, 4, 4, 4, 4], ko: "r16-6" }] },
  { slug: "badminton", venue: "sugden", courts: ["Court 1", "Court 2", "Court 3", "Court 4", "Court 5", "Court 6"], slot: 15,
    categories: [
      { slug: "md", name: "Men's Doubles", groups: [4, 4, 4, 4, 4, 4], ko: "r16-6" },
      { slug: "xd", name: "Mixed Doubles", groups: [4, 4, 4, 4, 4], ko: "qf-5" },
      { slug: "ms", name: "Men's Singles", groups: [4, 4, 4, 4], ko: "qf-4" },
      { slug: "wd", name: "Women's Doubles", groups: [5, 5], ko: "qf-2x4" },
    ] },
  { slug: "netball", venue: "trinity", courts: ["Court 3", "Court 4"], slot: 15,
    categories: [{ ...OPEN, groups: [4, 4, 4, 4], ko: "qf-4" }] },
  { slug: "frisbee", venue: "trinity", courts: ["Court 5", "Court 6"], slot: 20,
    categories: [{ ...OPEN, groups: [4, 4, 3, 3], ko: "qf-4" }] },
  { slug: "volleyball", venue: "trinity", courts: ["Main Hall"], slot: 20,
    categories: [{ ...OPEN, groups: [4, 3, 3, 3], ko: "qf-4" }] },
  { slug: "basketball", venue: "trinity", courts: ["Court 2"], slot: 15,
    categories: [{ ...OPEN, groups: [3, 3, 3, 3], ko: "qf-4" }] },
  { slug: "pickleball", venue: "sugden", courts: ["Court 7", "Court 8"], slot: 15,
    categories: [
      { slug: "md", name: "Men's Doubles", groups: [4, 4], ko: "sf-2" },
      { slug: "xd", name: "Mixed Doubles", groups: [4, 4], ko: "sf-2" },
    ] },
  { slug: "table-tennis", venue: "sugden", courts: ["TT Room"], slot: 15,
    categories: [{ ...OPEN, groups: [6], ko: "sf-1" }] },
];

const LETTERS = "ABCDEFGH";

/** Round-robin rounds for n teams (indices), by the circle method. */
function roundRobin(n) {
  const ids = [...Array(n).keys()];
  if (n % 2 === 1) ids.push(null); // a bye
  const rounds = [];
  for (let r = 0; r < ids.length - 1; r += 1) {
    const games = [];
    for (let i = 0; i < ids.length / 2; i += 1) {
      const a = ids[i];
      const b = ids[ids.length - 1 - i];
      if (a !== null && b !== null) games.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(games);
    ids.splice(1, 0, ids.pop()); // rotate all but the first
  }
  return rounds;
}

const clock = (sport, slot) => {
  const minutes = START + slot * sport.slot;
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${DAY} ${hh}:${mm}${OFFSET}`;
};

const groupRows = [];
const teamRows = [];
const fixtureRows = [];
const courtRows = [];
const categoryRows = [];

SPORTS.forEach((sport) => {
  sport.courts.forEach((court, i) => courtRows.push([sport.venue, sport.slug, court, i + 1]));

  // The timetable for this sport's courts: per slot, how many courts are
  // taken and which teams are playing.
  const used = [];
  const playing = [];
  const place = (teams, earliest, rest) => {
    for (let t = earliest; ; t += 1) {
      used[t] ??= 0;
      playing[t] ??= new Set();
      if (used[t] >= sport.courts.length) continue;
      if (teams.some((k) => playing[t].has(k))) continue;
      // A slot off between games where the day allows it.
      if (rest && teams.some((k) => playing[t - 1]?.has(k))) continue;
      const court = sport.courts[used[t]];
      used[t] += 1;
      teams.forEach((k) => playing[t].add(k));
      return { slot: t, court };
    }
  };

  // Groups and teams.
  const queue = [];
  sport.categories.forEach((cat, c) => {
    categoryRows.push([sport.slug, cat.slug, cat.name, c + 1]);
    const offset = (SPORTS.indexOf(sport) * 7 + c * 5) % NAMES.length;
    let next = 0;
    cat.groups.forEach((size, g) => {
      const groupName = `Group ${LETTERS[g]}`;
      groupRows.push([sport.slug, cat.slug, groupName, g + 1]);
      const members = [];
      for (let i = 0; i < size; i += 1) {
        const name = NAMES[(offset + next) % NAMES.length];
        next += 1;
        members.push(name);
        teamRows.push([sport.slug, cat.slug, groupName, name]);
      }
      roundRobin(size).forEach((games, r) =>
        games.forEach(([a, b]) =>
          queue.push({ round: r, c, g, cat, groupName, a: members[a], b: members[b] }),
        ),
      );
    });
  });

  // Group games: round by round across every group, so each group moves on
  // together, each in the earliest slot with a free court and rested teams.
  queue.sort((x, y) => x.round - y.round || x.c - y.c || x.g - y.g);
  const groupsEnd = new Map();
  for (const game of queue) {
    const keys = [`${game.cat.slug}:${game.a}`, `${game.cat.slug}:${game.b}`];
    const { slot, court } = place(keys, 0, true);
    groupsEnd.set(game.cat.slug, Math.max(groupsEnd.get(game.cat.slug) ?? 0, slot));
    fixtureRows.push([sport.slug, game.cat.slug, game.groupName, "group", game.a, game.b, null, null,
      sport.venue, court, clock(sport, slot)]);
  }

  // Knockouts: each round after the last, with a slot's break between, and
  // each round's games placed in the order they are numbered.
  sport.categories.forEach((cat) => {
    let start = (groupsEnd.get(cat.slug) ?? 0) + 2;
    for (const [stage, games] of KNOCKOUTS[cat.ko]) {
      let last = start;
      let latest = start;
      for (const [a, b] of games) {
        const { slot, court } = place([], last, false);
        last = slot;
        latest = Math.max(latest, slot);
        fixtureRows.push([sport.slug, cat.slug, null, stage, null, null, a, b, sport.venue, court, clock(sport, slot)]);
      }
      start = latest + 2;
    }
    const third = place([], start, false);
    fixtureRows.push([sport.slug, cat.slug, null, "third_place", null, null, "Loser SF1", "Loser SF2", sport.venue, third.court, clock(sport, third.slot)]);
    const final = place([], third.slot + 1, false);
    fixtureRows.push([sport.slug, cat.slug, null, "final", null, null, "Winner SF1", "Winner SF2", sport.venue, final.court, clock(sport, final.slot)]);
  });
});

// --------------------------------------------------------------- SQL out ----

const q = (v) => (v === null ? "null" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const values = (rows) => rows.map((r) => `  (${r.map(q).join(", ")})`).join(",\n");

const sql = `-- The mock tournament in the committee's 2026 format, generated by
-- tools/mock-tournament.mjs. Every sport and category has the group sizes from
-- the planning sheet, a round robin in every group and a knockout behind it.
-- Teams are fictional; courts and timings are plausible, not booked.
--
--   Football              6 groups of 4                24 teams
--   Badminton MD          6 groups of 4                24
--   Badminton XD          5 groups of 4                20
--   Badminton MS          4 groups of 4                16
--   Badminton WD          2 groups of 5                10
--   Netball               4 groups of 4                16
--   Frisbee               4 groups (4, 4, 3, 3)        14
--   Volleyball            4 groups (4, 3, 3, 3)        13
--   Basketball            4 groups of 3                12
--   Pickleball MD, XD     2 groups of 4 each            8 + 8
--   Table tennis          1 round robin of 6            6
--
-- ${fixtureRows.length} games in all.

-- The pre-event reset no longer patches particular games of the old mock
-- data: it puts any data back to before kick-off.
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
      delay_minutes = 0, delay_notified_minutes = 0
  where id is not null;

  -- A slot with a label is decided by an earlier game: until then, no team.
  update fixtures set team_a_id = null where placeholder_a is not null and team_a_id is not null;
  update fixtures set team_b_id = null where placeholder_b is not null and team_b_id is not null;

  -- Updates narrate a day in progress; keep only what is posted before doors.
  delete from announcements where id is not null;
  insert into announcements (type, title, body, published_at) values
    ('notice', 'Welcome to MGames 2026!',
     'Doors open at 08:30. Collect your wristband at reception — it gets you into every venue all day.',
     '${DAY} 08:00${OFFSET}');
end;
$$;

revoke all on function reset_demo_day_to_pre_event() from public;
revoke all on function reset_demo_day_to_pre_event() from anon, authenticated;
grant execute on function reset_demo_day_to_pre_event() to service_role;

-- Out with the old mock: categories take their groups, teams and games with them.
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
