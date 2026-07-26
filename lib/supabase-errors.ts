type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

import { getSetupUnavailableMessage, sanitizeDashboardSaveError } from "@/lib/user-facing-errors";

export function isMissingTableError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "PGRST205") return true;
  const message = error.message ?? "";
  return /could not find the table/i.test(message) || /relation .* does not exist/i.test(message);
}

export function isMissingColumnError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  return /column .* does not exist/i.test(error.message ?? "");
}

export function getMissingTableName(error: SupabaseLikeError | null | undefined): string | null {
  if (!error?.message) return null;
  const quoted = error.message.match(/'public\.([^']+)'/);
  if (quoted?.[1]) return quoted[1];
  const bare = error.message.match(/table '([^']+)'/i);
  if (bare?.[1]) return bare[1];
  return null;
}

export function getSetupRequiredMessage(tables: string[]): {
  title: string;
  description: string;
} {
  void tables;
  return getSetupUnavailableMessage();
}

export function resolveQueryError(
  error: SupabaseLikeError | null | undefined,
  fallbackTable: string,
): { setupRequired: boolean; table: string; message: string } | { setupRequired: false; message: string } {
  if (!error) {
    return { setupRequired: false, message: sanitizeDashboardSaveError(null) };
  }

  if (isMissingTableError(error) || isMissingColumnError(error)) {
    const setup = getSetupUnavailableMessage();
    return {
      setupRequired: true,
      table: getMissingTableName(error) ?? fallbackTable,
      message: setup.description,
    };
  }

  return {
    setupRequired: false,
    message: sanitizeDashboardSaveError(error, { logLabel: "supabase-query" }),
  };
}
