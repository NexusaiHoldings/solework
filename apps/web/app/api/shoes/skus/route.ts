import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type SkuRow = {
  id: string;
  name: string;
  silhouette_id: string;
  silhouette_name: string;
  colorway_id: string;
  colorway_name: string;
  us_size: string;
  stock_quantity: number;
  price_cents: number;
  is_active: boolean;
};

async function fetchAllSkus(): Promise<object[]> {
  try {
    const result = await pool.query<SkuRow>(
      `SELECT sk.id, sk.name,
              sk.silhouette_id, ss.name AS silhouette_name,
              sk.colorway_id,   sc.name AS colorway_name,
              sk.us_size, sk.stock_quantity, sk.price_cents, sk.is_active
       FROM shoe_skus sk
       JOIN shoe_silhouettes ss ON ss.id = sk.silhouette_id
       JOIN shoe_colorways   sc ON sc.id = sk.colorway_id
       ORDER BY sk.name ASC, sk.us_size ASC`
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      silhouetteId: row.silhouette_id,
      silhouetteName: row.silhouette_name,
      colorwayId: row.colorway_id,
      colorwayName: row.colorway_name,
      usSize: parseFloat(row.us_size),
      stockQuantity: row.stock_quantity,
      priceCents: row.price_cents,
      isActive: row.is_active,
    }));
  } catch {
    return [];
  }
}

const CreateSkuSchema = z.object({
  name: z.string().min(1).max(120),
  silhouetteId: z.string().uuid(),
  colorwayId: z.string().uuid(),
  usSize: z.number().min(4).max(16),
  stockQuantity: z.number().int().min(0),
  priceCents: z.number().int().min(0),
});

export async function GET(): Promise<NextResponse> {
  const skus = await fetchAllSkus();
  return NextResponse.json({ skus }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = CreateSkuSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    type NewRow = { id: string };
    const result = await pool.query<NewRow>(
      `INSERT INTO shoe_skus
         (name, silhouette_id, colorway_id, us_size, stock_quantity, price_cents)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        parsed.data.name,
        parsed.data.silhouetteId,
        parsed.data.colorwayId,
        parsed.data.usSize,
        parsed.data.stockQuantity,
        parsed.data.priceCents,
      ]
    );
    if (!result.rows[0]) {
      return NextResponse.json({ error: "Insert returned no row" }, { status: 500 });
    }
    return NextResponse.json(
      { id: result.rows[0].id },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
