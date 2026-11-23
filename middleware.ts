import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import type { Database } from "@/types/database";

const intlMiddleware = createMiddleware(routing);

async function handleAdminMiddleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === "/admin/login";

  // Fail closed if Supabase env vars are missing
  if (!url || !anonKey) {
    if (isLoginRoute) return response;
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Always verify via getUser() on the server (never getSession())
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data, error } = await supabase.rpc("is_admin");
    isAdmin = !error && data === true;
  }

  if (isLoginRoute) {
    if (isAdmin) {
      const redirectResponse = NextResponse.redirect(
        new URL("/admin", request.url)
      );
      // Preserve any refreshed Supabase session cookies across the redirect
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return redirectResponse;
    }
    return response;
  }

  // All other /admin/* routes require a valid admin session
  if (!user || !isAdmin) {
    if (user && !isAdmin) {
      await supabase.auth.signOut();
    }
    const loginUrl = new URL("/admin/login", request.url);
    if (user && !isAdmin) {
      loginUrl.searchParams.set("error", "denied");
    }
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. /admin/* uses Supabase auth logic only (outside next-intl)
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return handleAdminMiddleware(request);
  }

  // 1b. /dev/* routes bypass next-intl so /dev/model is directly accessible in dev/QA
  if (pathname === "/dev" || pathname.startsWith("/dev/")) {
    return NextResponse.next();
  }

  // 2. Returning visitor cookie redirect on bare domain "/" only.
  //    Never auto-redirect based on Accept-Language or IP, and never redirect deep links.
  if (pathname === "/") {
    const savedLocale = request.cookies.get("NEXT_LOCALE")?.value;
    if (savedLocale === "en" || savedLocale === "ar") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${savedLocale}`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 3. Public routes handled by next-intl (localePrefix: "as-needed", localeDetection: false)
  return intlMiddleware(request);
}

export const config = {
  // Matches /admin/* and all public routes; excludes /api, /_next, /_vercel, and static files with extensions
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
