import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { computeSellPrice } from "@/lib/shoes/pricing";

const ComputeSchema = z.object({
  silhouetteId: z.string().uuid(),
  colorwayId: z.string().uuid(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = ComputeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const breakdown = await computeSellPrice(parsed.data.silhouetteId, parsed.data.colorwayId);
  if (!breakdown) {
    return NextResponse.json(
      { error: "Could not compute price — material or tier config missing" },
      { status: 404 }
    );
  }

  return NextResponse.json(breakdown, { headers: { "Cache-Control": "no-store" } });
}
