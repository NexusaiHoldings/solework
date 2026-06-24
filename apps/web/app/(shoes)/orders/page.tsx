import type { JSX } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { handleSession } from "@nexus/identity-and-access";
import { buildDb } from "@/lib/db";
import { buildEventBus } from "@/lib/events";
import { fetchUserOrders, statusLabel, ipClearanceLabel } from "@/lib/shoes/orders";
import type { PrintJobStatus } from "@/lib/shoes/print-jobs";

export const metadata = {
  title: "My Orders — Solework",
  description: "Track the status of your custom 3D-printed shoe orders.",
};

function statusBadgeStyle(status: PrintJobStatus): React.CSSProperties {
  const map: Record<PrintJobStatus, React.CSSProperties> = {
    queued: { background: "#f1f5f9", color: "#475569" },
    printing: { background: "#eff6ff", color: "#1d4ed8" },
    qc_hold: { background: "#fffbeb", color: "#b45309" },
    shipped: { background: "#f0fdf4", color: "#16a34a" },
    cancelled: { background: "#fef2f2", color: "#dc2626" },
  };
  return map[status] ?? { background: "#f1f5f9", color: "#475569" };
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

export default async function OrdersPage(): Promise<JSX.Element> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/orders");

  const orders = await fetchUserOrders(userId);

  return (
    <main>
      <h1>My Orders</h1>
      <p>Track the status of your custom 3D-printed shoe orders.</p>

      <div style={{ marginBottom: "1rem" }}>
        <a href="/studio" className="btn secondary">
          + Design a new pair
        </a>
      </div>

      {orders.length === 0 ? (
        <div className="empty">
          <p>You have no orders yet.</p>
          <a href="/studio" className="btn" style={{ display: "inline-block", marginTop: "0.75rem" }}>
            Start designing
          </a>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
          {orders.map((order) => (
            <a
              key={order.printJobId}
              href={`/orders/${order.printJobId}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="card"
                style={{
                  padding: "1.25rem",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "1rem",
                  alignItems: "start",
                  cursor: "pointer",
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>
                    {order.silhouetteName} — {order.colorwayName}
                  </h3>
                  <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.875rem" }}>
                    US {order.usSize} · {order.soleProfile.replace("_", " ")} sole · {order.toeShape} toe
                  </p>
                  <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                    Order #{order.orderId.slice(0, 8).toUpperCase()} ·{" "}
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                  <span
                    style={{
                      ...statusBadgeStyle(order.status),
                      padding: "3px 10px",
                      borderRadius: "9999px",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {statusLabel(order.status)}
                  </span>
                  {order.status !== "shipped" && order.status !== "cancelled" && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        fontSize: "0.72rem",
                        background: "#f1f5f9",
                        color: "#64748b",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ipClearanceLabel(order.ipClearanceStatus)}
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
