"use client";

import { createClient } from "@/lib/supabase";

export async function signOutAndRedirect(redirectTo = "/"): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = redirectTo;
}
