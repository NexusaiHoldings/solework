"use client";

import { useState, useCallback, useEffect, useMemo, Suspense, Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls, Center } from "@react-three/drei";
import type { ShoeSilhouette, ShoeColorway } from "@/lib/shoes/design-sessions";

interface PriceBreakdown {
  materialName: string;
  baseCostCents: number;
  tierName: string;
  tierAddCents: number;
  totalCostCents: number;
  marginPct: number;
  sellPriceCents: number;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

const SOLE_PROFILES = [
  { value: "flat", label: "Flat" },
  { value: "wedge", label: "Wedge" },
  { value: "block_heel", label: "Block Heel" },
  { value: "stiletto", label: "Stiletto" },
  { value: "platform", label: "Platform" },
  { value: "sport", label: "Sport" },
] as const;

const TOE_SHAPES = [
  { value: "round", label: "Round" },
  { value: "square", label: "Square" },
  { value: "pointed", label: "Pointed" },
  { value: "open", label: "Open" },
] as const;

const US_SIZES = Array.from({ length: 25 }, (_, k) => 4 + k * 0.5); // 4–16

type SoleProfile = (typeof SOLE_PROFILES)[number]["value"];
type ToeShape = (typeof TOE_SHAPES)[number]["value"];

interface DesignState {
  silhouetteId: string;
  colorwayId: string;
  soleProfile: SoleProfile;
  toeShape: ToeShape;
  usSize: number;
}

interface ValidationResult {
  valid: boolean;
  rejection_reason?: string;
  auto_corrections?: Record<string, unknown>;
}

interface SaveResult {
  id: string;
  status: "pending" | "valid" | "rejected";
}

interface Props {
  silhouettes: ShoeSilhouette[];
  colorways: ShoeColorway[];
}

function ShoePreview2D({
  silhouette,
  colorway,
  soleProfile,
  toeShape,
}: {
  silhouette: ShoeSilhouette | undefined;
  colorway: ShoeColorway | undefined;
  soleProfile: SoleProfile;
  toeShape: ToeShape;
}): React.ReactElement {
  const primary = colorway?.hexPrimary ?? "#cbd5e1";
  const secondary = colorway?.hexSecondary ?? "#94a3b8";

  // Sole geometry by profile: outsole thickness + rear heel lift (px, in the
  // 0..200 viewBox). A recognizable side-profile sneaker is drawn as SVG and
  // recolored from the selected colorway, rather than abstract boxes.
  const soleGeo: Record<SoleProfile, { sole: number; heel: number }> = {
    flat: { sole: 14, heel: 2 },
    wedge: { sole: 14, heel: 20 },
    block_heel: { sole: 12, heel: 34 },
    stiletto: { sole: 8, heel: 50 },
    platform: { sole: 30, heel: 6 },
    sport: { sole: 16, heel: 4 },
  };
  const { sole, heel } = soleGeo[soleProfile] ?? { sole: 16, heel: 4 };

  const baseY = 176; // ground line in the viewBox
  const soleTopFront = baseY - sole; // outsole top near the toe
  const ub = soleTopFront - 2; // upper sits just above the sole

  // Toe termination (front of the upper) by toe shape.
  const toeTip =
    toeShape === "pointed"
      ? `Q330 ${ub - 14} 326 ${ub} Q322 ${ub + 1} 306 ${ub}`
      : toeShape === "square"
      ? `L312 ${ub - 24} L312 ${ub} L306 ${ub}`
      : toeShape === "open"
      ? `Q318 ${ub - 18} 304 ${ub - 7} L290 ${ub}`
      : `Q322 ${ub - 20} 314 ${ub - 6} Q310 ${ub} 298 ${ub}`; // round

  return (
    <div style={{ width: "100%", maxWidth: "360px", margin: "0 auto" }}>
      <svg
        viewBox="0 0 360 200"
        role="img"
        aria-label={`Shoe preview: ${silhouette?.name ?? "silhouette"} in ${colorway?.name ?? "colorway"}`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {/* rear heel lift wedge for heeled profiles */}
        {heel > 6 && (
          <path
            d={`M76 ${baseY} L76 ${baseY - heel} Q126 ${baseY - heel} 156 ${soleTopFront} L156 ${baseY} Z`}
            fill={secondary}
          />
        )}
        {/* outsole */}
        <path
          d={`M62 ${baseY} Q46 ${baseY} 48 ${baseY - sole} L304 ${soleTopFront - 2} Q344 ${soleTopFront - 4} 340 ${soleTopFront + sole - 6} Q338 ${baseY} 316 ${baseY} Z`}
          fill={secondary}
        />
        {/* midsole highlight */}
        <path
          d={`M64 ${baseY - sole + 3} L324 ${soleTopFront + 1}`}
          stroke="#ffffff"
          strokeOpacity="0.55"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        {/* upper */}
        <path
          d={`M64 ${ub}
              L62 ${ub - 58}
              Q62 ${ub - 74} 84 ${ub - 74}
              L108 ${ub - 72}
              Q136 ${ub - 90} 162 ${ub - 64}
              L190 ${ub - 40}
              Q248 ${ub - 46} 300 ${ub - 18}
              ${toeTip}
              L64 ${ub} Z`}
          fill={primary}
        />
        {/* ankle collar opening */}
        <ellipse cx="96" cy={ub - 70} rx="22" ry="9" fill={secondary} fillOpacity="0.85" />
        {/* accent swoosh */}
        <path
          d={`M156 ${ub - 6} Q216 ${ub - 30} 296 ${ub - 18}`}
          stroke={secondary}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
        />
        {/* laces */}
        {[0, 1, 2].map((i) => (
          <line
            key={i}
            x1={156 + i * 18}
            y1={ub - 64 + i * 6}
            x2={172 + i * 18}
            y2={ub - 50 + i * 6}
            stroke="#ffffff"
            strokeOpacity="0.85"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#6b7280", marginTop: "0.5rem" }}>
        {silhouette?.name ?? "Select a silhouette"} · {colorway?.name ?? "colorway"}
      </p>
    </div>
  );
}

// ── Real 3D preview (generative-3d-rendering-001) ──────────────────────────────
// Loads the silhouette's GLTF mesh (shoe_silhouettes.mesh_url) and tints it with the
// selected colorway. If the mesh isn't generated yet (mesh_url 404 / absent), the
// ErrorBoundary falls back to the 2D SVG preview — the studio never breaks.
type PreviewProps = {
  silhouette: ShoeSilhouette | undefined;
  colorway: ShoeColorway | undefined;
  soleProfile: SoleProfile;
  toeShape: ToeShape;
};

class PreviewErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* swallow — fall back to the 2D preview */
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Shoe3DModel({ meshUrl, primary }: { meshUrl: string; primary: string }): React.ReactElement {
  const { scene } = useGLTF(meshUrl);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o: unknown) => {
      const mesh = o as { isMesh?: boolean; material?: { clone: () => unknown; color?: { set: (h: string) => void } } };
      if (mesh.isMesh && mesh.material) {
        const m = mesh.material.clone() as { color?: { set: (h: string) => void } };
        if (m.color) m.color.set(primary);
        (mesh as { material: unknown }).material = m;
      }
    });
    return c;
  }, [scene, primary]);
  return <primitive object={cloned} />;
}

function ShoePreview(props: PreviewProps): React.ReactElement {
  const meshUrl = props.silhouette?.meshUrl;
  const primary = props.colorway?.hexPrimary ?? "#cbd5e1";
  const fallback = <ShoePreview2D {...props} />;
  // No mesh URL → don't even mount the Canvas; show the 2D preview.
  if (!meshUrl) return fallback;
  return (
    <div style={{ width: "100%", maxWidth: 360, margin: "0 auto", height: 240 }}>
      <PreviewErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <Canvas camera={{ position: [0, 0.4, 2.6], fov: 40 }} dpr={[1, 2]}>
            <ambientLight intensity={0.8} />
            <directionalLight position={[3, 5, 3]} intensity={1.0} />
            <directionalLight position={[-3, 2, -2]} intensity={0.4} />
            <Center>
              <Shoe3DModel meshUrl={meshUrl} primary={primary} />
            </Center>
            <OrbitControls enablePan={false} autoRotate autoRotateSpeed={1.0} />
          </Canvas>
        </Suspense>
      </PreviewErrorBoundary>
    </div>
  );
}

export default function StudioClient({ silhouettes, colorways }: Props): React.ReactElement {
  const defaultSilhouette = silhouettes[0]?.id ?? "";
  const defaultColorway = colorways[0]?.id ?? "";

  const [design, setDesign] = useState<DesignState>({
    silhouetteId: defaultSilhouette,
    colorwayId: defaultColorway,
    soleProfile: "sport",
    toeShape: "round",
    usSize: 9,
  });

  const [phase, setPhase] = useState<"configure" | "validating" | "validated" | "saving" | "saved" | "error">(
    "configure"
  );
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [savedSession, setSavedSession] = useState<SaveResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  const activeSilhouette = silhouettes.find((s) => s.id === design.silhouetteId);
  const activeColorway = colorways.find((c) => c.id === design.colorwayId);

  const fetchPrice = useCallback(async (silhouetteId: string, colorwayId: string) => {
    if (!silhouetteId || !colorwayId) return;
    setPriceLoading(true);
    try {
      const res = await fetch("/api/shoes/pricing/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ silhouetteId, colorwayId }),
      });
      if (res.ok) {
        const data = (await res.json()) as PriceBreakdown;
        setPriceBreakdown(data);
      } else {
        setPriceBreakdown(null);
      }
    } catch {
      setPriceBreakdown(null);
    } finally {
      setPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (design.silhouetteId && design.colorwayId) {
      void fetchPrice(design.silhouetteId, design.colorwayId);
    }
  }, [design.silhouetteId, design.colorwayId, fetchPrice]);

  const handleChange = useCallback(
    <K extends keyof DesignState>(field: K, value: DesignState[K]) => {
      setDesign((prev) => ({ ...prev, [field]: value }));
      setPhase("configure");
      setValidation(null);
    },
    []
  );

  const handleValidate = useCallback(async () => {
    setPhase("validating");
    setErrorMsg("");
    try {
      const res = await fetch("/api/shoes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          silhouette_id: design.silhouetteId,
          colorway_id: design.colorwayId,
          sole_profile: design.soleProfile,
          toe_shape: design.toeShape,
          us_size: design.usSize,
        }),
      });
      const data = (await res.json()) as ValidationResult;
      setValidation(data);
      setPhase("validated");
    } catch {
      setErrorMsg("Validation request failed — please try again.");
      setPhase("error");
    }
  }, [design]);

  const handleSave = useCallback(async () => {
    setPhase("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/shoes/design-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          silhouette_id: design.silhouetteId,
          colorway_id: design.colorwayId,
          sole_profile: design.soleProfile,
          toe_shape: design.toeShape,
          us_size: design.usSize,
        }),
      });
      if (res.status === 401) {
        window.location.href = "/login?next=/studio";
        return;
      }
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Save failed");
      }
      const data = (await res.json()) as SaveResult;
      setSavedSession(data);
      setPhase("saved");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Save failed — please try again.");
      setPhase("error");
    }
  }, [design]);

  const isReady = design.silhouetteId && design.colorwayId;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "start" }}>
      {/* Left: preview panel */}
      <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Preview</h2>
        <ShoePreview
          silhouette={activeSilhouette}
          colorway={activeColorway}
          soleProfile={design.soleProfile}
          toeShape={design.toeShape}
        />
        <div style={{ marginTop: "1.25rem", fontSize: "0.875rem" }}>
          <p style={{ margin: "0.25rem 0" }}>
            <strong>{activeSilhouette?.name ?? "—"}</strong>
          </p>
          <p className="muted" style={{ margin: "0.25rem 0" }}>
            {activeColorway?.name ?? "—"} · {activeColorway?.materialType ?? ""}
          </p>
          <p className="muted" style={{ margin: "0.25rem 0" }}>
            {design.soleProfile.replace("_", " ")} sole · {design.toeShape} toe · US {design.usSize}
          </p>
          {activeColorway && (
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "0.75rem" }}>
              <div
                title={`Primary: ${activeColorway.hexPrimary}`}
                style={{ width: 24, height: 24, borderRadius: "50%", background: activeColorway.hexPrimary, border: "2px solid #e5e7eb" }}
              />
              <div
                title={`Secondary: ${activeColorway.hexSecondary}`}
                style={{ width: 24, height: 24, borderRadius: "50%", background: activeColorway.hexSecondary, border: "2px solid #e5e7eb" }}
              />
            </div>
          )}

          {/* Estimated price panel */}
          <div style={{ marginTop: "1rem", borderTop: "1px solid #e5e7eb", paddingTop: "0.75rem" }}>
            {priceLoading ? (
              <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>Computing price…</p>
            ) : priceBreakdown ? (
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 0.2rem", fontSize: "0.75rem", color: "#6b7280" }}>
                  Estimated price
                </p>
                <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#1d4ed8" }}>
                  {formatCents(priceBreakdown.sellPriceCents)}
                </p>
                <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.72rem" }}>
                  Material {formatCents(priceBreakdown.baseCostCents)} + {priceBreakdown.tierName} tier {formatCents(priceBreakdown.tierAddCents)} · {priceBreakdown.marginPct.toFixed(0)}% margin
                </p>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>Select silhouette and colorway to see price.</p>
            )}
          </div>
        </div>

        {/* Validation / save feedback */}
        {phase === "validating" && (
          <p className="muted" style={{ marginTop: "1rem" }}>Checking printability…</p>
        )}
        {phase === "validated" && validation && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              borderRadius: "0.5rem",
              background: validation.valid ? "#f0fdf4" : "#fef2f2",
              color: validation.valid ? "#15803d" : "#dc2626",
              fontSize: "0.875rem",
              textAlign: "left",
            }}
          >
            {validation.valid ? (
              <>
                <strong>Design is printable ✓</strong>
                {validation.auto_corrections && Object.keys(validation.auto_corrections).length > 0 && (
                  <p style={{ margin: "0.4rem 0 0", color: "#92400e" }}>
                    Auto-corrected: {Object.keys(validation.auto_corrections).join(", ")}
                  </p>
                )}
              </>
            ) : (
              <>
                <strong>Cannot print</strong>
                <p style={{ margin: "0.4rem 0 0" }}>{validation.rejection_reason}</p>
              </>
            )}
          </div>
        )}
        {phase === "saving" && (
          <p className="muted" style={{ marginTop: "1rem" }}>Saving your design…</p>
        )}
        {phase === "saved" && savedSession && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              borderRadius: "0.5rem",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontSize: "0.875rem",
              textAlign: "left",
            }}
          >
            <strong>Design saved!</strong>
            <p style={{ margin: "0.4rem 0 0" }}>
              Session ID: <code style={{ fontSize: "0.75rem" }}>{savedSession.id}</code>
            </p>
            <a href="/orders" className="btn" style={{ display: "inline-block", marginTop: "0.5rem" }}>
              View my orders →
            </a>
          </div>
        )}
        {phase === "error" && errorMsg && (
          <p style={{ marginTop: "1rem", color: "#dc2626", fontSize: "0.875rem" }}>{errorMsg}</p>
        )}
      </div>

      {/* Right: configurator panel */}
      <div>
        {silhouettes.length === 0 ? (
          <div className="empty">
            <p>No shoe silhouettes are configured yet. An admin must add silhouettes before the studio is ready.</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="silhouette" style={{ fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>
                Silhouette
              </label>
              <select
                id="silhouette"
                value={design.silhouetteId}
                onChange={(e) => handleChange("silhouetteId", e.target.value)}
                style={{ width: "100%" }}
              >
                {silhouettes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{!s.complianceCertified ? " (not certified)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="colorway" style={{ fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>
                Colorway &amp; Material
              </label>
              <select
                id="colorway"
                value={design.colorwayId}
                onChange={(e) => handleChange("colorwayId", e.target.value)}
                style={{ width: "100%" }}
              >
                {colorways.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.materialType}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Sole Profile</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                {SOLE_PROFILES.map((sp) => (
                  <button
                    key={sp.value}
                    type="button"
                    onClick={() => handleChange("soleProfile", sp.value)}
                    className={design.soleProfile === sp.value ? "btn" : "btn secondary"}
                    style={{ fontSize: "0.8rem", padding: "0.4rem 0.25rem" }}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Toe Shape</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
                {TOE_SHAPES.map((ts) => (
                  <button
                    key={ts.value}
                    type="button"
                    onClick={() => handleChange("toeShape", ts.value)}
                    className={design.toeShape === ts.value ? "btn" : "btn secondary"}
                    style={{ fontSize: "0.8rem", padding: "0.4rem 0.25rem" }}
                  >
                    {ts.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="us-size" style={{ fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>
                US Size — {design.usSize}
              </label>
              <select
                id="us-size"
                value={design.usSize}
                onChange={(e) => handleChange("usSize", parseFloat(e.target.value))}
                style={{ width: "100%" }}
              >
                {US_SIZES.map((sz) => (
                  <option key={sz} value={sz}>
                    US {sz}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn secondary"
                onClick={handleValidate}
                disabled={!isReady || phase === "validating" || phase === "saving"}
              >
                Check printability
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleSave}
                disabled={
                  !isReady ||
                  phase === "validating" ||
                  phase === "saving" ||
                  (phase === "validated" && validation !== null && !validation.valid)
                }
              >
                Save design
              </button>
            </div>
            <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
              Saving creates a design session. You can then request a print from your orders page.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
