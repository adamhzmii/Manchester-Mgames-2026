/**
 * Static /info content.
 *
 * Hardcoded on purpose for v1 (the spec allows either): this text is written
 * once before the event and does not change during the day, so a table plus an
 * editor would be machinery with nothing to do. If it ever needs day-of edits,
 * it moves to Supabase the same way announcements did.
 */

export const EMERGENCY_CONTACTS = [
  { label: "Event Control", tel: "07700900123", display: "Call" },
  { label: "First Aid Lead", tel: "07700900456", display: "Call" },
  { label: "Emergency services", tel: "999", display: "999", urgent: true },
] as const;

export const FACILITIES = [
  {
    title: "First Aid",
    tone: "red",
    lines: ["Trinity: Main Hall entrance", "Sugden: Ground-floor reception"],
  },
  {
    title: "Prayer Room",
    tone: "purple",
    lines: ["Trinity: Studio 2 (1st floor)", "Sugden: Room 1B · wudhu nearby"],
  },
  {
    title: "Toilets",
    tone: "purple",
    lines: ["Signposted at both venues", "Accessible WC at each reception"],
  },
  {
    title: "Getting There",
    tone: "gold",
    lines: ["Manchester Piccadilly 12 min walk", "Limited parking — use NCP"],
  },
] as const;

export const FAQ = [
  {
    question: "Can I move freely between the two venues?",
    answer:
      "Yes. Your wristband gives you entry to both Trinity and Sugden all day. It's a 12-minute walk or a 6-minute ride on bus 142.",
  },
  {
    question: "Where do I collect my team kit?",
    answer:
      "Team captains can collect kit from Sugden reception from 08:30. Bring your registration confirmation.",
  },
  {
    question: "Is there a bag drop?",
    answer:
      "Yes, a staffed bag drop is at each venue reception for £1 per bag. Please don't leave bags courtside.",
  },
  {
    question: "How much is spectator entry?",
    answer: "Entry is free for all spectators, all day, at both venues. Just come along and cheer!",
  },
  {
    question: "What happens if my game is delayed?",
    answer:
      "All timing changes are posted to the Announcements feed in real time. Check there first, then ask a steward in gold hi-vis.",
  },
] as const;
