import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { handleSession } from "@nexus/identity-and-access";
import { buildDb } from "@/lib/db";
import { buildEventBus } from "@/lib/events";
import {
  createDesignSession,
  fetchUserDesignSessions,
} from "@/lib/shoes/design-sessions";
import { createPrintJob } from "@/lib/shoes/print-jobs";
import { randomUUID } from "crypto";

async function resolveUserId(): Promise<string | null> {
  const token = cookies().get("session_token")?.value;
  if (!token) return null;
  try {
    const result = await handleSession({
      authorizationHeader: `Bearer ${token}`,
      ctx: { db: buildDb(), events: buildEventBus() },
    });
    if (result.status !== 200 || typeof result.body !== "object" || !result.body) return null;
    const body = result.body as { user_id?: string };
    return body.user_id ?? null;
  } catch {
    return null;
  }
}

const CreateSessionSchema = z.object({
  silhouette_id: z.string().uuid({ message: "silhouette_id must be a valid UUID" }),
  colorway_id: z.string().uuid({ message: "colorway_id must be a valid UUID" }),
  sole_profile: z.enum(["flat", "wedge", "block_heel", "stiletto", "platform", "sport"]),
  toe_shape: z.enum(["round", "square", "pointed", "open"]),
  us_size: z.number().min(4).max(16),
  print_mesh_url: z.string().url().optional(),  // print-ready CAD artifact captured at save time
});

export async function GET(): Promise<NextResponse> {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sessions = await fetchUserDesignSessions(userId);
  return NextResponse.json({ sessions }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = CreateSessionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const session = await createDesignSession({
    userId,
    silhouetteId: parsed.data.silhouette_id,
    colorwayId: parsed.data.colorway_id,
    soleProfile: parsed.data.sole_profile,
    toeShape: parsed.data.toe_shape,
    usSize: parsed.data.us_size,
    printMeshUrl: parsed.data.print_mesh_url ?? null,
  });

  if (!session) {
    return NextResponse.json({ error: "Failed to create design session" }, { status: 500 });
  }

  // Saving a design sends it to a PENDING order: create a print job (status 'queued',
  // ip_clearance 'pending') so the design enters the order pipeline + shows on /orders.
  // One order per saved design (order_id groups its print job). Best-effort: a failed
  // order creation must not fail the save — the design is still saved.
  let orderId: string | null = null;
  try {
    const job = await createPrintJob({ designSessionId: session.id, orderId: randomUUID() });
    orderId = job?.orderId ?? null;
  } catch {
    orderId = null;
  }

  return NextResponse.json(
    { id: session.id, status: session.validationStatus, orderId },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
