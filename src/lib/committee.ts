/**
 * The people running Manchester MGames 2026, for the committee page.
 * Two to a role, as the committee is organised.
 */

/**
 * A group photo for the top of the page, once there is one: a path under
 * /public (e.g. "/brand/committee.jpg"). Null keeps the space hidden.
 */
export const GROUP_PHOTO: string | null = null;

export const DIRECTORS = ["Adam Hazmi", "Shing Hui"];

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
  { role: "Vendors", names: ["Hannah", "Rafiq"] },
  { role: "First aid", names: ["Yuan", "Rafiq"] },
  { role: "Volunteers", names: ["Avienash", "Ashley"] },
  { role: "Referees", names: ["Max", "Aaron"] },
];

export const SOCIETY_INSTAGRAM = ["mssmsports", "instamssm"];

export const WEBSITE_BY = "Adam Hazmi";
