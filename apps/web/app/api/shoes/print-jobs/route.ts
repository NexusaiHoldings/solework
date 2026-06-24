import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { handleSession } from "@nexus/identity-and-access";
import { buildDb } from "@/lib/db";
import { buildEventBus } from "@/lib/events";
import { createPrintJob, fetchPrintJobsByUser } from "@/lib/shoes/print-jobs";
import { getAdminUser } from "@/lib/admin-auth";

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

const CreateJobSchema = z.object({
  design_session_id: z.string().uuid({ message: "design_session_id must be a valid UUID" }),
  order_id: z.string().uuid({ message: "order_id must be a valid UUID" }),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = await getAdminUser();
  if (admin) {
    // Admin can view all queued/recent jobs — for simplicity return user-scoped by query param
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("user_id");
    if (!userId) {
      return NextResponse.json({ error: "user_id query param required for admin listing" }, { status: 400 });
    }
    const jobs = await fetchPrintJobsByUser(userId);
    return NextResponse.json({ jobs }, { headers: { "Cache-Control": "no-store" } });
  }

  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const jobs = await fetchPrintJobsByUser(userId);
  return NextResponse.json({ jobs }, { headers: { "Cache-Control": "no-store" } });
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

  const parsed = CreateJobSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const job = await createPrintJob({
    designSessionId: parsed.data.design_session_id,
    orderId: parsed.data.order_id,
  });

  if (!job) {
    return NextResponse.json({ error: "Failed to create print job" }, { status: 500 });
  }

  return NextResponse.json(
    { job },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
