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
`;
