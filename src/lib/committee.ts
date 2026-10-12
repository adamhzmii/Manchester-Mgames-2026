/**
 * The people running Manchester MGames 2026, for the committee page.
 * Two to a role, as the committee is organised.
 */

/**
 * A group photo for the top of the page, once there is one: a path under
 * /public (e.g. "/brand/committee.jpg"). Null keeps the space hidden.
 */
export const GROUP_PHOTO: string | null = null;

/** The two directors, with a portrait each (under /public; null for initials). */
export const DIRECTORS: { name: string; photo: string | null }[] = [
  { name: "Adam Hazmi", photo: "/committee/adam-hazmi.jpg" },
  { name: "Shing Hui", photo: "/committee/shing-hui.jpg" },
];

/** Heads of each sport, keyed by the sport's slug. */
export const SPORT_HEADS: Record<string, string[]> = {
  football: ["Jonny", "Danial Imran"],
  basketball: ["Daniel Tan", "Aaron Choong"],
  netball: ["Kellie", "Aisyah Rasidi"],
  volleyball: ["Fiona", "Raden"],
  frisbee: ["Amin", "Hamizi"],
  badminton: ["Nicholas Chin", "Ryan Lau"],
  "table-tennis": ["Kishman", "Joel Lee"],
  pickleball: ["Arshad", "Akasyah"],
};

/** The heads running the day itself. */
export const OPERATIONS: { role: string; names: string[] }[] = [
  { role: "Volunteers", names: ["Avienash", "Ashley"] },
  { role: "Referees", names: ["Max", "Aaron"] },
  { role: "Vendors", names: ["Hannah", "Rafiq"] },
  { role: "First aid", names: ["Yuan", "Rafiq"] },
];

export const SOCIETY_INSTAGRAM = ["mssmsports", "instamssm"];

export const WEBSITE_BY = "Adam Hazmi";
