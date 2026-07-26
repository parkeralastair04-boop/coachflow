import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/supabase";
import { getServiceRoleKey } from "@/lib/env/server";

let adminClient: SupabaseClient | null = null;

/** Server-only Supabase client that bypasses RLS. Never import from client code. */
export function createAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() cannot run in the browser.");
  }

  if (!supabaseUrl?.trim()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!adminClient) {
    adminClient = createClient(supabaseUrl, getServiceRoleKey(), {
      global: {
        headers: {
          "X-Client-Info": "awarix-admin",
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClient;
}

/** Reset the singleton between test cases. */
export function resetAdminClientForTests(): void {
  adminClient = null;
}
