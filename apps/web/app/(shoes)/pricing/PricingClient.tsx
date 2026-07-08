"use client";

import { useState, useEffect, useCallback } from "react";

interface PrintMaterial {
  id: string;
  name: string;
  slug: string;
  baseCostCents: number;
  isActive: boolean;
}

interface SilhouetteTier {
  id: string;
  silhouetteId: string;
  silhouetteName: string;
  tierName: string;
  priceAddCents: number;
}

interface PricingRule {
  id: string;
  scopeKey: string;
  marginBps: number;
}

interface PriceBreakdown {
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

interface Silhouette {
  id: string;
  name: string;
}

interface Colorway {
  id: string;
  name: string;
  materialType: string;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function PricingPage(): React.ReactElement {
  const [materials, setMaterials] = useState<PrintMaterial[]>([]);
  const [tiers, setTiers] = useState<SilhouetteTier[]>([]);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [silhouettes, setSilhouettes] = useState<Silhouette[]>([]);
  const [colorways, setColorways] = useState<Colorway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [editMaterialId, setEditMaterialId] = useState<string | null>(null);
  const [editMaterialCost, setEditMaterialCost] = useState("");
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState("");
  const [newMaterialSlug, setNewMaterialSlug] = useState("");
  const [newMaterialCost, setNewMaterialCost] = useState("");
  const [addMaterialError, setAddMaterialError] = useState("");
  const [editTierId, setEditTierId] = useState<string | null>(null);
  const [editTierName, setEditTierName] = useState("");
  const [editTierPrice, setEditTierPrice] = useState("");
  const [editMarginBps, setEditMarginBps] = useState("");
  const [editingMargin, setEditingMargin] = useState(false);

  const [calcSilhouetteId, setCalcSilhouetteId] = useState("");
  const [calcColorwayId, setCalcColorwayId] = useState("");
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState("");

  const globalRule = rules.find((r) => r.scopeKey === "global");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cfgRes, silRes, colRes] = await Promise.all([
        fetch("/api/shoes/pricing"),
        fetch("/api/shoes/design-sessions/silhouettes"),
        fetch("/api/shoes/design-sessions/colorways"),
      ]);
      if (!cfgRes.ok) throw new Error("Failed to load pricing config");
      const cfg = (await cfgRes.json()) as {
        materials: PrintMaterial[];
        tiers: SilhouetteTier[];
        rules: PricingRule[];
      };
      setMaterials(cfg.materials ?? []);
      setTiers(cfg.tiers ?? []);
      setRules(cfg.rules ?? []);
      if (silRes.ok) {
        const silData = (await silRes.json()) as { silhouettes: Silhouette[] };
        setSilhouettes(silData.silhouettes ?? []);
        if (!calcSilhouetteId && silData.silhouettes[0]) {
          setCalcSilhouetteId(silData.silhouettes[0].id);
        }
      }
      if (colRes.ok) {
        const colData = (await colRes.json()) as { colorways: Colorway[] };
        setColorways(colData.colorways ?? []);
        if (!calcColorwayId && colData.colorways[0]) {
          setCalcColorwayId(colData.colorways[0].id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pricing data");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const flash = (msg: string) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const saveMaterialCost = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/shoes/pricing/materials/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseCostCents: parseInt(editMaterialCost, 10) }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Update failed");
      }
      setEditMaterialId(null);
      flash("Material cost updated.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update material");
    } finally {
      setSaving(false);
    }
  }, [editMaterialCost, loadData]);

  const saveTier = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/shoes/pricing/tiers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierName: editTierName,
          priceAddCents: parseInt(editTierPrice, 10),
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Update failed");
      }
      setEditTierId(null);
      flash("Silhouette tier updated.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tier");
    } finally {
      setSaving(false);
    }
  }, [editTierName, editTierPrice, loadData]);

  const saveMargin = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/shoes/pricing/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marginBps: parseInt(editMarginBps, 10) }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Update failed");
      }
      setEditingMargin(false);
      flash("Margin target updated.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update margin");
    } finally {
      setSaving(false);
    }
  }, [editMarginBps, loadData]);

  const computePrice = useCallback(async () => {
    if (!calcSilhouetteId || !calcColorwayId) return;
    setCalcLoading(true);
    setCalcError("");
    setBreakdown(null);
    try {
      const res = await fetch("/api/shoes/pricing/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ silhouetteId: calcSilhouetteId, colorwayId: calcColorwayId }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Compute failed");
      }
      const data = (await res.json()) as PriceBreakdown;
      setBreakdown(data);
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : "Price compute failed");
    } finally {
      setCalcLoading(false);
    }
  }, [calcSilhouetteId, calcColorwayId]);

  const slugify = (text: string): string =>
    text
      .toLowerCase()
      .replace(/\+/g, "_plus")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  const addMaterial = useCallback(async () => {
    setAddMaterialError("");
    const costCents = parseInt(newMaterialCost, 10);
    if (!newMaterialName.trim()) {
      setAddMaterialError("Material name is required.");
      return;
    }
    if (!newMaterialSlug.trim() || !/^[a-z0-9_]+$/.test(newMaterialSlug)) {
      setAddMaterialError("Slug must be lowercase alphanumeric with underscores only.");
      return;
    }
    if (isNaN(costCents) || costCents < 0) {
      setAddMaterialError("Base cost must be a non-negative number (in cents).");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/shoes/pricing/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMaterialName.trim(),
          slug: newMaterialSlug.trim(),
          baseCostCents: costCents,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to create material");
      }
      setShowAddMaterial(false);
      setNewMaterialName("");
      setNewMaterialSlug("");
      setNewMaterialCost("");
      flash("Material added.");
      await loadData();
    } catch (err) {
      setAddMaterialError(err instanceof Error ? err.message : "Failed to add material");
    } finally {
      setSaving(false);
    }
  }, [newMaterialName, newMaterialSlug, newMaterialCost, loadData]);

  return (
    <main>
      <h1>Pricing Model</h1>
      <p>
        Configure material base costs, silhouette tier uplifts, and target margin. The pricing
        resolver uses these values to compute sell prices in the configurator and at checkout.
      </p>

      {error && (
        <p style={{ color: "#dc2626", background: "#fef2f2", padding: "0.75rem", borderRadius: "0.5rem", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {error}
        </p>
      )}
      {saveMsg && (
        <p style={{ color: "#16a34a", background: "#f0fdf4", padding: "0.75rem", borderRadius: "0.5rem", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {saveMsg}
        </p>
      )}

      {loading ? (
        <p className="muted">Loading pricing configuration…</p>
      ) : (
        <>
          {/* Print Materials */}
          <section style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
              <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Print Material Base Costs</h2>
              {!showAddMaterial && (
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                  onClick={() => {
                    setShowAddMaterial(true);
                    setAddMaterialError("");
                    setNewMaterialName("");
                    setNewMaterialSlug("");
                    setNewMaterialCost("");
                  }}
                >
                  + Add Material
                </button>
              )}
            </div>
            <p className="muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Base manufacturing cost per material. Edit and save to update live pricing.
            </p>

            {showAddMaterial && (
              <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem", maxWidth: "560px" }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: "0.95rem" }}>New Material Data Sheet</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <div>
                    <label htmlFor="new-mat-name" style={{ display: "block", fontWeight: 600, fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                      Material Name <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      id="new-mat-name"
                      type="text"
                      placeholder="e.g. Carbon Fiber"
                      value={newMaterialName}
                      maxLength={120}
                      style={{ width: "100%" }}
                      onChange={(e) => {
                        setNewMaterialName(e.target.value);
                        if (!newMaterialSlug || newMaterialSlug === slugify(newMaterialName)) {
                          setNewMaterialSlug(slugify(e.target.value));
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="new-mat-slug" style={{ display: "block", fontWeight: 600, fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                      Slug <span style={{ color: "#dc2626" }}>*</span>
                      <span className="muted" style={{ fontWeight: 400, marginLeft: "0.4rem" }}>(lowercase, underscores)</span>
                    </label>
                    <input
                      id="new-mat-slug"
                      type="text"
                      placeholder="e.g. carbon_fiber"
                      value={newMaterialSlug}
                      maxLength={60}
                      style={{ width: "100%" }}
                      onChange={(e) => setNewMaterialSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: "0.75rem", maxWidth: "200px" }}>
                  <label htmlFor="new-mat-cost" style={{ display: "block", fontWeight: 600, fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                    Base Cost (cents) <span style={{ color: "#dc2626" }}>*</span>
                    <span className="muted" style={{ fontWeight: 400, marginLeft: "0.4rem" }}>e.g. 2200 = $22.00</span>
                  </label>
                  <input
                    id="new-mat-cost"
                    type="number"
                    min="0"
                    placeholder="2200"
                    value={newMaterialCost}
                    style={{ width: "100%" }}
                    onChange={(e) => setNewMaterialCost(e.target.value)}
                  />
                  {newMaterialCost && !isNaN(parseInt(newMaterialCost, 10)) && (
                    <p className="muted" style={{ fontSize: "0.78rem", marginTop: "0.25rem" }}>
                      = {formatCents(parseInt(newMaterialCost, 10))}
                    </p>
                  )}
                </div>
                {addMaterialError && (
                  <p style={{ color: "#dc2626", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{addMaterialError}</p>
                )}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: "0.8rem" }}
                    onClick={() => void addMaterial()}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save Material"}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ fontSize: "0.8rem" }}
                    onClick={() => { setShowAddMaterial(false); setAddMaterialError(""); }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {materials.length === 0 ? (
              <div className="empty"><p>No materials configured yet.</p></div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Material</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Slug</th>
                      <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Base Cost</th>
                      <th style={{ padding: "0.5rem 0.75rem" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((mat) => {
                      const isEditing = editMaterialId === mat.id;
                      return (
                        <tr key={mat.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500 }}>{mat.name}</td>
                          <td style={{ padding: "0.5rem 0.75rem" }}>
                            <code style={{ fontSize: "0.78rem", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                              {mat.slug}
                            </code>
                          </td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                value={editMaterialCost}
                                onChange={(e) => setEditMaterialCost(e.target.value)}
                                style={{ width: "90px", textAlign: "right" }}
                              />
                            ) : (
                              formatCents(mat.baseCostCents)
                            )}
                          </td>
                          <td style={{ padding: "0.5rem 0.75rem" }}>
                            {isEditing ? (
                              <span style={{ display: "flex", gap: "0.4rem" }}>
                                <button
                                  type="button"
                                  className="btn"
                                  style={{ fontSize: "0.78rem", padding: "0.25rem 0.5rem" }}
                                  onClick={() => void saveMaterialCost(mat.id)}
                                  disabled={saving}
                                >Save</button>
                                <button
                                  type="button"
                                  className="btn secondary"
                                  style={{ fontSize: "0.78rem", padding: "0.25rem 0.5rem" }}
                                  onClick={() => setEditMaterialId(null)}
                                >Cancel</button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn secondary"
                                style={{ fontSize: "0.78rem", padding: "0.25rem 0.5rem" }}
                                onClick={() => {
                                  setEditMaterialId(mat.id);
                                  setEditMaterialCost(String(mat.baseCostCents));
                                }}
                              >Edit</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Silhouette Tiers */}
          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Silhouette Pricing Tiers</h2>
            <p className="muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Price uplift added on top of the material cost for each silhouette tier.
            </p>
            {tiers.length === 0 ? (
              <div className="empty"><p>No silhouette tiers configured yet.</p></div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Silhouette</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Tier</th>
                      <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Price Uplift</th>
                      <th style={{ padding: "0.5rem 0.75rem" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier) => {
                      const isEditing = editTierId === tier.id;
                      return (
                        <tr key={tier.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500 }}>{tier.silhouetteName}</td>
                          <td style={{ padding: "0.5rem 0.75rem" }}>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editTierName}
                                onChange={(e) => setEditTierName(e.target.value)}
                                style={{ width: "100px" }}
                                placeholder="standard"
                              />
                            ) : (
                              <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "2px 8px", borderRadius: "9999px", fontSize: "0.78rem" }}>
                                {tier.tierName}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                value={editTierPrice}
                                onChange={(e) => setEditTierPrice(e.target.value)}
                                style={{ width: "90px", textAlign: "right" }}
                              />
                            ) : (
                              `+ ${formatCents(tier.priceAddCents)}`
                            )}
                          </td>
                          <td style={{ padding: "0.5rem 0.75rem" }}>
                            {isEditing ? (
                              <span style={{ display: "flex", gap: "0.4rem" }}>
                                <button
                                  type="button"
                                  className="btn"
                                  style={{ fontSize: "0.78rem", padding: "0.25rem 0.5rem" }}
                                  onClick={() => void saveTier(tier.id)}
                                  disabled={saving}
                                >Save</button>
                                <button
                                  type="button"
                                  className="btn secondary"
                                  style={{ fontSize: "0.78rem", padding: "0.25rem 0.5rem" }}
                                  onClick={() => setEditTierId(null)}
                                >Cancel</button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn secondary"
                                style={{ fontSize: "0.78rem", padding: "0.25rem 0.5rem" }}
                                onClick={() => {
                                  setEditTierId(tier.id);
                                  setEditTierName(tier.tierName);
                                  setEditTierPrice(String(tier.priceAddCents));
                                }}
                              >Edit</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Global Margin */}
          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Target Margin</h2>
            <p className="muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Global margin applied when computing the sell price from cost.
              Formula: <code style={{ fontSize: "0.8rem" }}>sell_price = total_cost / (1 − margin%)</code>
            </p>
            <div className="card" style={{ padding: "1.25rem", maxWidth: "360px" }}>
              {editingMargin ? (
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <label htmlFor="margin-bps" style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                    Margin (basis points)
                  </label>
                  <input
                    id="margin-bps"
                    type="number"
                    min="0"
                    max="9999"
                    value={editMarginBps}
                    onChange={(e) => setEditMarginBps(e.target.value)}
                    style={{ width: "90px", textAlign: "right" }}
                  />
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    = {(parseInt(editMarginBps || "0", 10) / 100).toFixed(1)}%
                  </span>
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                    onClick={() => void saveMargin()}
                    disabled={saving}
                  >Save</button>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                    onClick={() => setEditingMargin(false)}
                  >Cancel</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "1.5rem" }}>
                      {globalRule ? (globalRule.marginBps / 100).toFixed(1) : "—"}%
                    </p>
                    <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                      {globalRule ? `${globalRule.marginBps} basis points` : "Not set"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                    onClick={() => {
                      setEditingMargin(true);
                      setEditMarginBps(String(globalRule?.marginBps ?? 4500));
                    }}
                  >Edit</button>
                </div>
              )}
            </div>
          </section>

          {/* Price Calculator */}
          <section>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Price Calculator</h2>
            <p className="muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Preview the computed sell price for a given silhouette and colorway combination.
            </p>
            <div className="card" style={{ padding: "1.25rem", maxWidth: "480px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label htmlFor="calc-silhouette" style={{ display: "block", fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.3rem" }}>
                    Silhouette
                  </label>
                  <select
                    id="calc-silhouette"
                    value={calcSilhouetteId}
                    onChange={(e) => { setCalcSilhouetteId(e.target.value); setBreakdown(null); }}
                    style={{ width: "100%" }}
                  >
                    <option value="">— select —</option>
                    {silhouettes.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="calc-colorway" style={{ display: "block", fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.3rem" }}>
                    Colorway
                  </label>
                  <select
                    id="calc-colorway"
                    value={calcColorwayId}
                    onChange={(e) => { setCalcColorwayId(e.target.value); setBreakdown(null); }}
                    style={{ width: "100%" }}
                  >
                    <option value="">— select —</option>
                    {colorways.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.materialType})</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => void computePrice()}
                disabled={!calcSilhouetteId || !calcColorwayId || calcLoading}
              >
                {calcLoading ? "Computing…" : "Compute Price"}
              </button>

              {calcError && (
                <p style={{ color: "#dc2626", fontSize: "0.875rem", marginTop: "0.75rem" }}>{calcError}</p>
              )}

              {breakdown && (
                <div style={{ marginTop: "1rem", borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
                  <table style={{ width: "100%", fontSize: "0.875rem" }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: "0.25rem 0", color: "#6b7280" }}>
                          Material ({breakdown.materialName})
                        </td>
                        <td style={{ padding: "0.25rem 0", textAlign: "right" }}>
                          {formatCents(breakdown.baseCostCents)}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.25rem 0", color: "#6b7280" }}>
                          Tier uplift ({breakdown.tierName})
                        </td>
                        <td style={{ padding: "0.25rem 0", textAlign: "right" }}>
                          + {formatCents(breakdown.tierAddCents)}
                        </td>
                      </tr>
                      <tr style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "0.25rem 0", fontWeight: 600 }}>Total cost</td>
                        <td style={{ padding: "0.25rem 0", textAlign: "right", fontWeight: 600 }}>
                          {formatCents(breakdown.totalCostCents)}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.25rem 0", color: "#6b7280" }}>
                          Margin ({breakdown.marginPct.toFixed(1)}%)
                        </td>
                        <td style={{ padding: "0.25rem 0", textAlign: "right" }}>
                          {formatCents(breakdown.sellPriceCents - breakdown.totalCostCents)}
                        </td>
                      </tr>
                      <tr style={{ borderTop: "2px solid #111", background: "#f8fafc" }}>
                        <td style={{ padding: "0.5rem 0", fontWeight: 700, fontSize: "1rem" }}>
                          Sell price
                        </td>
                        <td style={{ padding: "0.5rem 0", textAlign: "right", fontWeight: 700, fontSize: "1.1rem", color: "#1d4ed8" }}>
                          {formatCents(breakdown.sellPriceCents)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
