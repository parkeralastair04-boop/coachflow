import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { absoluteSitePath } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

export const PARENT_CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ParentClaimStatus =
  | "valid_new"
  | "valid_existing"
  | "expired"
  | "used"
  | "revoked"
  | "invalid";

export type ParentClaimLookup = {
  status: ParentClaimStatus;
  email: string | null;
  childName: string | null;
  academyName: string | null;
  expiresAt: string | null;
  claimId: string | null;
};

export type ParentPortalInvite = {
  kind: "claim" | "sign_in";
  email: string;
  url: string;
  claimToken?: string;
  claimId?: string;
};

function hashClaimToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function generateClaimToken(): string {
  return randomBytes(32).toString("base64url");
}

const LIST_USERS_PER_PAGE = 200;
/** Bound scan so claim lookups stay predictable without getUserByEmail. */
const LIST_USERS_MAX_PAGES = 10;

export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  for (let page = 1; page <= LIST_USERS_MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PER_PAGE,
    });
    if (error) {
      console.warn("[parent-claim] listUsers", error.message);
      return null;
    }

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalized,
    );
    if (match?.id) return match.id;

    if (data.users.length < LIST_USERS_PER_PAGE) break;
  }

  return null;
}

/**
 * Prefer getUserByEmail when available on the Admin API.
 * Falls back to a bounded listUsers scan.
 */
export async function resolveAuthUserByEmail(email: string): Promise<{
  id: string;
  email: string;
} | null> {
  const admin = createAdminClient();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const adminAuth = admin.auth.admin as typeof admin.auth.admin & {
    getUserByEmail?: (
      email: string,
    ) => Promise<{ data: { user: { id: string; email?: string } | null }; error: Error | null }>;
  };

  if (typeof adminAuth.getUserByEmail === "function") {
    const { data, error } = await adminAuth.getUserByEmail(normalized);
    if (!error && data.user?.id) {
      return {
        id: data.user.id,
        email: data.user.email?.trim().toLowerCase() ?? normalized,
      };
    }
  }

  const id = await findAuthUserIdByEmail(normalized);
  return id ? { id, email: normalized } : null;
}

export async function createParentAccountClaim(args: {
  email: string;
  playerId?: string | null;
  bookingId?: string | null;
  enrolmentId?: string | null;
  childName?: string | null;
  academyName?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ token: string; claimId: string; expiresAt: string; url: string }> {
  const admin = createAdminClient();
  const email = args.email.trim().toLowerCase();
  const token = generateClaimToken();
  const tokenHash = hashClaimToken(token);
  const expiresAt = new Date(Date.now() + PARENT_CLAIM_TTL_MS).toISOString();

  // Revoke outstanding unused claims for this email (single active invite).
  await admin
    .from("parent_account_claims")
    .update({ revoked_at: new Date().toISOString() })
    .eq("email", email)
    .is("used_at", null)
    .is("revoked_at", null);

  const { data, error } = await admin
    .from("parent_account_claims")
    .insert({
      email,
      token_hash: tokenHash,
      expires_at: expiresAt,
      player_id: args.playerId ?? null,
      booking_id: args.bookingId ?? null,
      enrolment_id: args.enrolmentId ?? null,
      child_name: args.childName ?? null,
      academy_name: args.academyName ?? null,
      metadata: args.metadata ?? {},
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Unable to create account invite.");
  }

  const url = absoluteSitePath(`/family/claim?token=${encodeURIComponent(token)}`);
  return { token, claimId: data.id as string, expiresAt, url };
}

export async function lookupParentAccountClaim(
  rawToken: string,
): Promise<ParentClaimLookup> {
  const token = rawToken.trim();
  if (!token) {
    return {
      status: "invalid",
      email: null,
      childName: null,
      academyName: null,
      expiresAt: null,
      claimId: null,
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("parent_account_claims")
    .select(
      "id, email, expires_at, used_at, revoked_at, child_name, academy_name",
    )
    .eq("token_hash", hashClaimToken(token))
    .maybeSingle();

  if (error || !data) {
    return {
      status: "invalid",
      email: null,
      childName: null,
      academyName: null,
      expiresAt: null,
      claimId: null,
    };
  }

  const base = {
    email: (data.email as string) ?? null,
    childName: (data.child_name as string | null) ?? null,
    academyName: (data.academy_name as string | null) ?? null,
    expiresAt: (data.expires_at as string) ?? null,
    claimId: data.id as string,
  };

  if (data.revoked_at) return { status: "revoked", ...base };
  if (data.used_at) return { status: "used", ...base };
  if (new Date(data.expires_at as string).getTime() <= Date.now()) {
    return { status: "expired", ...base };
  }

  const existing = await resolveAuthUserByEmail(data.email as string);
  return {
    status: existing ? "valid_existing" : "valid_new",
    ...base,
  };
}

/**
 * Atomically consume a claim token. Replay-safe: second call fails.
 */
export async function consumeParentAccountClaim(args: {
  rawToken: string;
  userId: string;
}): Promise<{ ok: true; email: string } | { ok: false; reason: string }> {
  const admin = createAdminClient();
  const tokenHash = hashClaimToken(args.rawToken.trim());
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("parent_account_claims")
    .update({
      used_at: now,
      used_by_user_id: args.userId,
    })
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .select("email")
    .maybeSingle();

  if (error) {
    return { ok: false, reason: error.message };
  }
  if (!data?.email) {
    return { ok: false, reason: "This invite is invalid, expired, or already used." };
  }

  return { ok: true, email: (data.email as string).trim().toLowerCase() };
}

/**
 * After a booking, give parents a continuous next step — claim or sign in.
 */
export async function prepareParentPortalInvite(args: {
  email: string;
  playerId?: string | null;
  bookingId?: string | null;
  enrolmentId?: string | null;
  childName?: string | null;
  academyName?: string | null;
}): Promise<ParentPortalInvite> {
  const email = args.email.trim().toLowerCase();
  const existing = await resolveAuthUserByEmail(email);

  if (existing) {
    return {
      kind: "sign_in",
      email,
      url: absoluteSitePath("/login?next=/family"),
    };
  }

  const claim = await createParentAccountClaim(args);
  return {
    kind: "claim",
    email,
    url: claim.url,
    claimToken: claim.token,
    claimId: claim.claimId,
  };
}

export async function reissueParentAccountClaim(args: {
  email: string;
}): Promise<ParentPortalInvite> {
  const email = args.email.trim().toLowerCase();
  const admin = createAdminClient();

  const { data: players } = await admin
    .from("players")
    .select("id, player_name")
    .ilike("parent_email", email)
    .limit(1);

  const player = players?.[0];
  if (!player) {
    throw new Error(
      "We could not find a child linked to this email. Ask your coach to check the parent email on the player profile.",
    );
  }

  return prepareParentPortalInvite({
    email,
    playerId: player.id as string,
    childName: (player.player_name as string) ?? null,
  });
}
