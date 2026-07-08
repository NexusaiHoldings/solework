import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createMaterial } from "@/lib/shoes/pricing";
import { getAdminUser } from "@/lib/admin-auth";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9_]+$/, {
    message: "Slug must be lowercase alphanumeric with underscores only",
  }),
  baseCostCents: z.number().int().min(0),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const material = await createMaterial(
    parsed.data.name,
    parsed.data.slug,
    parsed.data.baseCostCents
  );
  if (!material) {
    return NextResponse.json(
      { error: "Failed to create material — slug may already be in use" },
      { status: 409 }
    );
  }
  return NextResponse.json(material, { status: 201 });
}
