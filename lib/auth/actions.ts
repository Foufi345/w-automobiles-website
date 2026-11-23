"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email("login.errors.invalidEmail"),
  password: z.string().min(1, "login.errors.passwordRequired"),
});

export interface LoginActionState {
  error: string | null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loginAdminAction(
  _prevState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "login.errors.invalidCredentials",
    };
  }

  const supabase = createServerSupabaseClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (signInError) {
    // Small constant delay + generic message key to slow brute-force attempts
    await delay(650);
    return {
      error: "login.errors.invalidCredentials",
    };
  }

  // Re-verify session and admin identity on the server via public.is_admin()
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");

  if (!user || adminErr || isAdmin !== true) {
    await supabase.auth.signOut();
    await delay(650);
    return {
      error: "login.errors.accessDenied",
    };
  }

  redirect("/admin");
}

export async function logoutAdminAction(): Promise<void> {
  const supabase = createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
