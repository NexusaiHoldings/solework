import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface PrintMaterial {
  id: string;
  name: string;
  slug: string;
  baseCostCents: number;
  isActive: boolean;
  updatedAt: string;
}

export interface SilhouetteTier {
  id: string;
  silhouetteId: string;
  silhouetteName: string;
  tierName: string;
  priceAddCents: number;
  updatedAt: string;
}

export interface PricingRule {
  id: string;
  scopeKey: string;
  marginBps: number;
  updatedAt: string;
}

export interface PriceBreakdown {
  materialSlug: string;
  materialName: string;
  baseCostCents: number;
  tierName: string;
  tierAddCents: number;
  totalCostCents: number;
  marginBps: number;
  marginPct: number;
  sellPriceCents: number;
}

export interface AllPricingConfig {
  materials: PrintMaterial[];
  tiers: SilhouetteTier[];
  rules: PricingRule[];
}

type MaterialRow = {
  id: string;
  name: string;
  slug: string;
  base_cost_cents: number;
  is_active: boolean;
  updated_at: string;
};

type TierRow = {
  id: string;
  silhouette_id: string;
  silhouette_name: string;
  tier_name: string;
  price_add_cents: number;
  updated_at: string;
};

type RuleRow = {
  id: string;
  scope_key: string;
  margin_bps: number;
  updated_at: string;
};

export async function fetchPrintMaterials(): Promise<PrintMaterial[]> {
  try {
    const result = await pool.query<MaterialRow>(
      `SELECT id, name, slug, base_cost_cents, is_active, updated_at
       FROM shoe_print_materials
       ORDER BY name ASC`
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      baseCostCents: row.base_cost_cents,
      isActive: row.is_active,
      updatedAt: String(row.updated_at),
    }));
  } catch {
    return [];
  }
}

export async function fetchSilhouetteTiers(): Promise<SilhouetteTier[]> {
  try {
    const result = await pool.query<TierRow>(
      `SELECT t.id, t.silhouette_id, ss.name AS silhouette_name,
              t.tier_name, t.price_add_cents, t.updated_at
       FROM shoe_silhouette_tiers t
       JOIN shoe_silhouettes ss ON ss.id = t.silhouette_id
       ORDER BY ss.name ASC`
    );
    return result.rows.map((row) => ({
      id: row.id,
      silhouetteId: row.silhouette_id,
      silhouetteName: row.silhouette_name,
      tierName: row.tier_name,
      priceAddCents: row.price_add_cents,
      updatedAt: String(row.updated_at),
    }));
  } catch {
    return [];
  }
}

export async function fetchPricingRules(): Promise<PricingRule[]> {
  try {
    const result = await pool.query<RuleRow>(
      `SELECT id, scope_key, margin_bps, updated_at
       FROM shoe_pricing_rules
       ORDER BY scope_key ASC`
    );
    return result.rows.map((row) => ({
      id: row.id,
      scopeKey: row.scope_key,
      marginBps: row.margin_bps,
      updatedAt: String(row.updated_at),
    }));
  } catch {
    return [];
  }
}

export async function fetchAllPricingConfig(): Promise<AllPricingConfig> {
  const [materials, tiers, rules] = await Promise.all([
    fetchPrintMaterials(),
    fetchSilhouetteTiers(),
    fetchPricingRules(),
  ]);
  return { materials, tiers, rules };
}

export function computeSellPriceFromParts(
  baseCostCents: number,
  tierAddCents: number,
  marginBps: number
): PriceBreakdown["sellPriceCents"] {
  const totalCost = baseCostCents + tierAddCents;
  const marginRate = marginBps / 10000;
  if (marginRate >= 1) return totalCost * 2;
  return Math.ceil(totalCost / (1 - marginRate));
}

export async function computeSellPrice(
  silhouetteId: string,
  colorwayId: string
): Promise<PriceBreakdown | null> {
  try {
    type JoinRow = {
      material_slug: string;
      material_name: string;
      base_cost_cents: number;
      tier_name: string | null;
      price_add_cents: number | null;
    };
    const result = await pool.query<JoinRow>(
      `SELECT pm.slug   AS material_slug,
              pm.name   AS material_name,
              pm.base_cost_cents,
              st.tier_name,
              st.price_add_cents
       FROM shoe_colorways sc
       JOIN shoe_print_materials pm
         ON pm.slug = LOWER(REPLACE(REPLACE(sc.material_type, '+', '_plus'), '-', '_'))
        AND pm.is_active = true
       LEFT JOIN shoe_silhouette_tiers st ON st.silhouette_id = $1
       WHERE sc.id = $2`,
      [silhouetteId, colorwayId]
    );

    if (!result.rows[0]) return null;

    const row = result.rows[0];
    const baseCostCents = row.base_cost_cents;
    const tierAddCents = row.price_add_cents ?? 0;

    const ruleResult = await pool.query<{ margin_bps: number }>(
      `SELECT margin_bps FROM shoe_pricing_rules WHERE scope_key = 'global' LIMIT 1`
    );
    const marginBps = ruleResult.rows[0]?.margin_bps ?? 4500;
    const totalCostCents = baseCostCents + tierAddCents;

    return {
      materialSlug: row.material_slug,
      materialName: row.material_name,
      baseCostCents,
      tierName: row.tier_name ?? "standard",
      tierAddCents,
      totalCostCents,
      marginBps,
      marginPct: marginBps / 100,
      sellPriceCents: computeSellPriceFromParts(baseCostCents, tierAddCents, marginBps),
    };
  } catch {
    return null;
  }
}

export async function updateMaterialCost(
  id: string,
  baseCostCents: number
): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE shoe_print_materials
       SET base_cost_cents = $1, updated_at = now()
       WHERE id = $2`,
      [baseCostCents, id]
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function updateSilhouetteTier(
  id: string,
  tierName: string,
  priceAddCents: number
): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE shoe_silhouette_tiers
       SET tier_name = $1, price_add_cents = $2, updated_at = now()
       WHERE id = $3`,
      [tierName, priceAddCents, id]
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function createMaterial(
  name: string,
  slug: string,
  baseCostCents: number
): Promise<PrintMaterial | null> {
  try {
    const result = await pool.query<MaterialRow>(
      `INSERT INTO shoe_print_materials (name, slug, base_cost_cents, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, name, slug, base_cost_cents, is_active, updated_at`,
      [name, slug, baseCostCents]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      baseCostCents: row.base_cost_cents,
      isActive: row.is_active,
      updatedAt: String(row.updated_at),
    };
  } catch {
    return null;
  }
}

export async function updateGlobalMargin(marginBps: number): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO shoe_pricing_rules (scope_key, margin_bps)
       VALUES ('global', $1)
       ON CONFLICT (scope_key) DO UPDATE SET margin_bps = $1, updated_at = now()`,
      [marginBps]
    );
    return true;
  } catch {
    return false;
  }
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
