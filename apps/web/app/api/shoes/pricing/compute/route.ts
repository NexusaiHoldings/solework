import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { computeSellPrice } from "@/lib/shoes/pricing";
import { getAdminUser } from "@/lib/admin-auth";

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

  // Customers may compute the SELL price, but must never see our cost basis or margin.
  // Admins (e.g. the pricing tool's preview) get the full breakdown.
  const isAdmin = !!(await getAdminUser());
  const payload = isAdmin
    ? breakdown
    : { sellPriceCents: breakdown.sellPriceCents, materialName: breakdown.materialName, tierName: breakdown.tierName };

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
