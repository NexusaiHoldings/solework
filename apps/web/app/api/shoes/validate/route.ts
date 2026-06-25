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

  // Primary: real geometry-based printability from the parametric CAD engine
  // (parametric-shoe-design-engine-001). Falls back to the deterministic rules table
  // if the engine is unreachable, so validation never regresses below today's behavior.
  const RUNTIME = (process.env.NEXT_PUBLIC_RUNTIME_URL || "https://runtime.nexusaiholdings.com").replace(/\/$/, "");
  const COMPANY = process.env.NEXT_PUBLIC_COMPANY_SLUG || "solework";
  try {
    const res = await fetch(`${RUNTIME}/parametric/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: COMPANY,
        sole_profile: parsed.data.sole_profile,
        toe_shape: parsed.data.toe_shape,
        us_size: parsed.data.us_size,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        checks?: { valid: boolean; rejection_reason?: string; auto_corrections?: Record<string, unknown> };
      };
      if (data.checks) {
        return NextResponse.json(
          {
            valid: data.checks.valid,
            rejection_reason: data.checks.rejection_reason ?? undefined,
            auto_corrections: data.checks.auto_corrections ?? {},
            source: "geometry",
          },
          { status: 200, headers: { "Cache-Control": "no-store" } }
        );
      }
    }
  } catch {
    /* fall through to the rules-table validator */
  }

  const result = validateDesign(parsed.data);
  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
