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
 * The MGames 2026 rulebook: general and sport-by-sport rules, a Google Doc
 * shared so anyone with the link can read it.
 */
export const RULEBOOK_URL =
  "https://docs.google.com/document/d/1Eztxsx97Si7VtIR6AH_v59nh5FIWOScoEtjllYqF9uQ/edit?usp=sharing";

/**
 * The participant info pack. Until its own version is ready, the handbook
 * PDF on Google Drive.
 */
export const INFO_PACK_URL =
  "https://drive.google.com/file/d/1KNs4fotwofsR3zFLBL9r1TgQZ4-kE2Q1/view?usp=sharing";

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
 * The head of first aid, called from the Info page. There is a first aider
 * at every venue; the head of first aid knows where each one is and sends
 * the nearest. Called by role, not name: whoever holds the phone on the day.
 * In place of a "Call 999" button: a one-tap 999 on a page every visitor
 * opens invites prank calls.
 */
export const FIRST_AID = {
  role: "Head of First Aid",
  tel: "+447785442051",
  display: "+44 7785 442051",
};

export type VenueFacilities = {
  firstAid: string;
  toilets?: string;
};

/** Every venue has a first aider; the head of first aid sends them. */
const FIRST_AIDER = `A first aider is on site. Call the Head of First Aid: ${FIRST_AID.display}`;

/** Keyed by venue slug, so the Venues page can show the building you are in. */
export const VENUE_FACILITIES: Record<string, VenueFacilities> = {
  trinity: {
    firstAid: FIRST_AIDER,
    toilets: "Signposted throughout · accessible WC at reception",
  },
  sugden: {
    firstAid: FIRST_AIDER,
    toilets: "Signposted throughout · accessible WC at reception",
  },
  "denmark-road": {
    firstAid: FIRST_AIDER,
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

/** No venue has its own; these are the three nearby, as the committee timed them. */
export const PRAYER_ROOMS: PrayerRoom[] = [
  {
    name: "Students' Union Faith Space",
    where: "University of Manchester Students' Union, Faith Space Room, 2nd floor",
    address: "University of Manchester Students' Union, Oxford Road, Manchester M13 9PR",
    notes: ["No student ID required"],
    walk: { trinity: 11, sugden: 12 },
  },
  {
    name: "Manchester Museum Prayer Room",
    where: "Manchester Museum, Prayer Room, Level 1",
    address: "Manchester Museum, Oxford Road, Manchester M13 9PL",
    notes: ["Prayer mats and an ablution room"],
    walk: { trinity: 7, sugden: 10 },
  },
  {
    name: "McDougall Prayer Hall",
    where: "McDougall Centre, Prayer Hall",
    address: "McDougall Centre, Burlington Street, Manchester M15 6HQ",
    notes: ["Student ID required", "Prayer mats and an ablution room"],
    walk: { trinity: 3, sugden: 17 },
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
  note: "Keep your wristband on all day, between games too.",
};

export const GETTING_THERE = [
  "Manchester Piccadilly station is a 12-minute walk from Sugden.",
  "Football is at Denmark Road, a short walk from Manchester Oxford Road station.",
];

export const FAQ = [
  {
    question: "When should I arrive?",
    answer:
      "MGames runs 8am to 8pm. Check in at your sport's venue at least 20 minutes before your first game: your ID is checked and you get your wristband — purple for Malaysian players, yellow for non-Malaysian. Keep it on all day. A team that can't put out a legal line-up within 5 minutes of its start time forfeits the game.",
  },
  {
    question: "Can I move between the venues?",
    answer:
      "Yes. Trinity to Sugden is a 12-minute walk, or 6 minutes on bus 142. The football is at Denmark Road, about 8 minutes' walk from Trinity. There's no food at Denmark Road — the Food page shows where the stalls are.",
  },
  {
    question: "What if my game is delayed or moved?",
    answer:
      "The site keeps up for you. If a court falls behind, every game after it there shows its new expected time, worked out from when games really start and finish. Follow your team and turn on notifications to be told when your game slips 10 minutes or more, or moves. Bigger changes are posted under Updates too.",
  },
  {
    question: "Where are the rules?",
    answer:
      "In the MGames 2026 rulebook: the general rules and every sport's rules. It's linked at the top of the Info page, next to the info pack.",
  },
  {
    question: "Is there somewhere to pray?",
    answer:
      "Yes, three nearby. The Students' Union Faith Space (2nd floor) needs no student ID — 11 minutes from Trinity, 12 from Sugden. Manchester Museum's Prayer Room (Level 1) has prayer mats and an ablution room — 7 minutes from Trinity, 10 from Sugden. McDougall Prayer Hall is 3 minutes from Trinity (student ID required; prayer mats and an ablution room).",
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
