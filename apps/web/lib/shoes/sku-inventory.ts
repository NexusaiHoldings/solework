import { Pool } from "pg";

export interface ShoeSku {
  id: string;
  name: string;
  colorway: string;
  size: string;
  stockQuantity: number;
  price: number;
  imageUrl: string | null;
}

export interface SkuGroup {
  groupId: string;
  name: string;
  colorway: string;
  imageUrl: string | null;
  price: number;
  sizes: Array<{ id: string; size: string; stockQuantity: number }>;
}

export type StockStatus = "in_stock" | "low_stock" | "sold_out";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function fetchShoeSkus(): Promise<ShoeSku[]> {
  type Row = {
    id: string;
    name: string;
    colorway: string;
    size: string;
    stock_quantity: number;
    price_cents: number;
  };
  try {
    const result = await pool.query<Row>(
      `SELECT sk.id,
              ss.name        AS name,
              sc.name        AS colorway,
              sk.us_size::text AS size,
              sk.stock_quantity,
              sk.price_cents
       FROM shoe_skus sk
       JOIN shoe_silhouettes ss ON ss.id = sk.silhouette_id
       JOIN shoe_colorways   sc ON sc.id = sk.colorway_id
       WHERE sk.is_active = true
       ORDER BY ss.name ASC, sc.name ASC, sk.us_size ASC`
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      colorway: row.colorway,
      size: row.size,
      stockQuantity: Number(row.stock_quantity),
      price: row.price_cents / 100,
      imageUrl: null,
    }));
  } catch {
    // Table may not exist during early provisioning; return empty list.
    return [];
  }
}

export function groupSkusByColorway(skus: ShoeSku[]): SkuGroup[] {
  const seen = new Map<string, SkuGroup>();
  for (const sku of skus) {
    const key = `${sku.name}::${sku.colorway}`;
    if (!seen.has(key)) {
      seen.set(key, {
        groupId: key
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
        name: sku.name,
        colorway: sku.colorway,
        imageUrl: sku.imageUrl,
        price: sku.price,
        sizes: [],
      });
    }
    seen.get(key)!.sizes.push({
      id: sku.id,
      size: sku.size,
      stockQuantity: sku.stockQuantity,
    });
  }
  return Array.from(seen.values());
}

export function getStockStatus(quantity: number): StockStatus {
  if (quantity === 0) return "sold_out";
  if (quantity <= 3) return "low_stock";
  return "in_stock";
}

export function getStockLabel(quantity: number): string {
  if (quantity === 0) return "Sold out";
  if (quantity <= 3) return `Low stock: ${quantity} left`;
  return "In stock";
}

export function groupStockStatus(group: SkuGroup): StockStatus {
  const total = group.sizes.reduce((acc, s) => acc + s.stockQuantity, 0);
  return getStockStatus(total);
}

export function areAllSoldOut(groups: SkuGroup[]): boolean {
  return (
    groups.length === 0 ||
    groups.every((g) => groupStockStatus(g) === "sold_out")
  );
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}
