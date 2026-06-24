"use client";

import { useState, useCallback, useEffect } from "react";
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

function ShoePreview({
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

  // Heel heights by sole profile
  const heelH: Record<SoleProfile, number> = {
    flat: 8,
    wedge: 24,
    block_heel: 40,
    stiletto: 60,
    platform: 20,
    sport: 12,
  };

  // Toe tip by toe shape
  const toeR: Record<ToeShape, string> = {
    round: "50% 50% 0 0 / 60% 60% 0 0",
    square: "4px 4px 0 0",
    pointed: "50% 50% 0 0 / 80% 80% 0 0",
    open: "4px 4px 0 0",
  };

  const heel = heelH[soleProfile];

  return (
    <div
      aria-label={`Shoe preview: ${silhouette?.name ?? "silhouette"} in ${colorway?.name ?? "colorway"}`}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "360px",
        margin: "0 auto",
        height: "200px",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      {/* Sole */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "10%",
          right: "10%",
          height: "18px",
          backgroundColor: secondary,
          borderRadius: "0 0 12px 12px",
        }}
      />
      {/* Heel block */}
      <div
        style={{
          position: "absolute",
          bottom: "18px",
          right: "12%",
          width: "18%",
          height: `${heel}px`,
          backgroundColor: secondary,
          borderRadius: "2px",
        }}
      />
      {/* Upper body */}
      <div
        style={{
          position: "absolute",
          bottom: "18px",
          left: "10%",
          right: soleProfile === "stiletto" ? "28%" : "18%",
          height: "90px",
          backgroundColor: primary,
          borderRadius: toeR[toeShape],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.7rem",
          color: "#fff",
          fontWeight: 600,
          textShadow: "0 1px 2px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        {silhouette?.name ?? "Select silhouette"}
      </div>
      {/* Open-toe cutout */}
      {toeShape === "open" && (
        <div
          style={{
            position: "absolute",
            bottom: "28px",
            left: "10%",
            width: "20%",
            height: "50px",
            backgroundColor: "#f9fafb",
            borderRadius: "0 0 0 50%",
          }}
        />
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
