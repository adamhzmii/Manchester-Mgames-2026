/**
 * Static content the committee writes once before the event.
 *
 * Hardcoded on purpose: it does not change during the day, so a table and an
 * editor would be machinery with nothing to do. If it ever needs day-of edits,
 * it moves to Supabase the way announcements did.
 *
 * COMMITTEE — fill in the event control number below if there is one.
 */

/**
 * The MGames handbook: the info pack and the rulebook in one PDF, on Google
 * Drive, shared so anyone with the link can open it.
 */
export const HANDBOOK_URL =
  "https://drive.google.com/file/d/1eOWKeF-mftx91Q_Gtv2siHqC00NjKqVv/view?usp=sharing";

export type Contact = {
  label: string;
  /** Null hides the contact. A number that rings nobody is worse than none. */
  tel: string | null;
  note: string;
};

/**
 * The first version shipped 07700 900123 and 07700 900456 here: Ofcom's
 * reserved range for TV and film, so they ring no one. Left empty until the
 * committee supplies real ones, and the Info page shows only what is set.
 */
export const EVENT_CONTACTS: Contact[] = [
  { label: "Event control", tel: null, note: "Committee duty phone, all day" },
];

/**
 * The head of first aid, called straight from the top of the Info page. In
 * place of a "Call 999" button there: a one-tap 999 on a page every visitor
 * opens invites prank calls. Yuan runs first aid on the day, the first-aid
 * teams included, and gets the right person to you.
 */
export const FIRST_AID = {
  name: "Yuan",
  role: "Head of First Aid",
  tel: "+447785442051",
  display: "+44 7785 442051",
  note: "Runs first aid on the day, and sends the nearest first aider to you.",
};

export type VenueFacilities = {
  firstAid: string;
  toilets: string;
};

/** Keyed by venue slug, so the Venues page can show the building you are in. */
export const VENUE_FACILITIES: Record<string, VenueFacilities> = {
  trinity: {
    firstAid: "Main Hall entrance",
    toilets: "Signposted throughout · accessible WC at reception",
  },
  sugden: {
    firstAid: "Ground-floor reception",
    toilets: "Signposted throughout · accessible WC at reception",
  },
};

export type PrayerRoom = {
  name: string;
  where: string;
  /** For a walking route: an address Google Maps can find. */
  address: string;
  notes: string[];
  /** Walking minutes from each venue, as the committee timed them. */
  walk: Partial<Record<string, number>>;
};

/** Neither venue has its own; these are the two closest. */
export const PRAYER_ROOMS: PrayerRoom[] = [
  {
    name: "McDougall Prayer Hall",
    where: "McDougall Centre, Burlington Street",
    address: "McDougall Centre, Burlington Street, Manchester M15 6HQ",
    notes: ["Student ID required", "Prayer mats and an ablution room"],
    walk: { trinity: 3, sugden: 17 },
  },
  {
    name: "Students' Union Faith Space",
    where: "University of Manchester Students' Union, Faith Space Room, 2nd floor",
    address: "University of Manchester Students' Union, Oxford Road, Manchester M13 9PR",
    notes: ["No student ID required"],
    walk: { trinity: 11, sugden: 12 },
  },
];

/** Prayer rooms closest first from a venue; untimed ones last, in list order. */
export function prayerRoomsFrom(venueSlug: string): PrayerRoom[] {
  return [...PRAYER_ROOMS].sort(
    (a, b) => (a.walk[venueSlug] ?? Infinity) - (b.walk[venueSlug] ?? Infinity),
  );
}

export function walkingRouteTo(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=walking`;
}

/**
 * Getting between venues. Walking times are worked out from where the venues
 * are (see walking.ts); this is what a map cannot tell you.
 */
export const TRAVEL = {
  /** Buses worth knowing, by pair of venue slugs in either order. */
  buses: [{ between: ["trinity", "sugden"], line: "Bus 142, every 10 min — 6 minutes" }],
  note: "Your wristband gets you into every venue all day. Stewards in gold hi-vis are at each reception.",
};

export const GETTING_THERE = [
  "Manchester Piccadilly station is a 12-minute walk from Sugden.",
  "Football is at Denmark Road, a short walk from Manchester Oxford Road station.",
];

export const FAQ = [
  {
    question: "Can I move between the venues?",
    answer:
      "Yes. Your wristband gets you into every venue all day. Trinity to Sugden is a 12-minute walk, or 6 minutes on bus 142. The football is at Denmark Road, about 8 minutes' walk from Trinity. There's no food at Denmark Road — the Food page shows where the stalls are.",
  },
  {
    question: "What if my game is delayed or moved?",
    answer:
      "The site keeps up for you. If a court falls behind, every game after it there shows its new expected time in orange, worked out from when games really start and finish. Follow your team and turn on notifications to be told when your game slips 10 minutes or more, or moves. Bigger changes are posted under Updates too.",
  },
  {
    question: "Where are the rules?",
    answer:
      "In the MGames handbook — the info pack and the rulebook for every sport in one PDF. It's linked at the top of the Info page.",
  },
  {
    question: "Is there somewhere to pray?",
    answer:
      "Yes, two prayer spaces nearby. McDougall Prayer Hall is 3 minutes' walk from Trinity (student ID required; prayer mats and an ablution room). The Students' Union Faith Space, 2nd floor, needs no student ID — 11 minutes from Trinity, 12 from Sugden.",
  },
  {
    question: "How do I keep track of my own team?",
    answer:
      "Tap Find your team on the home page and pick it. From then on the home page leads with your next game — time, court and opponent — and your team's games are starred everywhere.",
  },
  {
    question: "Will my phone tell me when we're on?",
    answer:
      "Yes, if you follow your team and tap Notify me. You'll get a notification if your game is running late or moves, when it starts, and when the result is in. On an iPhone, add the site to your home screen first (Share, then Add to Home Screen) — that's when Apple allows notifications.",
  },
  {
    question: "How fresh are the scores?",
    answer:
      "Scores reach your phone within about 20 seconds of a coordinator entering them, without refreshing. If your signal drops, the page says so and shows when it last updated.",
  },
] as const;
