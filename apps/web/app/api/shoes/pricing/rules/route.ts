import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateGlobalMargin } from "@/lib/shoes/pricing";

const UpdateSchema = z.object({
  marginBps: z.number().int().min(0).max(9999),
});

export async function PUT(request: NextRequest): Promise<NextResponse> {
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

  const ok = await updateGlobalMargin(parsed.data.marginBps);
  if (!ok) {
    return NextResponse.json({ error: "Failed to update margin rule" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
