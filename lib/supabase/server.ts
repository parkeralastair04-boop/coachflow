import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

/**
 * Request-scoped Supabase server client (React.cache).
 * Avoids recreating clients when layouts/helpers call this multiple times.
 */
export const createServerSupabaseClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* Server Components cannot always set cookies — proxy refreshes session */
        }
      },
    },
  });
});
