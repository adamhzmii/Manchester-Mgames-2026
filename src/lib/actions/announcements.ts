"use server";

import { revalidatePath } from "next/cache";

import { sendPush } from "@/lib/push/server";
import { getCoordinator } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { AnnouncementType } from "@/lib/supabase/types";

export type AnnouncementState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

const TYPES: readonly AnnouncementType[] = ["delay", "schedule", "notice", "result"];

/**
 * Posts a committee announcement and pushes it to every subscriber.
 *
 * Announcements go to everyone, not just followers of a team: a room change or
 * a delay is exactly the thing somebody standing in the wrong hall needs, and
 * they are rare enough that untargeted delivery is not a nuisance.
 */
export async function postAnnouncement(
  _prevState: AnnouncementState,
  formData: FormData,
): Promise<AnnouncementState> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "notice");

  if (!title) return { status: "error", message: "Give the announcement a title." };
  if (!TYPES.includes(typeRaw as AnnouncementType)) {
    return { status: "error", message: "Pick a type." };
  }

  // Checked here as well as by RLS, because this action does one thing the
  // database cannot see: it pushes a notification to every subscribed phone.
  // The policy stops the row being written; this stops anyone who is not a
  // coordinator getting as far as trying.
  if (!(await getCoordinator())) {
    return { status: "error", message: "Only signed-in coordinators can post updates." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({ title, body: body || null, type: typeRaw as AnnouncementType })
    .select("id");

  if (error) return { status: "error", message: `Could not post: ${error.message}` };
  if (!data || data.length === 0) {
    return {
      status: "error",
      message: "Not posted. Your coordinator session may have expired — sign in again.",
    };
  }

  revalidatePath("/");
  revalidatePath("/updates");

  // Best effort: the announcement is already saved, and an unreachable push
  // service must not be reported back as a failed post.
  try {
    await sendPush({
      title: "MGames update",
      body: title,
      url: "/updates",
      tag: `announcement-${data[0].id}`,
    });
  } catch {
    // Intentionally swallowed — see above.
  }

  return { status: "success", message: "Posted." };
}
