type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

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
  const list = tables.map((table) => `\`${table}\``).join(", ");
  return {
    title: "Database setup required",
    description: `Run the Supabase migrations for ${list} in the Supabase SQL editor or with the Supabase CLI, then refresh this page.`,
  };
}

export function resolveQueryError(
  error: SupabaseLikeError | null | undefined,
  fallbackTable: string,
): { setupRequired: boolean; table: string; message: string } | { setupRequired: false; message: string } {
  if (!error) {
    return { setupRequired: false, message: "An unexpected error occurred." };
  }

  if (isMissingTableError(error) || isMissingColumnError(error)) {
    return {
      setupRequired: true,
      table: getMissingTableName(error) ?? fallbackTable,
      message: getSetupRequiredMessage([getMissingTableName(error) ?? fallbackTable]).description,
    };
  }

  return { setupRequired: false, message: error.message ?? "An unexpected error occurred." };
}
