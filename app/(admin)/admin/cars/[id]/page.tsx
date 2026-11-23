import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";

export default async function AdminCarIdRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  redirect(`/admin/cars/${params.id}/edit`);
}
