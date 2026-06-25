import { NextResponse } from "next/server";
import { fetchAllPricingConfig } from "@/lib/shoes/pricing";
import { getAdminUser } from "@/lib/admin-auth";

// Admin-only: exposes material COSTS + profit MARGINS (internal price-setting config).
export async function GET(): Promise<NextResponse> {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }
  const config = await fetchAllPricingConfig();
  return NextResponse.json(config, { headers: { "Cache-Control": "no-store" } });
}
