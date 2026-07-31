import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Accessible without a session, no redirect either way (also fine to view
// while logged in — e.g. a public profile page).
const PUBLIC_PATHS = ["/auth/callback", "/u"];
// Accessible without a session, but redirect an already-logged-in visitor
// away (no point showing a login/signup form to someone already signed in).
const GUEST_ONLY_PATHS = ["/login", "/signup"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isGuestOnlyPath = GUEST_ONLY_PATHS.some((path) =>
    pathname.startsWith(path),
  );

  // Neither branch below needs `user` when the path is public (they only
  // ever fire for `!isPublicPath` or `isGuestOnlyPath`, which are disjoint
  // from it) — skip the Supabase Auth round-trip entirely for this,
  // largest and most unpredictable, share of public-profile traffic.
  if (isPublicPath) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isGuestOnlyPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isGuestOnlyPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
