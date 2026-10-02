import { ClockIcon, MegaphoneIcon, SwapIcon, TrophyIcon } from "@/components/icons";
import type { AnnouncementType } from "@/lib/supabase/types";

/**
 * One glyph per kind of committee update, so a delay reads as a delay before
 * anyone reads the words.
 */
export function UpdateTypeIcon({ type, size = 16 }: { type: AnnouncementType; size?: number }) {
  switch (type) {
    case "delay":
      return <ClockIcon size={size} />;
    case "schedule":
      return <SwapIcon size={size} />;
    case "result":
      return <TrophyIcon size={size} />;
    default:
      return <MegaphoneIcon size={size} />;
  }
}

export const UPDATE_TYPE_LABEL: Record<AnnouncementType, string> = {
  delay: "Delay",
  schedule: "Change",
  notice: "Notice",
  result: "Result",
};
