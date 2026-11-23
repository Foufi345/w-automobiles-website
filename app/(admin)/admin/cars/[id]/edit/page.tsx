import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { CarForm } from "@/components/admin/CarForm";

export const dynamic = "force-dynamic";

interface EditCarPageProps {
  params: { id: string };
}

export default async function AdminEditCarPage({ params }: EditCarPageProps) {
  const { supabase } = await requireAdmin();

  const [{ data: car, error }, { data: brandRows }, { count: featuredCount }] =
    await Promise.all([
      supabase.from("cars").select("*").eq("id", params.id).maybeSingle(),
      supabase.from("cars").select("brand"),
      supabase
        .from("cars")
        .select("id", { count: "exact", head: true })
        .eq("featured", true),
    ]);

  if (error || !car) {
    notFound();
  }

  const existingBrands = Array.from(
    new Set((brandRows ?? []).map((r) => r.brand))
  );

  return (
    <CarForm
      mode="edit"
      initialCar={car}
      existingBrands={existingBrands}
      currentFeaturedCount={featuredCount ?? 0}
    />
  );
}
