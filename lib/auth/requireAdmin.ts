import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export class AdminAuthError extends Error {
  public readonly status: number;

  constructor(message = "Accès non autorisé.", status = 401) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

export interface VerifiedAdminContext {
  user: User;
  supabase: ReturnType<typeof createServerSupabaseClient>;
}

/**
 * Verifies the current request has a valid Supabase user (via getUser(), never getSession())
 * AND that the user passes the server-side public.is_admin() check.
 * Returns null when unauthenticated or non-admin.
 */
export async function getAdminUser(): Promise<VerifiedAdminContext | null> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");

  if (adminError || isAdmin !== true) {
    return null;
  }

  return { user, supabase };
}

/**
 * Mandatory server guard for every admin page, Server Action, and API route handler.
 * - onUnauthorized: "redirect" (default for pages) -> redirects to /admin/login
 * - onUnauthorized: "throw" (for API routes / programmatic checks) -> throws AdminAuthError (401)
 */
export async function requireAdmin(options?: {
  onUnauthorized?: "redirect" | "throw";
}): Promise<VerifiedAdminContext> {
  const mode = options?.onUnauthorized ?? "redirect";
  const ctx = await getAdminUser();

  if (!ctx) {
    if (mode === "throw") {
      throw new AdminAuthError("Accès refusé : session administrateur requise.", 401);
    }
    redirect("/admin/login");
  }

  return ctx;
}
