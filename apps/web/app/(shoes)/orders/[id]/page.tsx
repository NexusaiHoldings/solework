import type { JSX } from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { handleSession } from "@nexus/identity-and-access";
import { buildDb } from "@/lib/db";
import { buildEventBus } from "@/lib/events";
import { fetchOrderById, statusLabel, ipClearanceLabel } from "@/lib/shoes/orders";
import type { PrintJobStatus } from "@/lib/shoes/print-jobs";

interface PageProps {
  params: { id: string };
}

async function getCurrentUserId(): Promise<string | null> {
  const token = cookies().get("session_token")?.value;
  if (!token) return null;
  try {
    const result = await handleSession({
      authorizationHeader: `Bearer ${token}`,
      ctx: { db: buildDb(), events: buildEventBus() },
    });
    if (result.status !== 200 || typeof result.body !== "object" || !result.body) return null;
    const body = result.body as { user_id?: string };
    return body.user_id ?? null;
  } catch {
    return null;
  }
}

const STATUS_STEPS: PrintJobStatus[] = ["queued", "printing", "qc_hold", "shipped"];

function ProgressTimeline({ current }: { current: PrintJobStatus }): JSX.Element {
  if (current === "cancelled") {
    return (
      <div style={{ padding: "1rem", background: "#fef2f2", borderRadius: "0.5rem", color: "#dc2626" }}>
        This order has been cancelled.
      </div>
    );
  }

  const currentIdx = STATUS_STEPS.indexOf(current);

  return (
    <ol
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0",
      }}
    >
      {STATUS_STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <li
            key={step}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "1rem",
              paddingBottom: idx < STATUS_STEPS.length - 1 ? "1.5rem" : 0,
              position: "relative",
            }}
          >
            {/* Connector line */}
            {idx < STATUS_STEPS.length - 1 && (
              <div
                style={{
                  position: "absolute",
                  left: "11px",
                  top: "24px",
                  width: "2px",
                  height: "calc(100% - 8px)",
                  background: done ? "#2563eb" : "#e5e7eb",
                }}
              />
            )}
            {/* Step dot */}
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: done ? "#2563eb" : active ? "#3b82f6" : "#e5e7eb",
                border: active ? "3px solid #93c5fd" : "none",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.7rem",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              {done ? "✓" : idx + 1}
            </div>
            <div style={{ paddingTop: "2px" }}>
              <p
                style={{
                  margin: 0,
                  fontWeight: active || done ? 600 : 400,
                  color: active ? "#1d4ed8" : done ? "#374151" : "#9ca3af",
                  fontSize: "0.9rem",
                }}
              >
                {statusLabel(step)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default async function OrderDetailPage({ params }: PageProps): Promise<JSX.Element> {
  const userId = await getCurrentUserId();
  if (!userId) redirect(`/login?next=/orders/${params.id}`);

  const order = await fetchOrderById(params.id, userId);
  if (!order) notFound();

  return (
    <main>
      <nav style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
        <a href="/orders" className="muted">
          ← Back to orders
        </a>
      </nav>

      <h1 style={{ marginBottom: "0.25rem" }}>
        {order.silhouetteName} — {order.colorwayName}
      </h1>
      <p className="muted">
        Order #{order.orderId.slice(0, 8).toUpperCase()} ·{" "}
        {new Date(order.createdAt).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
          marginTop: "1.5rem",
        }}
      >
        {/* Design details */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Design</h2>
          <table style={{ width: "100%", fontSize: "0.875rem" }}>
            <tbody>
              <tr>
                <td className="muted" style={{ paddingBottom: "0.5rem", paddingRight: "1rem" }}>Silhouette</td>
                <td style={{ paddingBottom: "0.5rem" }}>{order.silhouetteName}</td>
              </tr>
              <tr>
                <td className="muted" style={{ paddingBottom: "0.5rem", paddingRight: "1rem" }}>Colorway</td>
                <td style={{ paddingBottom: "0.5rem" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        background: order.colorwayHexPrimary,
                        border: "1px solid #e5e7eb",
                      }}
                    />
                    {order.colorwayName}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="muted" style={{ paddingBottom: "0.5rem", paddingRight: "1rem" }}>Sole profile</td>
                <td style={{ paddingBottom: "0.5rem", textTransform: "capitalize" }}>
                  {order.soleProfile.replace("_", " ")}
                </td>
              </tr>
              <tr>
                <td className="muted" style={{ paddingBottom: "0.5rem", paddingRight: "1rem" }}>Toe shape</td>
                <td style={{ paddingBottom: "0.5rem", textTransform: "capitalize" }}>{order.toeShape}</td>
              </tr>
              <tr>
                <td className="muted" style={{ paddingRight: "1rem" }}>US size</td>
                <td>{order.usSize}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Status timeline */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Order status</h2>
          <ProgressTimeline current={order.status} />

          {order.printerFarmJobId && (
            <p className="muted" style={{ fontSize: "0.78rem", marginTop: "1.25rem", marginBottom: 0 }}>
              Printer job: <code>{order.printerFarmJobId}</code>
            </p>
          )}
          {order.dispatchedAt && (
            <p className="muted" style={{ fontSize: "0.78rem", margin: "0.25rem 0 0" }}>
              Dispatched:{" "}
              {new Date(order.dispatchedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
          {order.shippedAt && (
            <p className="muted" style={{ fontSize: "0.78rem", margin: "0.25rem 0 0" }}>
              Shipped:{" "}
              {new Date(order.shippedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}

          {order.status !== "shipped" && order.status !== "cancelled" && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.6rem 0.875rem",
                background: "#f8fafc",
                borderRadius: "0.375rem",
                fontSize: "0.8rem",
              }}
            >
              <strong>IP clearance:</strong>{" "}
              <span style={{ color: order.ipClearanceStatus === "cleared" ? "#16a34a" : order.ipClearanceStatus === "rejected" ? "#dc2626" : "#92400e" }}>
                {ipClearanceLabel(order.ipClearanceStatus)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <a href="/orders" className="btn secondary">
          ← Back to all orders
        </a>
      </div>
    </main>
  );
}
