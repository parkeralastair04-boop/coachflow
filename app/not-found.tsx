import { NotFoundView } from "@/components/not-found-view";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function NotFound() {
  let isSignedIn = false;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isSignedIn = Boolean(user);
  } catch {
    // Auth unavailable — show public recovery options only.
  }

  return <NotFoundView isSignedIn={isSignedIn} />;
}
