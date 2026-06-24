/**
 * Printability Constraint Validator — FDM/SLA design safety gate.
 * CPSC/ASTM compliance enforcement per liability_assessor risk findings.
 */

export type SoleProfile = "flat" | "wedge" | "block_heel" | "stiletto" | "platform" | "sport";
export type ToeShape = "round" | "square" | "pointed" | "open";
export type PrintMaterial = "tpu" | "pla" | "abs" | "resin_standard" | "resin_flex" | "nylon";

export interface DesignInput {
  silhouette_id: string;
  colorway_id: string;
  sole_profile: SoleProfile;
  toe_shape: ToeShape;
  us_size: number;
}

export interface ValidationResult {
  valid: boolean;
  rejection_reason?: string;
  auto_corrections?: Record<string, unknown>;
}

// FDM/SLA hard limits
const MIN_WALL_THICKNESS_MM = 2.0;
const MAX_OVERHANG_ANGLE_DEG = 45;

// Overhang angle (degrees) produced by each sole profile geometry
const SOLE_PROFILE_OVERHANG: Record<SoleProfile, number> = {
  flat: 0,
  wedge: 20,
  block_heel: 35,
  stiletto: 75, // exceeds 45° hard limit
  platform: 10,
  sport: 15,
};

// Minimum structural sole thickness (mm) required per sole profile
const SOLE_PROFILE_MIN_THICKNESS_MM: Record<SoleProfile, number> = {
  flat: 3,
  wedge: 4,
  block_heel: 6,
  stiletto: 8,
  platform: 5,
  sport: 4,
};

// Minimum wall thickness (mm) at the narrowest cross-section per toe shape
const TOE_SHAPE_MIN_WALL_MM: Record<ToeShape, number> = {
  round: 3.0,
  square: 2.5,
  pointed: 1.5, // below 2 mm — auto-correctable to round
  open: 2.0,
};

// Silhouette load-bearing category for structural checks
const SILHOUETTE_CATEGORY: Record<string, string> = {
  // Certified sneaker silhouettes
  "a1b2c3d4-0001-4000-8000-000000000001": "sneaker",
  "a1b2c3d4-0001-4000-8000-000000000002": "sneaker",
  "a1b2c3d4-0001-4000-8000-000000000003": "sneaker",
  // Certified boot silhouettes
  "a1b2c3d4-0002-4000-8000-000000000001": "boot",
  "a1b2c3d4-0002-4000-8000-000000000002": "boot",
  // Certified sandal silhouettes
  "a1b2c3d4-0003-4000-8000-000000000001": "sandal",
  "a1b2c3d4-0003-4000-8000-000000000002": "sandal",
  // Certified loafer silhouettes
  "a1b2c3d4-0004-4000-8000-000000000001": "loafer",
  // Certified oxford silhouettes
  "a1b2c3d4-0005-4000-8000-000000000001": "oxford",
  // Certified flat silhouettes
  "a1b2c3d4-0006-4000-8000-000000000001": "flat",
  // Certified mule silhouettes
  "a1b2c3d4-0007-4000-8000-000000000001": "mule",
  // Certified heel silhouettes
  "a1b2c3d4-0008-4000-8000-000000000001": "heel",
};

// CPSC/ASTM compliance-certified silhouettes (Set for O(1) lookup)
const CERTIFIED_SILHOUETTES = new Set<string>(Object.keys(SILHOUETTE_CATEGORY));

// Minimum structural load sole thickness (mm) by silhouette category
const CATEGORY_MIN_SOLE_MM: Record<string, number> = {
  sneaker: 6,
  boot: 8,
  sandal: 4,
  loafer: 6,
  oxford: 7,
  flat: 4,
  mule: 5,
  heel: 5,
};

// High-brittleness materials incompatible with high-stress heel geometries
const BRITTLE_MATERIALS: PrintMaterial[] = ["resin_standard", "pla"];
const HIGH_STRESS_PROFILES: SoleProfile[] = ["block_heel", "stiletto"];

// Colorway IDs encode material as a prefix segment: "{material}_{color}_{uuid-suffix}"
function extractMaterial(colorwayId: string): PrintMaterial | null {
  const materials: PrintMaterial[] = [
    "resin_standard",
    "resin_flex",
    "nylon",
    "tpu",
    "pla",
    "abs",
  ];
  const lower = colorwayId.toLowerCase();
  for (const mat of materials) {
    if (lower.startsWith(mat + "_") || lower.includes("_" + mat + "_")) {
      return mat;
    }
  }
  return null;
}

// Approximate foot length in mm from US men's size (for load-scaling)
function usSizeToFootLengthMM(usSize: number): number {
  return 220 + (usSize - 6) * 8.47;
}

export function validateDesign(input: DesignInput): ValidationResult {
  const { silhouette_id, colorway_id, sole_profile, toe_shape, us_size } = input;

  // --- 1. CPSC/ASTM compliance certification gate (hard block) ---
  if (!CERTIFIED_SILHOUETTES.has(silhouette_id)) {
    return {
      valid: false,
      rejection_reason:
        `Silhouette '${silhouette_id}' has not received CPSC/ASTM compliance certification. ` +
        "Only certified silhouettes may enter the print queue.",
    };
  }

  // --- 2. US size range guard ---
  if (us_size < 4 || us_size > 16) {
    return {
      valid: false,
      rejection_reason:
        `US size ${us_size} is outside the supported print range (4–16). Custom sizing requires manual review.`,
    };
  }

  // --- 3. FDM/SLA overhang angle constraint ---
  const overhangDeg = SOLE_PROFILE_OVERHANG[sole_profile];
  if (overhangDeg > MAX_OVERHANG_ANGLE_DEG) {
    return {
      valid: false,
      rejection_reason:
        `Sole profile '${sole_profile}' requires an overhang angle of ${overhangDeg}°, which exceeds the ` +
        `FDM/SLA printability limit of ${MAX_OVERHANG_ANGLE_DEG}°. Support structures cannot compensate ` +
        "at this angle without compromising surface finish.",
    };
  }

  // --- 4. Minimum wall thickness constraint (with auto-correction for pointed toe) ---
  const toeWallMM = TOE_SHAPE_MIN_WALL_MM[toe_shape];
  const autoCorrections: Record<string, unknown> = {};

  if (toeWallMM < MIN_WALL_THICKNESS_MM) {
    if (toe_shape === "pointed") {
      autoCorrections.toe_shape = "round";
      autoCorrections.wall_thickness_correction_mm = MIN_WALL_THICKNESS_MM;
      autoCorrections.reason =
        `Pointed toe produces a ${toeWallMM}mm wall — below the ${MIN_WALL_THICKNESS_MM}mm FDM minimum. ` +
        "Toe geometry auto-corrected to round.";
    } else {
      return {
        valid: false,
        rejection_reason:
          `Toe shape '${toe_shape}' yields a minimum wall of ${toeWallMM}mm, below the required ` +
          `${MIN_WALL_THICKNESS_MM}mm for FDM/SLA printing.`,
      };
    }
  }

  // --- 5. Sole-profile structural load capacity vs. silhouette category ---
  const category = SILHOUETTE_CATEGORY[silhouette_id];

  if (sole_profile === "stiletto" && category !== "heel") {
    return {
      valid: false,
      rejection_reason:
        `Stiletto sole profile is structurally incompatible with '${category}' silhouettes. ` +
        "Load distribution requires a heel silhouette.",
    };
  }

  if (sole_profile === "platform" && category === "flat") {
    return {
      valid: false,
      rejection_reason:
        "Platform sole profile is incompatible with flat silhouettes — exceeds structural height constraints.",
    };
  }

  // Size scaling: sizes ≥ 12 require 15% more structural thickness
  const sizeMultiplier = us_size >= 12 ? 1.15 : 1.0;
  const requiredSoleMM =
    Math.max(
      SOLE_PROFILE_MIN_THICKNESS_MM[sole_profile],
      CATEGORY_MIN_SOLE_MM[category] ?? 5
    ) * sizeMultiplier;

  // Sole profile minimum vs structural minimum cross-check
  const providedSoleMM = SOLE_PROFILE_MIN_THICKNESS_MM[sole_profile];
  if (providedSoleMM < requiredSoleMM) {
    return {
      valid: false,
      rejection_reason:
        `Sole profile '${sole_profile}' provides ${providedSoleMM}mm of structural thickness, but ` +
        `US size ${us_size} with a '${category}' silhouette requires ≥ ${requiredSoleMM.toFixed(1)}mm.`,
    };
  }

  // Extra guard: stiletto + large sizes exceed printed heel stress tolerance
  const footLengthMM = usSizeToFootLengthMM(us_size);
  if (sole_profile === "stiletto" && footLengthMM > 277) {
    return {
      valid: false,
      rejection_reason:
        `US size ${us_size} (foot ~${Math.round(footLengthMM)}mm) exceeds stiletto stress tolerance. ` +
        "Maximum supported size for stiletto sole profiles is US 10.",
    };
  }

  // --- 6. Colorway-material compatibility check ---
  const material = extractMaterial(colorway_id);
  if (material !== null) {
    const isBrittle = (BRITTLE_MATERIALS as string[]).includes(material);
    const isHighStress = (HIGH_STRESS_PROFILES as string[]).includes(sole_profile);
    if (isBrittle && isHighStress) {
      return {
        valid: false,
        rejection_reason:
          `Material '${material}' (from colorway '${colorway_id}') is incompatible with '${sole_profile}' ` +
          "sole profile. High-stress heel geometries require flexible materials (TPU or Nylon) to meet " +
          "ASTM F2913 impact-resistance standards.",
      };
    }
  }

  // --- All checks passed ---
  if (Object.keys(autoCorrections).length > 0) {
    return { valid: true, auto_corrections: autoCorrections };
  }

  return { valid: true };
}
