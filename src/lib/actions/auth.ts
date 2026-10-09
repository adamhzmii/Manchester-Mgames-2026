"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error: string | null;
};

/**
 * Coordinator sign-in.
 *
 * One shared credential for the whole committee, by design (see the spec):
 * the team is small and trusted, and per-person accounts would be admin
 * overhead nobody has time for on the day. The tradeoff is real and worth
 * restating — there is no audit trail of who changed a score, and if the
 * password reaches a group chat, anyone in it can write.
 */
export async function signIn(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter the coordinator email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase's own message is deliberately vague about which half was wrong;
    // pass it through rather than inventing a more specific one.
    return { error: error.message };
  }

  // Every page that renders edit affordances reads the session server-side.
  revalidatePath("/", "layout");
  // Straight to the court sheet: on the day that is the coordinator's screen.
  redirect("/coordinate");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
