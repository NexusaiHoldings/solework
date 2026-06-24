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
    price: string;
    image_url: string | null;
  };
  try {
    const result = await pool.query<Row>(
      `SELECT id, name, colorway, size, stock_quantity, price, image_url
       FROM shoe_skus
       ORDER BY name ASC, colorway ASC, size ASC`
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      colorway: row.colorway,
      size: row.size,
      stockQuantity: Number(row.stock_quantity),
      price: parseFloat(row.price),
      imageUrl: row.image_url,
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
