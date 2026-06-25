import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Pool } from "pg";
import { getAdminUser } from "@/lib/admin-auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface RouteParams {
  params: { id: string };
}

const UpdateSkuSchema = z.object({
  stockQuantity: z.number().int().min(0).optional(),
  priceCents: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(120).optional(),
});

export async function PUT(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }
  const skuId = params.id;
  if (!skuId || !/^[0-9a-f-]{36}$/.test(skuId)) {
    return NextResponse.json({ error: "Invalid SKU id" }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = UpdateSkuSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const updates: string[] = [];
  const values: unknown[] = [skuId];
  let idx = 2;

  if (parsed.data.stockQuantity !== undefined) {
    updates.push(`stock_quantity = $${idx++}`);
    values.push(parsed.data.stockQuantity);
  }
  if (parsed.data.priceCents !== undefined) {
    updates.push(`price_cents = $${idx++}`);
    values.push(parsed.data.priceCents);
  }
  if (parsed.data.isActive !== undefined) {
    updates.push(`is_active = $${idx++}`);
    values.push(parsed.data.isActive);
  }
  if (parsed.data.name !== undefined) {
    updates.push(`name = $${idx++}`);
    values.push(parsed.data.name);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `UPDATE shoe_skus SET ${updates.join(", ")} WHERE id = $1 RETURNING id`,
      values
    );
    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "SKU not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }
  const skuId = params.id;
  if (!skuId || !/^[0-9a-f-]{36}$/.test(skuId)) {
    return NextResponse.json({ error: "Invalid SKU id" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `DELETE FROM shoe_skus WHERE id = $1 RETURNING id`,
      [skuId]
    );
    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "SKU not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
