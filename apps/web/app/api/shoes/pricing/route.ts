import { NextResponse } from "next/server";
import { fetchAllPricingConfig } from "@/lib/shoes/pricing";

export async function GET(): Promise<NextResponse> {
  const config = await fetchAllPricingConfig();
  return NextResponse.json(config, { headers: { "Cache-Control": "no-store" } });
}
