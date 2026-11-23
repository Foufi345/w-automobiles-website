import { requireAdmin } from "@/lib/auth/requireAdmin";
import { CarForm } from "@/components/admin/CarForm";

export const dynamic = "force-dynamic";

export default async function AdminNewCarPage() {
  const { supabase } = await requireAdmin();

  const [{ data: brandRows }, { count: featuredCount }] = await Promise.all([
    supabase.from("cars").select("brand"),
    supabase
      .from("cars")
      .select("id", { count: "exact", head: true })
      .eq("featured", true),
  ]);

  const existingBrands = Array.from(
    new Set((brandRows ?? []).map((r) => r.brand))
  );

  return (
    <CarForm
      mode="create"
      existingBrands={existingBrands}
      currentFeaturedCount={featuredCount ?? 0}
    />
  );
}
