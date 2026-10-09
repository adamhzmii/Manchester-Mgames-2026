#!/usr/bin/env node
// Builds MGames 2026's real timetable — every game at the time and on the
// court in the committee's fixture spreadsheet ("[INTERNAL] MGAMES 26 FIXTURE
// SCHEDULE", version 2) — with mock teams until registration closes, and
// writes it as a migration.
//
//   node tools/schedule-2026.mjs > supabase/migrations/<stamp>_real_timetable.sql
//
// Team names are placeholders except where the sheet already has some
// (volleyball, frisbee). Rerun with real names when they come in. The sheet
// numbers knockout games its own way (down one pitch, then the next); the
// site numbers them by kick-off, then court, so references like "Winner 7"
// are translated here, not copied.
//
// Checks as it goes and reports to stderr: a court booked for two games at
// once, or a team in two games at once.

const DAY = "2026-10-24";
const OFFSET = "+01"; // British Summer Time on the day

// ------------------------------------------------------------- helpers ----

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toClock = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** n kick-offs from `start`, every `step` minutes. */
const every = (start, step, n) => [...Array(n).keys()].map((i) => toClock(toMin(start) + i * step));

/** Group games on one court, in the order the sheet plays them. */
const PAIRS = {
  3: [[0, 1], [2, 0], [1, 2]],
  4: [[0, 1], [2, 3], [0, 2], [1, 3], [1, 2], [0, 3]],
};

/** Round-robin rounds for n players by the circle method: each round's games run side by side. */
function rounds(n) {
  const ids = [...Array(n).keys()];
  if (n % 2 === 1) ids.push(null);
  const out = [];
  for (let r = 0; r < ids.length - 1; r += 1) {
    const games = [];
    for (let i = 0; i < ids.length / 2; i += 1) {
      const a = ids[i];
      const b = ids[ids.length - 1 - i];
      if (a !== null && b !== null) games.push([a, b]);
    }
    out.push(games);
    ids.splice(1, 0, ids.pop());
  }
  return out;
}
const ROUNDS = {
  4: [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[1, 2], [0, 3]]],
  5: rounds(5),
};

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

// Placeholder teams. Malaysian contingents by state and city, rotated so the
// groups vary between sports.
const NAMES = [
  "KL Tigers", "Selangor Smashers", "Penang Panthers", "Johor Warriors",
  "Kedah Eagles", "Perak Bison", "Melaka Mariners", "Sabah Rhinos",
  "Sarawak Hornbills", "Terengganu Turtles", "Kelantan Kijangs", "Pahang Elephants",
  "Negeri Nine", "Perlis Pythons", "Putrajaya Pumas", "Labuan Lions",
  "Ipoh Iguanas", "Kuching Cats", "Kota Kinabalu Kings", "Miri Mantas",
  "Seremban Stags", "Kuantan Kites", "Langkawi Lynx", "Shah Alam Sharks",
];

// ------------------------------------------------------------- the day ----

// `len` is how long a game holds its court, from the sheet's Structure tab
// plus buffer — used only to check for clashes.
const SPORTS = [
  {
    slug: "football",
    venue: "denmark-road",
    courts: ["Pitch A", "Pitch B", "Pitch C"],
    len: { group: 15, knockout: 20, final: 25 },
    categories: [
      {
        slug: "open",
        name: "Open",
        groups: [
          { size: 4, courts: ["Pitch A"], times: every("09:00", 15, 6) },
          { size: 4, courts: ["Pitch B"], times: every("09:00", 15, 6) },
          { size: 4, courts: ["Pitch C"], times: every("09:00", 15, 6) },
          { size: 4, courts: ["Pitch A"], times: every("10:30", 15, 6) },
          { size: 4, courts: ["Pitch B"], times: every("10:30", 15, 6) },
          { size: 4, courts: ["Pitch C"], times: every("10:30", 15, 6) },
        ],
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
    len: { group: 20, knockout: 20, final: 25 },
    categories: [
      {
        slug: "open",
        name: "Open",
        groups: [
          { size: 3, courts: ["Hall A"], times: every("08:30", 20, 3) },
          { size: 3, courts: ["Hall A"], times: every("09:30", 20, 3) },
          { size: 3, courts: ["Hall A"], times: every("10:30", 20, 3) },
          { size: 3, courts: ["Hall A"], times: every("11:30", 20, 3) },
        ],
        knockouts: [
          ko("QF", 1, "12:30", "Hall A", "Group A winner", "Group C runner-up"),
          ko("QF", 2, "12:50", "Hall A", "Group B winner", "Group D runner-up"),
          ko("QF", 3, "13:10", "Hall A", "Group C winner", "Group A runner-up"),
          ko("QF", 4, "13:30", "Hall A", "Group D winner", "Group B runner-up"),
          ko("SF", 1, "14:50", "Hall A", win("QF", 1), win("QF", 2)),
          ko("SF", 2, "15:10", "Hall A", win("QF", 3), win("QF", 4)),
          ...thirdAndFinal("15:45", "Hall A", "16:20", "Hall A"),
        ],
      },
    ],
  },
  {
    slug: "volleyball",
    venue: "sugden",
    courts: ["Hall B"],
    len: { group: 22, knockout: 22, final: 25 },
    categories: [
      {
        slug: "open",
        name: "Open",
        // The sheet's own names, with a stand-in for its "TBC".
        names: [
          ["Chinatown", "Rough Sets", "Volvolley", "bang bang"],
          ["Teh Tarik Spikers", "MSS Lboro", "Rice for Life"],
          ["Team Luther", "Maggi Goreng", "Kopi o Peng"],
          ["WBS", "Pandan Power", "Kugem"],
        ],
        groups: [
          { size: 4, courts: ["Hall B"], times: every("08:30", 22, 6) },
          { size: 3, courts: ["Hall B"], times: every("10:42", 22, 3) },
          { size: 3, courts: ["Hall B"], times: every("11:48", 22, 3) },
          { size: 3, courts: ["Hall B"], times: every("12:54", 22, 3) },
        ],
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
    len: { group: 20, knockout: 20, final: 25 },
    categories: [
      {
        slug: "open",
        name: "Open",
        groups: [
          { size: 4, courts: ["Netball Court A"], times: every("08:30", 20, 6) },
          { size: 4, courts: ["Netball Court B"], times: every("08:30", 20, 6) },
          { size: 4, courts: ["Netball Court A"], times: every("10:30", 20, 6) },
          { size: 4, courts: ["Netball Court B"], times: every("10:30", 20, 6) },
        ],
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
    len: { group: 20, knockout: 22, final: 22 },
    categories: [
      {
        slug: "open",
        name: "Open",
        names: [
          ["Mamak Ultimate", "Sotong", "B2efris", "Stallion A"],
          ["Brahaha", "Mamak Ultimate 2", "Stallion B", "Bounce"],
          ["Bounce 2", "Mamak Ultimate 3", "Brohoho"],
          ["Mamak Ultimate 4", "Beefr1s", "Brakaka"],
        ],
        groups: [
          { size: 4, courts: ["Sport Hall"], times: ["08:30", "08:52", "09:16", "09:39", "10:03", "10:26"] },
          { size: 4, courts: ["Sport Hall"], times: ["10:47", "11:06", "11:28", "11:46", "12:08", "12:25"] },
          { size: 3, courts: ["Sport Hall"], times: ["12:47", "13:09", "13:31"] },
          { size: 3, courts: ["Sport Hall"], times: ["13:53", "14:15", "14:37"] },
        ],
        knockouts: [
          ko("QF", 1, "15:20", "Sport Hall", "Group A winner", "Group C runner-up"),
          ko("QF", 2, "15:42", "Sport Hall", "Group B winner", "Group D runner-up"),
          ko("QF", 3, "16:04", "Sport Hall", "Group C winner", "Group A runner-up"),
          ko("QF", 4, "16:26", "Sport Hall", "Group D winner", "Group B runner-up"),
          ko("SF", 1, "16:53", "Sport Hall", win("QF", 1), win("QF", 2)),
          ko("SF", 2, "17:15", "Sport Hall", win("QF", 3), win("QF", 4)),
          ...thirdAndFinal("17:40", "Sport Hall", "18:00", "Sport Hall"),
        ],
      },
    ],
  },
  {
    slug: "badminton",
    venue: "sugden",
    courts: ["Hall C1", "Hall C2", "Hall C3", "Hall C4", "Hall D1", "Hall D2", "Hall D3", "Hall D4"],
    len: { group: 15, knockout: 15, final: 20 },
    categories: [
      {
        slug: "ms",
        name: "Men's Singles",
        groups: ["Hall C1", "Hall C2", "Hall C3", "Hall C4"].map((court) => ({
          size: 4,
          courts: [court],
          times: every("08:30", 15, 6),
        })),
        knockouts: [
          ko("QF", 1, "10:05", "Hall C1", "Group A winner", "Group C runner-up"),
          ko("QF", 2, "10:05", "Hall C2", "Group B winner", "Group D runner-up"),
          ko("QF", 3, "10:05", "Hall C3", "Group C winner", "Group A runner-up"),
          ko("QF", 4, "10:05", "Hall C4", "Group D winner", "Group B runner-up"),
          ko("SF", 1, "11:55", "Hall D1", win("QF", 1), win("QF", 2)),
          ko("SF", 2, "11:55", "Hall D2", win("QF", 3), win("QF", 4)),
          ...thirdAndFinal("12:20", "Hall D1", "12:20", "Hall D2"),
        ],
      },
      {
        slug: "wd",
        name: "Women's Doubles",
        groups: [
          { size: 5, courts: ["Hall D1", "Hall D2"], times: every("08:30", 15, 5) },
          { size: 5, courts: ["Hall D3", "Hall D4"], times: every("08:30", 15, 5) },
        ],
        knockouts: [
          ko("SF", 1, "09:50", "Hall D1", "Group A winner", "Group B runner-up"),
          ko("SF", 2, "09:50", "Hall D2", "Group B winner", "Group A runner-up"),
          ...thirdAndFinal("10:15", "Hall D1", "10:15", "Hall D2"),
        ],
      },
      {
        slug: "md",
        name: "Men's Doubles",
        groups: [
          ...["Hall C1", "Hall C2", "Hall C3", "Hall C4"].map((court) => ({
            size: 4,
            courts: [court],
            times: ["10:50", "11:05", "11:25", "11:40", "11:55", "12:10"],
          })),
          ...["Hall D3", "Hall D4"].map((court) => ({
            size: 4,
            courts: [court],
            times: ["11:20", "11:35", "11:55", "12:10", "12:25", "12:40"],
          })),
        ],
        knockouts: [
          ko("R16", 1, "14:00", "Hall C1", "Group A winner", "Best 3rd (3)"),
          ko("R16", 2, "14:00", "Hall C2", "Group B winner", "Best 3rd (1)"),
          ko("R16", 3, "14:00", "Hall C3", "Group C winner", "Group D runner-up"),
          ko("R16", 4, "14:00", "Hall C4", "Group D winner", "Best 3rd (2)"),
          ko("R16", 5, "14:15", "Hall C1", "Group A runner-up", "Group C runner-up"),
          ko("R16", 6, "14:15", "Hall C2", "Group B runner-up", "Best 3rd (4)"),
          ko("R16", 7, "14:15", "Hall C3", "Group E winner", "Group F runner-up"),
          ko("R16", 8, "14:15", "Hall C4", "Group F winner", "Group E runner-up"),
          ko("QF", 1, "14:30", "Hall C1", win("R16", 1), win("R16", 5)),
          ko("QF", 2, "14:30", "Hall C2", win("R16", 2), win("R16", 6)),
          ko("QF", 3, "14:30", "Hall C3", win("R16", 3), win("R16", 7)),
          ko("QF", 4, "14:30", "Hall C4", win("R16", 4), win("R16", 8)),
          ko("SF", 1, "14:50", "Hall C1", win("QF", 1), win("QF", 2)),
          ko("SF", 2, "14:50", "Hall C2", win("QF", 3), win("QF", 4)),
          ...thirdAndFinal("15:15", "Hall C1", "15:15", "Hall C2"),
        ],
      },
      {
        slug: "xd",
        name: "Mixed Doubles",
        groups: ["Hall C1", "Hall C2", "Hall C3", "Hall C4", "Hall D3"].map((court) => ({
          size: 4,
          courts: [court],
          times: every("11:55", 15, 6),
        })),
        knockouts: [
          ko("QF", 1, "13:30", "Hall C1", "Group A winner", "Group E winner"),
          ko("QF", 2, "13:30", "Hall C2", "Group B winner", "Best 2nd (1)"),
          ko("QF", 3, "13:30", "Hall C3", "Group C winner", "Best 2nd (2)"),
          ko("QF", 4, "13:30", "Hall C4", "Group D winner", "Best 2nd (3)"),
          ko("SF", 1, "15:20", "Hall C1", win("QF", 1), win("QF", 2)),
          ko("SF", 2, "15:20", "Hall C2", win("QF", 3), win("QF", 4)),
          ...thirdAndFinal("15:45", "Hall C1", "15:45", "Hall C2"),
        ],
      },
    ],
  },
  {
    slug: "pickleball",
    venue: "sugden",
    // Hall D, once badminton is out of it.
    courts: ["Hall D1", "Hall D2", "Hall D3", "Hall D4"],
    len: { group: 25, knockout: 40, final: 40 },
    categories: [
      { slug: "md", name: "Men's Doubles", pair: ["Hall D1", "Hall D2"] },
      { slug: "xd", name: "Mixed Doubles", pair: ["Hall D3", "Hall D4"] },
    ].map(({ slug, name, pair }) => ({
      slug,
      name,
      groups: [
        { size: 4, courts: pair, times: ["14:00", "14:25", "14:50"] },
        { size: 4, courts: pair, times: ["15:15", "15:40", "16:05"] },
      ],
      knockouts: [
        ko("SF", 1, "16:35", pair[0], "Group A winner", "Group B runner-up"),
        ko("SF", 2, "16:35", pair[1], "Group B winner", "Group A runner-up"),
        ...thirdAndFinal("17:20", pair[0], "17:20", pair[1]),
      ],
    })),
  },
  {
    slug: "table-tennis",
    venue: "trinity",
    courts: ["Temple Gym 1", "Temple Gym 2"],
    len: { group: 15, knockout: 30, final: 30 },
    categories: [
      {
        slug: "open",
        name: "Open",
        // Demand not known yet: five players, a full round robin across the
        // two tables in the sheet's first five slots.
        groups: [{ size: 5, courts: ["Temple Gym 1", "Temple Gym 2"], times: every("14:00", 15, 5) }],
        knockouts: [
          ko("SF", 1, "16:00", "Temple Gym 1", "Group A 1st", "Group A 3rd"),
          ko("SF", 2, "16:00", "Temple Gym 2", "Group A 2nd", "Group A 4th"),
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
let nameOffset = 0;

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

    cat.groups.forEach((group, g) => {
      const groupName = `Group ${LETTERS[g]}`;
      groupRows.push([sport.slug, cat.slug, groupName, g + 1]);
      const members =
        cat.names?.[g] ??
        [...Array(group.size).keys()].map(() => NAMES[nameOffset++ % NAMES.length]);
      if (members.length !== group.size) throw new Error(`${tag} ${groupName}: ${members.length} names for ${group.size}`);
      members.forEach((name) => teamRows.push([sport.slug, cat.slug, groupName, name]));

      // One court: the sheet's order of games. Two courts: rounds, side by side.
      const games =
        group.courts.length === 1
          ? PAIRS[group.size].map((pair, i) => ({ pair, court: group.courts[0], time: group.times[i] }))
          : ROUNDS[group.size].flatMap((round, r) =>
              round.map((pair, i) => ({ pair, court: group.courts[i], time: group.times[r] })),
            );
      const expected = (group.size * (group.size - 1)) / 2;
      if (games.length !== expected || games.some((x) => !x.time)) {
        throw new Error(`${tag} ${groupName}: ${games.length} games placed, ${expected} needed`);
      }
      for (const { pair, court, time } of games) {
        const [a, b] = pair.map((i) => members[i]);
        fixtureRows.push([sport.slug, cat.slug, groupName, "group", a, b, null, null, sport.venue, court, `${DAY} ${time}${OFFSET}`]);
        bookings.push([sport, court, toMin(time), toMin(time) + sport.len.group, `${tag} ${groupName}`, [`${tag}:${a}`, `${tag}:${b}`]]);
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
      const len = stage === "final" || stage === "third_place" ? sport.len.final : sport.len.knockout;
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

const sql = `-- MGames 2026's real timetable, generated by tools/schedule-2026.mjs from the
-- committee's fixture spreadsheet (version 2): every game at its time and on
-- its court, every knockout slot wired to the game that feeds it. Teams are
-- placeholders until registration closes, except volleyball's and frisbee's,
-- which the sheet names.
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
if (problems.length > 0) {
  console.error(`\n${problems.length} clash(es):`);
  for (const p of problems) console.error(`  ${p}`);
}
