import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/requireAdmin";
import { createSignedCarUploadParams } from "@/lib/cloudinary-server";

export async function POST() {
  try {
    await requireAdmin({ onUnauthorized: "throw" });
    const payload = createSignedCarUploadParams();
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Impossible de signer l'envoi Cloudinary." },
      { status: 500 }
    );
  }
}
