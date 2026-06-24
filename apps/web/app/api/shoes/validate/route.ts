import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  validateDesign,
  type SoleProfile,
  type ToeShape,
} from "@/lib/shoes/design-validator";

export const runtime = "edge";

const DesignInputSchema = z.object({
  silhouette_id: z.string().uuid({ message: "silhouette_id must be a valid UUID" }),
  colorway_id: z.string().min(1, { message: "colorway_id is required" }),
  sole_profile: z.enum(
    ["flat", "wedge", "block_heel", "stiletto", "platform", "sport"],
    { errorMap: () => ({ message: "sole_profile must be one of: flat, wedge, block_heel, stiletto, platform, sport" }) }
  ),
  toe_shape: z.enum(
    ["round", "square", "pointed", "open"],
    { errorMap: () => ({ message: "toe_shape must be one of: round, square, pointed, open" }) }
  ),
  us_size: z
    .number({ invalid_type_error: "us_size must be a number" })
    .min(4, { message: "us_size minimum is 4" })
    .max(16, { message: "us_size maximum is 16" }),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const parsed = DesignInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const result = validateDesign(parsed.data);

  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
