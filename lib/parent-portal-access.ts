import { NextResponse } from "next/server";
import { cache } from "react";
import { getAuthenticatedUser } from "@/lib/auth/server";

export type ParentPortalAccessContext =
  | {
      ok: true;
      parentEmail: string;
      parentDisplayName: string | null;
      userId: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function getParentDisplayName(
  userMetadata: Record<string, unknown> | undefined,
  fallbackEmail: string,
): string | null {
  const fullName = userMetadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  const name = userMetadata?.name;
  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }

  const localPart = fallbackEmail.split("@")[0]?.trim();
  if (!localPart) return null;

  const firstSegment = localPart.split(/[._-]/)[0];
  if (!firstSegment) return null;
  return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
}

/** Request-scoped parent portal auth — reuses getAuthenticatedUser(). */
export const requireParentPortalAccess = cache(
  async (): Promise<ParentPortalAccessContext> => {
    const user = await getAuthenticatedUser();

    if (!user?.email?.trim()) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "You must be signed in to view your family dashboard." },
          { status: 401 },
        ),
      };
    }

    if (!user.email_confirmed_at) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error:
              "Confirm your email before opening the family portal. Check your inbox for the verification link.",
            code: "email_unconfirmed",
          },
          { status: 403 },
        ),
      };
    }

    const parentEmail = user.email.trim().toLowerCase();

    return {
      ok: true,
      parentEmail,
      parentDisplayName: getParentDisplayName(user.user_metadata, parentEmail),
      userId: user.id,
    };
  },
);
