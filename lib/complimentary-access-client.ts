import type { SupabaseClient } from "@supabase/supabase-js";
import { getComplimentaryAccess } from "@/lib/complimentary-access";

export async function readClientComplimentaryAccess(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return getComplimentaryAccess({
    email: user?.email,
    metadata: user?.user_metadata,
  });
}
