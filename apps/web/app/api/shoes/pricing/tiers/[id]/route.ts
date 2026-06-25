import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateSilhouetteTier } from "@/lib/shoes/pricing";
import { getAdminUser } from "@/lib/admin-auth";

const UpdateSchema = z.object({
  tierName: z.string().min(1).max(60),
  priceAddCents: z.number().int().min(0),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const ok = await updateSilhouetteTier(params.id, parsed.data.tierName, parsed.data.priceAddCents);
  if (!ok) {
    return NextResponse.json({ error: "Tier not found or update failed" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
