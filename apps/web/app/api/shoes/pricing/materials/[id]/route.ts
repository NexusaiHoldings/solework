import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateMaterialCost } from "@/lib/shoes/pricing";

const UpdateSchema = z.object({
  baseCostCents: z.number().int().min(0),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
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

  const ok = await updateMaterialCost(params.id, parsed.data.baseCostCents);
  if (!ok) {
    return NextResponse.json({ error: "Material not found or update failed" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
