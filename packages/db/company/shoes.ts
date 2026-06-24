/**
 * Shoe domain schema (F1-002).
 *
 * Tables: shoe_silhouettes, shoe_colorways, shoe_design_sessions,
 * print_jobs, shoe_skus. Picked up by packages/db/migrate.ts via
 * the *_DDL constant convention.
 */
export const SHOES_DDL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shoe_design_validation_status') THEN
    CREATE TYPE shoe_design_validation_status AS ENUM ('pending', 'valid', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shoe_print_job_status') THEN
    CREATE TYPE shoe_print_job_status AS ENUM ('queued', 'printing', 'qc_hold', 'shipped', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shoe_print_job_ip_clearance_status') THEN
    CREATE TYPE shoe_print_job_ip_clearance_status AS ENUM ('pending', 'cleared', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS shoe_silhouettes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  mesh_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  compliance_certified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shoe_colorways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  hex_primary varchar(7) NOT NULL,
  hex_secondary varchar(7) NOT NULL,
  material_type varchar(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS shoe_design_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  silhouette_id uuid NOT NULL REFERENCES shoe_silhouettes(id) ON DELETE RESTRICT,
  colorway_id uuid NOT NULL REFERENCES shoe_colorways(id) ON DELETE RESTRICT,
  sole_profile varchar(120) NOT NULL,
  toe_shape varchar(120) NOT NULL,
  us_size numeric(4,1) NOT NULL,
  validation_status shoe_design_validation_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_session_id uuid NOT NULL REFERENCES shoe_design_sessions(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  status shoe_print_job_status NOT NULL DEFAULT 'queued',
  ip_clearance_status shoe_print_job_ip_clearance_status NOT NULL DEFAULT 'pending',
  printer_farm_job_id varchar(120),
  dispatched_at timestamptz,
  shipped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shoe_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  silhouette_id uuid NOT NULL REFERENCES shoe_silhouettes(id) ON DELETE RESTRICT,
  colorway_id uuid NOT NULL REFERENCES shoe_colorways(id) ON DELETE RESTRICT,
  us_size numeric(4,1) NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0,
  price_cents integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_shoe_design_sessions_user_id
  ON shoe_design_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_shoe_design_sessions_validation_status
  ON shoe_design_sessions (validation_status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_design_session_id
  ON print_jobs (design_session_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status
  ON print_jobs (status);
CREATE INDEX IF NOT EXISTS idx_shoe_skus_silhouette_colorway
  ON shoe_skus (silhouette_id, colorway_id);
CREATE INDEX IF NOT EXISTS idx_shoe_skus_is_active
  ON shoe_skus (is_active) WHERE is_active = true;

-- Pricing module tables (CR-001)

CREATE TABLE IF NOT EXISTS shoe_print_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  slug varchar(60) NOT NULL,
  base_cost_cents integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shoe_print_materials_slug_unique UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS shoe_silhouette_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  silhouette_id uuid NOT NULL REFERENCES shoe_silhouettes(id) ON DELETE CASCADE,
  tier_name varchar(60) NOT NULL DEFAULT 'standard',
  price_add_cents integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shoe_silhouette_tiers_silhouette_unique UNIQUE (silhouette_id)
);

CREATE TABLE IF NOT EXISTS shoe_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key varchar(120) NOT NULL DEFAULT 'global',
  margin_bps integer NOT NULL DEFAULT 4500,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shoe_pricing_rules_scope_unique UNIQUE (scope_key)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shoe_skus_sil_col_size_unique'
  ) THEN
    ALTER TABLE shoe_skus
    ADD CONSTRAINT shoe_skus_sil_col_size_unique UNIQUE (silhouette_id, colorway_id, us_size);
  END IF;
END $$;

-- Starter catalog seed (idempotent)

INSERT INTO shoe_silhouettes (id, name, mesh_url, is_active, compliance_certified) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Court Classic', '/meshes/court-classic.glb', true, true),
  ('a0000001-0000-0000-0000-000000000002', 'Canvas Low',    '/meshes/canvas-low.glb',    true, true),
  ('a0000001-0000-0000-0000-000000000003', 'City Walker',   '/meshes/city-walker.glb',   true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO shoe_colorways (id, name, hex_primary, hex_secondary, material_type) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'White / Natural',       '#FFFFFF', '#F5F0E8', 'TPU'),
  ('b0000001-0000-0000-0000-000000000002', 'White / Forest Green',  '#FFFFFF', '#228B22', 'TPU'),
  ('b0000001-0000-0000-0000-000000000003', 'White / Navy',          '#FFFFFF', '#1B2A5E', 'Nylon-12'),
  ('b0000001-0000-0000-0000-000000000004', 'White / Clay',          '#FFFFFF', '#B36A5E', 'PLA+')
ON CONFLICT (id) DO NOTHING;

INSERT INTO shoe_print_materials (name, slug, base_cost_cents, is_active) VALUES
  ('TPU (Thermoplastic Polyurethane)', 'tpu',      2200, true),
  ('PLA+ (Enhanced PLA)',              'pla_plus', 1200, true),
  ('Nylon-12',                         'nylon_12', 2800, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO shoe_silhouette_tiers (silhouette_id, tier_name, price_add_cents) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'standard', 1500),
  ('a0000001-0000-0000-0000-000000000002', 'standard', 1500),
  ('a0000001-0000-0000-0000-000000000003', 'premium',  3000)
ON CONFLICT (silhouette_id) DO NOTHING;

INSERT INTO shoe_pricing_rules (scope_key, margin_bps) VALUES
  ('global', 4500)
ON CONFLICT (scope_key) DO NOTHING;

INSERT INTO shoe_skus (silhouette_id, colorway_id, us_size, name, stock_quantity, price_cents, is_active) VALUES
  ('a0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000001', 7,  'Court Classic — White/Natural M7',  10, 14900, true),
  ('a0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000001', 8,  'Court Classic — White/Natural M8',  10, 14900, true),
  ('a0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000001', 9,  'Court Classic — White/Natural M9',  10, 14900, true),
  ('a0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000001', 10, 'Court Classic — White/Natural M10', 10, 14900, true),
  ('a0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000001', 11, 'Court Classic — White/Natural M11', 10, 14900, true),
  ('a0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000001', 12, 'Court Classic — White/Natural M12', 8,  14900, true),
  ('a0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000001', 13, 'Court Classic — White/Natural M13', 6,  14900, true),
  ('a0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000002', 7,  'Court Classic — White/Forest Green M7',  10, 14900, true),
  ('a0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000002', 8,  'Court Classic — White/Forest Green M8',  10, 14900, true),
  ('a0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000002', 9,  'Court Classic — White/Forest Green M9',  10, 14900, true),
  ('a0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000002', 10, 'Court Classic — White/Forest Green M10', 10, 14900, true),
  ('a0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000002', 11, 'Court Classic — White/Forest Green M11', 10, 14900, true),
  ('a0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000002', 12, 'Court Classic — White/Forest Green M12', 8,  14900, true),
  ('a0000001-0000-0000-0000-000000000001','b0000001-0000-0000-0000-000000000002', 13, 'Court Classic — White/Forest Green M13', 6,  14900, true),
  ('a0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000001', 7,  'Canvas Low — White/Natural M7',  10, 13900, true),
  ('a0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000001', 8,  'Canvas Low — White/Natural M8',  10, 13900, true),
  ('a0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000001', 9,  'Canvas Low — White/Natural M9',  10, 13900, true),
  ('a0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000001', 10, 'Canvas Low — White/Natural M10', 10, 13900, true),
  ('a0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000001', 11, 'Canvas Low — White/Natural M11', 10, 13900, true),
  ('a0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000001', 12, 'Canvas Low — White/Natural M12', 8,  13900, true),
  ('a0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000001', 13, 'Canvas Low — White/Natural M13', 6,  13900, true),
  ('a0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000003', 7,  'Canvas Low — White/Navy M7',  10, 15900, true),
  ('a0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000003', 8,  'Canvas Low — White/Navy M8',  10, 15900, true),
  ('a0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000003', 9,  'Canvas Low — White/Navy M9',  10, 15900, true),
  ('a0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000003', 10, 'Canvas Low — White/Navy M10', 10, 15900, true),
  ('a0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000003', 11, 'Canvas Low — White/Navy M11', 10, 15900, true),
  ('a0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000003', 12, 'Canvas Low — White/Navy M12', 8,  15900, true),
  ('a0000001-0000-0000-0000-000000000002','b0000001-0000-0000-0000-000000000003', 13, 'Canvas Low — White/Navy M13', 6,  15900, true),
  ('a0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000001', 7,  'City Walker — White/Natural M7',  8,  17900, true),
  ('a0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000001', 8,  'City Walker — White/Natural M8',  8,  17900, true),
  ('a0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000001', 9,  'City Walker — White/Natural M9',  8,  17900, true),
  ('a0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000001', 10, 'City Walker — White/Natural M10', 8,  17900, true),
  ('a0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000001', 11, 'City Walker — White/Natural M11', 8,  17900, true),
  ('a0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000001', 12, 'City Walker — White/Natural M12', 6,  17900, true),
  ('a0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000001', 13, 'City Walker — White/Natural M13', 5,  17900, true),
  ('a0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000004', 7,  'City Walker — White/Clay M7',  8,  17900, true),
  ('a0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000004', 8,  'City Walker — White/Clay M8',  8,  17900, true),
  ('a0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000004', 9,  'City Walker — White/Clay M9',  8,  17900, true),
  ('a0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000004', 10, 'City Walker — White/Clay M10', 8,  17900, true),
  ('a0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000004', 11, 'City Walker — White/Clay M11', 8,  17900, true),
  ('a0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000004', 12, 'City Walker — White/Clay M12', 6,  17900, true),
  ('a0000001-0000-0000-0000-000000000003','b0000001-0000-0000-0000-000000000004', 13, 'City Walker — White/Clay M13', 5,  17900, true)
ON CONFLICT (silhouette_id, colorway_id, us_size) DO NOTHING;
`;
