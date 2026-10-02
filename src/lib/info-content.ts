/**
 * Static content the committee writes once before the event.
 *
 * Hardcoded on purpose: it does not change during the day, so a table and an
 * editor would be machinery with nothing to do. If it ever needs day-of edits,
 * it moves to Supabase the way announcements did.
 *
 * COMMITTEE — before the event, fill in the two event phone numbers below.
 */

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
  { label: "First aid lead", tel: null, note: "Qualified first aider on site" },
];

export type VenueFacilities = {
  firstAid: string;
  prayer: string;
  toilets: string;
};

/** Keyed by venue slug, so the Venues page can show the building you are in. */
export const VENUE_FACILITIES: Record<string, VenueFacilities> = {
  trinity: {
    firstAid: "Main Hall entrance",
    prayer: "Studio 2, first floor",
    toilets: "Signposted throughout · accessible WC at reception",
  },
  sugden: {
    firstAid: "Ground-floor reception",
    prayer: "Room 1B · wudhu facilities nearby",
    toilets: "Signposted throughout · accessible WC at reception",
  },
};

export const TRAVEL = {
  walk: { minutes: 12, distance: "0.6 mi" },
  bus: { route: "142", minutes: 6, every: "every 10 min" },
  note: "Your wristband gets you into both venues all day. Stewards in gold hi-vis are at each reception.",
};

export const GETTING_THERE = [
  "Manchester Piccadilly station is a 12-minute walk from Sugden.",
  "Parking nearby is limited — use the NCP car parks.",
];

export const FAQ = [
  {
    question: "Can I move between the two venues?",
    answer:
      "Yes. Your wristband gets you into Trinity and Sugden all day. It's a 12-minute walk, or 6 minutes on bus 142.",
  },
  {
    question: "What if my game is delayed or moved?",
    answer:
      "Every timing or court change is posted under Updates the moment it is decided, and appears at the top of whatever page you have open. Turn on notifications to get it on your lock screen.",
  },
  {
    question: "How do I keep track of my own team?",
    answer:
      "Tap Find your team on the home page and pick it. From then on the home page leads with your next game — time, court and opponent — and your team's games are starred everywhere.",
  },
  {
    question: "Will my phone tell me when we're on?",
    answer:
      "Yes, if you follow your team and tap Notify me. You'll get a notification when your game starts and when the result is in. On an iPhone, add the site to your home screen first — that's when Apple allows notifications.",
  },
  {
    question: "How fresh are the scores?",
    answer:
      "Scores reach your phone within about 20 seconds of a coordinator entering them, without refreshing. If your signal drops, the page says so and shows when it last updated.",
  },
] as const;
