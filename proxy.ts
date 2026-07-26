import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeAuthNextPath } from "@/lib/auth/safe-next-path";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

/**
 * Auth gate for protected app surfaces only.
 * Matcher is intentionally narrow so public academy/marketing pages skip session work.
 * `/family/claim` stays public so booking invite links work without a session.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicFamilyClaim =
    pathname === "/family/claim" || pathname.startsWith("/family/claim/");

  if (!supabaseUrl || !supabaseAnonKey) {
    if (
      pathname.startsWith("/dashboard") ||
      (pathname.startsWith("/family") && !isPublicFamilyClaim)
    ) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Required for cookie refresh + auth gate. Only runs on matched routes.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  function withSessionCookies(next: NextResponse) {
    response.cookies.getAll().forEach((cookie) => {
      next.cookies.set(cookie.name, cookie.value);
    });
    return next;
  }

  if (pathname.startsWith("/dashboard") && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return withSessionCookies(NextResponse.redirect(loginUrl));
  }

  if (pathname.startsWith("/family") && !isPublicFamilyClaim && !user) {
    const loginUrl = new URL("/login", request.url);
    const nextPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", nextPath);
    return withSessionCookies(NextResponse.redirect(loginUrl));
  }

  if ((pathname === "/login" || pathname === "/signup") && user) {
    const requested = request.nextUrl.searchParams.get("next");
    const destination = getSafeAuthNextPath(
      requested,
      requested?.startsWith("/family") ? "/family" : "/dashboard",
    );
    return withSessionCookies(NextResponse.redirect(new URL(destination, request.url)));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/family/:path*", "/login", "/signup"],
};
