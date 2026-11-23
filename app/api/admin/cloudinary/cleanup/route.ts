import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminAuthError, requireAdmin } from "@/lib/auth/requireAdmin";
import { deleteCloudinaryImages } from "@/lib/cloudinary-server";

const cleanupSchema = z.object({
  publicIds: z.array(z.string().trim().min(1)).max(50),
});

export async function POST(request: Request) {
  try {
    await requireAdmin({ onUnauthorized: "throw" });
    const json = await request.json().catch(() => null);
    const parsed = cleanupSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Liste d'images invalide." },
        { status: 400 }
      );
    }

    const result = await deleteCloudinaryImages(parsed.data.publicIds);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Impossible de nettoyer les images temporaires." },
      { status: 500 }
    );
  }
}
