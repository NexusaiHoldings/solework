"use client";

import { useState, useEffect, useCallback } from "react";

interface Silhouette {
  id: string;
  name: string;
}

interface Colorway {
  id: string;
  name: string;
  materialType: string;
}

interface SkuRow {
  id: string;
  name: string;
  silhouetteId: string;
  silhouetteName: string;
  colorwayId: string;
  colorwayName: string;
  usSize: number;
  stockQuantity: number;
  priceCents: number;
  isActive: boolean;
}

interface NewSkuForm {
  name: string;
  silhouetteId: string;
  colorwayId: string;
  usSize: string;
  stockQuantity: string;
  priceCents: string;
}

const EMPTY_FORM: NewSkuForm = {
  name: "",
  silhouetteId: "",
  colorwayId: "",
  usSize: "9",
  stockQuantity: "0",
  priceCents: "12900",
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function InventoryPage(): React.ReactElement {
  const [skus, setSkus] = useState<SkuRow[]>([]);
  const [silhouettes, setSilhouettes] = useState<Silhouette[]>([]);
  const [colorways, setColorways] = useState<Colorway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewSkuForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState<string>("");
  const [editPrice, setEditPrice] = useState<string>("");
  const [editActive, setEditActive] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [skuRes, silRes, colRes] = await Promise.all([
        fetch("/api/shoes/skus"),
        fetch("/api/shoes/design-sessions/silhouettes"),
        fetch("/api/shoes/design-sessions/colorways"),
      ]);
      if (!skuRes.ok) throw new Error("Failed to load SKUs");
      const skuData = (await skuRes.json()) as { skus: SkuRow[] };
      setSkus(skuData.skus ?? []);

      if (silRes.ok) {
        const silData = (await silRes.json()) as { silhouettes: Silhouette[] };
        setSilhouettes(silData.silhouettes ?? []);
        if (!form.silhouetteId && silData.silhouettes.length > 0) {
          setForm((f) => ({ ...f, silhouetteId: silData.silhouettes[0].id }));
        }
      }
      if (colRes.ok) {
        const colData = (await colRes.json()) as { colorways: Colorway[] };
        setColorways(colData.colorways ?? []);
        if (!form.colorwayId && colData.colorways.length > 0) {
          setForm((f) => ({ ...f, colorwayId: colData.colorways[0].id }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreate = useCallback(async () => {
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/shoes/skus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          silhouetteId: form.silhouetteId,
          colorwayId: form.colorwayId,
          usSize: parseFloat(form.usSize),
          stockQuantity: parseInt(form.stockQuantity, 10),
          priceCents: parseInt(form.priceCents, 10),
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Create failed");
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create SKU");
    } finally {
      setSaving(false);
    }
  }, [form, loadData]);

  const startEdit = useCallback((sku: SkuRow) => {
    setEditingId(sku.id);
    setEditStock(String(sku.stockQuantity));
    setEditPrice(String(sku.priceCents));
    setEditActive(sku.isActive);
  }, []);

  const handleUpdate = useCallback(
    async (skuId: string) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/shoes/skus/${skuId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stockQuantity: parseInt(editStock, 10),
            priceCents: parseInt(editPrice, 10),
            isActive: editActive,
          }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Update failed");
        }
        setEditingId(null);
        await loadData();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Failed to update SKU");
      } finally {
        setSaving(false);
      }
    },
    [editStock, editPrice, editActive, loadData]
  );

  const handleDelete = useCallback(
    async (skuId: string, skuName: string) => {
      if (!confirm(`Delete SKU "${skuName}"? This cannot be undone.`)) return;
      try {
        const res = await fetch(`/api/shoes/skus/${skuId}`, { method: "DELETE" });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Delete failed");
        }
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete SKU");
      }
    },
    [loadData]
  );

  return (
    <main>
      <h1>SKU Inventory</h1>
      <p>Admin CRUD over product SKUs and stock levels. Changes take effect immediately.</p>

      <div className="toolbar" style={{ marginBottom: "1.5rem" }}>
        <button
          type="button"
          className="btn"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancel" : "+ Add SKU"}
        </button>
        <button
          type="button"
          className="btn secondary"
          onClick={() => void loadData()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p style={{ color: "#dc2626", background: "#fef2f2", padding: "0.75rem", borderRadius: "0.5rem", fontSize: "0.875rem" }}>
          {error}
        </p>
      )}

      {/* Add SKU form */}
      {showForm && (
        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1rem" }}>New SKU</h2>
          {formError && (
            <p style={{ color: "#dc2626", fontSize: "0.875rem" }}>{formError}</p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label htmlFor="sku-name" style={{ display: "block", fontWeight: 600, marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                Display name
              </label>
              <input
                id="sku-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Runner Pro"
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label htmlFor="sku-silhouette" style={{ display: "block", fontWeight: 600, marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                Silhouette
              </label>
              <select
                id="sku-silhouette"
                value={form.silhouetteId}
                onChange={(e) => setForm((f) => ({ ...f, silhouetteId: e.target.value }))}
                style={{ width: "100%" }}
              >
                <option value="">— select —</option>
                {silhouettes.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sku-colorway" style={{ display: "block", fontWeight: 600, marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                Colorway
              </label>
              <select
                id="sku-colorway"
                value={form.colorwayId}
                onChange={(e) => setForm((f) => ({ ...f, colorwayId: e.target.value }))}
                style={{ width: "100%" }}
              >
                <option value="">— select —</option>
                {colorways.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.materialType})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sku-size" style={{ display: "block", fontWeight: 600, marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                US Size
              </label>
              <input
                id="sku-size"
                type="number"
                step="0.5"
                min="4"
                max="16"
                value={form.usSize}
                onChange={(e) => setForm((f) => ({ ...f, usSize: e.target.value }))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label htmlFor="sku-stock" style={{ display: "block", fontWeight: 600, marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                Stock quantity
              </label>
              <input
                id="sku-stock"
                type="number"
                min="0"
                value={form.stockQuantity}
                onChange={(e) => setForm((f) => ({ ...f, stockQuantity: e.target.value }))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label htmlFor="sku-price" style={{ display: "block", fontWeight: 600, marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                Price (cents, e.g. 12900 = $129)
              </label>
              <input
                id="sku-price"
                type="number"
                min="0"
                value={form.priceCents}
                onChange={(e) => setForm((f) => ({ ...f, priceCents: e.target.value }))}
                style={{ width: "100%" }}
              />
            </div>
          </div>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              className="btn"
              onClick={() => void handleCreate()}
              disabled={saving || !form.name.trim() || !form.silhouetteId || !form.colorwayId}
            >
              {saving ? "Saving…" : "Create SKU"}
            </button>
            <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading inventory…</p>
      ) : skus.length === 0 ? (
        <div className="empty">
          <p>No SKUs yet. Add the first one above.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Name</th>
                <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Silhouette</th>
                <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Colorway</th>
                <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Size</th>
                <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Stock</th>
                <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Price</th>
                <th style={{ textAlign: "center", padding: "0.5rem 0.75rem" }}>Active</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {skus.map((sku) => {
                const isEditing = editingId === sku.id;
                return (
                  <tr key={sku.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500 }}>{sku.name}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#6b7280" }}>{sku.silhouetteName}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#6b7280" }}>{sku.colorwayName}</td>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>US {sku.usSize}</td>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          value={editStock}
                          onChange={(e) => setEditStock(e.target.value)}
                          style={{ width: "70px", textAlign: "right" }}
                        />
                      ) : (
                        <span style={{ color: sku.stockQuantity === 0 ? "#dc2626" : sku.stockQuantity <= 3 ? "#d97706" : "inherit" }}>
                          {sku.stockQuantity}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          style={{ width: "90px", textAlign: "right" }}
                        />
                      ) : (
                        formatCents(sku.priceCents)
                      )}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={editActive}
                          onChange={(e) => setEditActive(e.target.checked)}
                        />
                      ) : (
                        <span style={{ color: sku.isActive ? "#16a34a" : "#9ca3af" }}>
                          {sku.isActive ? "Yes" : "No"}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      {isEditing ? (
                        <span style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: "0.78rem", padding: "0.25rem 0.5rem" }}
                            onClick={() => void handleUpdate(sku.id)}
                            disabled={saving}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn secondary"
                            style={{ fontSize: "0.78rem", padding: "0.25rem 0.5rem" }}
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            className="btn secondary"
                            style={{ fontSize: "0.78rem", padding: "0.25rem 0.5rem" }}
                            onClick={() => startEdit(sku)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn secondary"
                            style={{ fontSize: "0.78rem", padding: "0.25rem 0.5rem", color: "#dc2626" }}
                            onClick={() => void handleDelete(sku.id, sku.name)}
                          >
                            Delete
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
