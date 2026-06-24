import { NextResponse } from "next/server";
import { fetchColorways } from "@/lib/shoes/design-sessions";

export async function GET(): Promise<NextResponse> {
  const colorways = await fetchColorways();
  return NextResponse.json(
    { colorways },
    { headers: { "Cache-Control": "no-store" } }
  );
}
