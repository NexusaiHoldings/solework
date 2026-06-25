/**
 * Design session DB operations — read silhouettes/colorways, create + list sessions.
 * Feature: 3D Studio (CR-001).
 */
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface ShoeSilhouette {
  id: string;
  name: string;
  meshUrl: string;
  isActive: boolean;
  complianceCertified: boolean;
  gender: string; // 'mens' | 'womens' | 'unisex'
  allowedSoleProfiles: string[];
  allowedToeShapes: string[];
}

export interface ShoeColorway {
  id: string;
  name: string;
  hexPrimary: string;
  hexSecondary: string;
  materialType: string;
}

export interface ShoeDesignSession {
  id: string;
  userId: string;
  silhouetteId: string;
  silhouetteName: string;
  colorwayId: string;
  colorwayName: string;
  soleProfile: string;
  toeShape: string;
  usSize: number;
  validationStatus: "pending" | "valid" | "rejected";
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchActiveSilhouettes(): Promise<ShoeSilhouette[]> {
  type Row = {
    id: string;
    name: string;
    mesh_url: string;
    is_active: boolean;
    compliance_certified: boolean;
    gender: string | null;
    allowed_sole_profiles: string[] | null;
    allowed_toe_shapes: string[] | null;
  };
  try {
    const result = await pool.query<Row>(
      `SELECT id, name, mesh_url, is_active, compliance_certified,
              gender, allowed_sole_profiles, allowed_toe_shapes
       FROM shoe_silhouettes
       WHERE is_active = true
       ORDER BY name ASC`
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      meshUrl: row.mesh_url,
      isActive: row.is_active,
      complianceCertified: row.compliance_certified,
      gender: row.gender || "unisex",
      allowedSoleProfiles: row.allowed_sole_profiles || [],
      allowedToeShapes: row.allowed_toe_shapes || [],
    }));
  } catch {
    return [];
  }
}

export async function fetchColorways(): Promise<ShoeColorway[]> {
  type Row = {
    id: string;
    name: string;
    hex_primary: string;
    hex_secondary: string;
    material_type: string;
  };
  try {
    const result = await pool.query<Row>(
      `SELECT id, name, hex_primary, hex_secondary, material_type
       FROM shoe_colorways
       ORDER BY name ASC`
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      hexPrimary: row.hex_primary,
      hexSecondary: row.hex_secondary,
      materialType: row.material_type,
    }));
  } catch {
    return [];
  }
}

export async function createDesignSession(params: {
  userId: string;
  silhouetteId: string;
  colorwayId: string;
  soleProfile: string;
  toeShape: string;
  usSize: number;
  printMeshUrl?: string | null;
}): Promise<ShoeDesignSession | null> {
  type Row = {
    id: string;
    user_id: string;
    silhouette_id: string;
    colorway_id: string;
    sole_profile: string;
    toe_shape: string;
    us_size: string;
    validation_status: string;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
  };
  try {
    const result = await pool.query<Row>(
      `INSERT INTO shoe_design_sessions
         (user_id, silhouette_id, colorway_id, sole_profile, toe_shape, us_size, print_mesh_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, silhouette_id, colorway_id, sole_profile,
                 toe_shape, us_size, validation_status, rejection_reason,
                 created_at, updated_at`,
      [
        params.userId,
        params.silhouetteId,
        params.colorwayId,
        params.soleProfile,
        params.toeShape,
        params.usSize,
        params.printMeshUrl ?? null,
      ]
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      silhouetteId: row.silhouette_id,
      silhouetteName: "",
      colorwayId: row.colorway_id,
      colorwayName: "",
      soleProfile: row.sole_profile,
      toeShape: row.toe_shape,
      usSize: parseFloat(row.us_size),
      validationStatus: row.validation_status as "pending" | "valid" | "rejected",
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
}

export async function updateDesignSessionStatus(params: {
  sessionId: string;
  userId: string;
  validationStatus: "pending" | "valid" | "rejected";
  rejectionReason?: string;
}): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE shoe_design_sessions
       SET validation_status = $3,
           rejection_reason  = $4,
           updated_at        = now()
       WHERE id = $1 AND user_id = $2`,
      [
        params.sessionId,
        params.userId,
        params.validationStatus,
        params.rejectionReason ?? null,
      ]
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function fetchUserDesignSessions(
  userId: string
): Promise<ShoeDesignSession[]> {
  type Row = {
    id: string;
    user_id: string;
    silhouette_id: string;
    silhouette_name: string;
    colorway_id: string;
    colorway_name: string;
    sole_profile: string;
    toe_shape: string;
    us_size: string;
    validation_status: string;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
  };
  try {
    const result = await pool.query<Row>(
      `SELECT ds.id, ds.user_id,
              ds.silhouette_id, ss.name AS silhouette_name,
              ds.colorway_id,   sc.name AS colorway_name,
              ds.sole_profile, ds.toe_shape, ds.us_size,
              ds.validation_status, ds.rejection_reason,
              ds.created_at, ds.updated_at
       FROM shoe_design_sessions ds
       JOIN shoe_silhouettes ss ON ss.id = ds.silhouette_id
       JOIN shoe_colorways   sc ON sc.id = ds.colorway_id
       WHERE ds.user_id = $1
       ORDER BY ds.created_at DESC`,
      [userId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      silhouetteId: row.silhouette_id,
      silhouetteName: row.silhouette_name,
      colorwayId: row.colorway_id,
      colorwayName: row.colorway_name,
      soleProfile: row.sole_profile,
      toeShape: row.toe_shape,
      usSize: parseFloat(row.us_size),
      validationStatus: row.validation_status as "pending" | "valid" | "rejected",
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch {
    return [];
  }
}

export async function fetchDesignSessionById(
  sessionId: string,
  userId: string
): Promise<ShoeDesignSession | null> {
  type Row = {
    id: string;
    user_id: string;
    silhouette_id: string;
    silhouette_name: string;
    colorway_id: string;
    colorway_name: string;
    sole_profile: string;
    toe_shape: string;
    us_size: string;
    validation_status: string;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
  };
  try {
    const result = await pool.query<Row>(
      `SELECT ds.id, ds.user_id,
              ds.silhouette_id, ss.name AS silhouette_name,
              ds.colorway_id,   sc.name AS colorway_name,
              ds.sole_profile, ds.toe_shape, ds.us_size,
              ds.validation_status, ds.rejection_reason,
              ds.created_at, ds.updated_at
       FROM shoe_design_sessions ds
       JOIN shoe_silhouettes ss ON ss.id = ds.silhouette_id
       JOIN shoe_colorways   sc ON sc.id = ds.colorway_id
       WHERE ds.id = $1 AND ds.user_id = $2`,
      [sessionId, userId]
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      silhouetteId: row.silhouette_id,
      silhouetteName: row.silhouette_name,
      colorwayId: row.colorway_id,
      colorwayName: row.colorway_name,
      soleProfile: row.sole_profile,
      toeShape: row.toe_shape,
      usSize: parseFloat(row.us_size),
      validationStatus: row.validation_status as "pending" | "valid" | "rejected",
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
}
