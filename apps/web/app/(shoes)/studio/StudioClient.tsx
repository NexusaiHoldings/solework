"use client";

import { useState, useCallback, useEffect, useMemo, useRef, Suspense, Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls, Bounds } from "@react-three/drei";
import { Color } from "three";
import type { ShoeSilhouette, ShoeColorway } from "@/lib/shoes/design-sessions";

// The cached parametric-mesh service (CadQuery) lives behind the Nexus runtime tunnel; it
// serves named-part GLBs CORS-enabled so we can load + recolor them cross-origin.
const RUNTIME = (process.env.NEXT_PUBLIC_RUNTIME_URL || "https://runtime.nexusaiholdings.com").replace(/\/$/, "");
const COMPANY = process.env.NEXT_PUBLIC_COMPANY_SLUG || "solework";

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

// 3D-print material → PBR surface response (matte flexible TPU vs sheen-ier rigid PLA+).
function materialPbr(materialType: string | undefined): { roughness: number; metalness: number } {
  const m = (materialType || "").toLowerCase();
  if (m.includes("tpu")) return { roughness: 0.9, metalness: 0.0 };
  if (m.includes("nylon")) return { roughness: 0.72, metalness: 0.05 };
  if (m.includes("pla")) return { roughness: 0.45, metalness: 0.08 };
  if (m.includes("petg")) return { roughness: 0.55, metalness: 0.06 };
  if (m.includes("resin")) return { roughness: 0.35, metalness: 0.05 };
  return { roughness: 0.6, metalness: 0.05 };
}

// ── Real 3D preview: load the per-config CAD GLB and recolor each named part ──────────
function Shoe3DModel({
  meshUrl,
  primary,
  secondary,
  materialType,
}: {
  meshUrl: string;
  primary: string;
  secondary: string;
  materialType: string | undefined;
}): React.ReactElement {
  const { scene } = useGLTF(meshUrl);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const upperColor = new Color(primary);
    const soleColor = new Color(secondary);
    const { roughness, metalness } = materialPbr(materialType);
    c.traverse((o: unknown) => {
      const mesh = o as {
        isMesh?: boolean;
        name?: string;
        parent?: { name?: string };
        material?: { clone: () => unknown } & Record<string, unknown>;
      };
      if (!mesh.isMesh || !mesh.material) return;
      const part = (mesh.name || mesh.parent?.name || "").toLowerCase();
      // two-tone: upper takes the primary colour, sole + toe-cap take the accent.
      const tint = part.includes("upper") ? upperColor : soleColor;
      const m = mesh.material.clone() as Record<string, unknown> & { color?: { copy: (c: Color) => void } };
      if (m.color) m.color.copy(tint);
      if ("roughness" in m) (m as { roughness: number }).roughness = roughness;
      if ("metalness" in m) (m as { metalness: number }).metalness = metalness;
      (mesh as { material: unknown }).material = m;
    });
    return c;
  }, [scene, primary, secondary, materialType]);
  return <primitive object={cloned} />;
}

class PreviewErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* swallow — show the message fallback */
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function PreviewMessage({ text }: { text: string }): React.ReactElement {
  return (
    <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p className="muted" style={{ fontSize: "0.85rem" }}>{text}</p>
    </div>
  );
}

function ShoePreview({
  meshUrl,
  loading,
  colorway,
}: {
  meshUrl: string | null;
  loading: boolean;
  colorway: ShoeColorway | undefined;
}): React.ReactElement {
  const primary = colorway?.hexPrimary ?? "#ffffff";
  const secondary = colorway?.hexSecondary ?? "#94a3b8";
  if (!meshUrl) return <PreviewMessage text={loading ? "Building your shoe…" : "Configure your shoe to preview it in 3D."} />;
  return (
    <div style={{ position: "relative", width: "100%", height: 300 }}>
      <PreviewErrorBoundary fallback={<PreviewMessage text="3D preview unavailable — your design is still saved." />}>
        <Suspense fallback={<PreviewMessage text="Building your shoe…" />}>
          <Canvas camera={{ position: [2.4, 1.4, 3.2], fov: 40 }} dpr={[1, 2]}>
            <ambientLight intensity={0.85} />
            <directionalLight position={[3, 5, 3]} intensity={1.05} />
            <directionalLight position={[-3, 2, -2]} intensity={0.45} />
            {/* Bounds auto-frames the model regardless of its size/orientation */}
            <Bounds key={meshUrl} fit clip observe margin={1.25}>
              <Shoe3DModel meshUrl={meshUrl} primary={primary} secondary={secondary} materialType={colorway?.materialType} />
            </Bounds>
            <OrbitControls makeDefault enablePan={false} autoRotate autoRotateSpeed={1.1} />
          </Canvas>
        </Suspense>
      </PreviewErrorBoundary>
      {loading && (
        <span style={{ position: "absolute", top: 8, right: 10, fontSize: "0.7rem", color: "#6b7280" }}>updating…</span>
      )}
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

  // live parametric mesh (regenerated server-side when the geometry params change)
  const [meshUrl, setMeshUrl] = useState<string | null>(null);
  const [printUrl, setPrintUrl] = useState<string | null>(null);
  const [meshLoading, setMeshLoading] = useState(false);
  const [liveChecks, setLiveChecks] = useState<ValidationResult | null>(null);

  const activeSilhouette = silhouettes.find((s) => s.id === design.silhouetteId);
  const activeColorway = colorways.find((c) => c.id === design.colorwayId);

  // ── fetch the per-config mesh (geometry depends on sole/toe/size; colour is client-side) ──
  const reqSeq = useRef(0);
  useEffect(() => {
    if (!activeSilhouette) return;
    const seq = ++reqSeq.current;
    setMeshLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${RUNTIME}/parametric/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company: COMPANY,
            silhouette: activeSilhouette.name,
            sole_profile: design.soleProfile,
            toe_shape: design.toeShape,
            us_size: design.usSize,
            material_type: activeColorway?.materialType,
          }),
        });
        if (seq !== reqSeq.current) return; // a newer request superseded this one
        if (res.ok) {
          const data = (await res.json()) as { meshUrl: string; printUrl?: string | null; checks?: ValidationResult };
          setMeshUrl(data.meshUrl);
          setPrintUrl(data.printUrl ?? null);
          if (data.checks) setLiveChecks(data.checks);
        }
      } catch {
        /* keep the previous mesh on a transient failure */
      } finally {
        if (seq === reqSeq.current) setMeshLoading(false);
      }
    }, 320);
    return () => clearTimeout(t);
    // colour/material don't change geometry, but material affects printability checks
  }, [activeSilhouette, design.soleProfile, design.toeShape, design.usSize, activeColorway?.materialType]);

  const fetchPrice = useCallback(async (silhouetteId: string, colorwayId: string) => {
    if (!silhouetteId || !colorwayId) return;
    setPriceLoading(true);
    try {
      const res = await fetch("/api/shoes/pricing/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ silhouetteId, colorwayId }),
      });
      setPriceBreakdown(res.ok ? ((await res.json()) as PriceBreakdown) : null);
    } catch {
      setPriceBreakdown(null);
    } finally {
      setPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (design.silhouetteId && design.colorwayId) void fetchPrice(design.silhouetteId, design.colorwayId);
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
      setValidation((await res.json()) as ValidationResult);
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
          print_mesh_url: printUrl || undefined,  // attach the print-ready CAD artifact
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
      setSavedSession((await res.json()) as SaveResult);
      setPhase("saved");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Save failed — please try again.");
      setPhase("error");
    }
  }, [design]);

  const isReady = design.silhouetteId && design.colorwayId;
  const printable = liveChecks?.valid ?? true;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "start" }}>
      {/* Left: live 3D preview panel */}
      <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Preview</h2>
        <ShoePreview meshUrl={meshUrl} loading={meshLoading} colorway={activeColorway} />
        <div style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
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
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "0.5rem" }}>
              <div title={`Upper: ${activeColorway.hexPrimary}`} style={{ width: 24, height: 24, borderRadius: "50%", background: activeColorway.hexPrimary, border: "2px solid #e5e7eb" }} />
              <div title={`Sole: ${activeColorway.hexSecondary}`} style={{ width: 24, height: 24, borderRadius: "50%", background: activeColorway.hexSecondary, border: "2px solid #e5e7eb" }} />
            </div>
          )}
          {liveChecks && !printable && (
            <p style={{ margin: "0.6rem 0 0", fontSize: "0.78rem", color: "#b45309" }}>
              ⚠ Not printable as configured: {liveChecks.rejection_reason}
            </p>
          )}

          <div style={{ marginTop: "1rem", borderTop: "1px solid #e5e7eb", paddingTop: "0.75rem" }}>
            {priceLoading ? (
              <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>Computing price…</p>
            ) : priceBreakdown ? (
              <div>
                <p style={{ margin: "0 0 0.2rem", fontSize: "0.75rem", color: "#6b7280" }}>Estimated price</p>
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

        {phase === "validating" && <p className="muted" style={{ marginTop: "1rem" }}>Checking printability…</p>}
        {phase === "validated" && validation && (
          <div style={{ marginTop: "1rem", padding: "0.75rem", borderRadius: "0.5rem", background: validation.valid ? "#f0fdf4" : "#fef2f2", color: validation.valid ? "#15803d" : "#dc2626", fontSize: "0.875rem", textAlign: "left" }}>
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
        {phase === "saving" && <p className="muted" style={{ marginTop: "1rem" }}>Saving your design…</p>}
        {phase === "saved" && savedSession && (
          <div style={{ marginTop: "1rem", padding: "0.75rem", borderRadius: "0.5rem", background: "#eff6ff", color: "#1d4ed8", fontSize: "0.875rem", textAlign: "left" }}>
            <strong>Design saved!</strong>
            <p style={{ margin: "0.4rem 0 0" }}>
              Session ID: <code style={{ fontSize: "0.75rem" }}>{savedSession.id}</code>
            </p>
            <a href="/orders" className="btn" style={{ display: "inline-block", marginTop: "0.5rem" }}>View my orders →</a>
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
              <label htmlFor="silhouette" style={{ fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>Silhouette</label>
              <select id="silhouette" value={design.silhouetteId} onChange={(e) => handleChange("silhouetteId", e.target.value)} style={{ width: "100%" }}>
                {silhouettes.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{!s.complianceCertified ? " (not certified)" : ""}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="colorway" style={{ fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>Colorway &amp; Material</label>
              <select id="colorway" value={design.colorwayId} onChange={(e) => handleChange("colorwayId", e.target.value)} style={{ width: "100%" }}>
                {colorways.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.materialType}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Sole Profile</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                {SOLE_PROFILES.map((sp) => (
                  <button key={sp.value} type="button" onClick={() => handleChange("soleProfile", sp.value)} className={design.soleProfile === sp.value ? "btn" : "btn secondary"} style={{ fontSize: "0.8rem", padding: "0.4rem 0.25rem" }}>{sp.label}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Toe Shape</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
                {TOE_SHAPES.map((ts) => (
                  <button key={ts.value} type="button" onClick={() => handleChange("toeShape", ts.value)} className={design.toeShape === ts.value ? "btn" : "btn secondary"} style={{ fontSize: "0.8rem", padding: "0.4rem 0.25rem" }}>{ts.label}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="us-size" style={{ fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>US Size — {design.usSize}</label>
              <select id="us-size" value={design.usSize} onChange={(e) => handleChange("usSize", parseFloat(e.target.value))} style={{ width: "100%" }}>
                {US_SIZES.map((sz) => (<option key={sz} value={sz}>US {sz}</option>))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button type="button" className="btn secondary" onClick={handleValidate} disabled={!isReady || phase === "validating" || phase === "saving"}>Check printability</button>
              <button type="button" className="btn" onClick={handleSave} disabled={!isReady || phase === "validating" || phase === "saving" || (phase === "validated" && validation !== null && !validation.valid)}>Save design</button>
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
