import { NextResponse } from "next/server";
import { fetchActiveSilhouettes } from "@/lib/shoes/design-sessions";

export async function GET(): Promise<NextResponse> {
  const silhouettes = await fetchActiveSilhouettes();
  return NextResponse.json(
    { silhouettes },
    { headers: { "Cache-Control": "no-store" } }
  );
}
