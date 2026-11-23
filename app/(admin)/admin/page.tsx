import { requireAdmin } from "@/lib/auth/requireAdmin";
import { AdminCarManager } from "@/components/admin/AdminCarManager";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();

  const { data: cars, error } = await supabase
    .from("cars")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <AdminCarManager
      initialCars={cars ?? []}
      initialError={error ? error.message : null}
    />
  );
}
