/**
 * Order-status tracker — fetches print jobs joined with design session details.
 * Feature: Order-status tracker (CR-001).
 */
import { Pool } from "pg";
import type { PrintJobStatus, IpClearanceStatus } from "./print-jobs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface OrderDetail {
  printJobId: string;
  orderId: string;
  status: PrintJobStatus;
  ipClearanceStatus: IpClearanceStatus;
  printerFarmJobId: string | null;
  dispatchedAt: string | null;
  shippedAt: string | null;
  createdAt: string;
  designSessionId: string;
  silhouetteId: string;
  silhouetteName: string;
  colorwayId: string;
  colorwayName: string;
  colorwayHexPrimary: string;
  colorwayHexSecondary: string;
  soleProfile: string;
  toeShape: string;
  usSize: number;
}

type OrderRow = {
  print_job_id: string;
  order_id: string;
  status: string;
  ip_clearance_status: string;
  printer_farm_job_id: string | null;
  dispatched_at: string | null;
  shipped_at: string | null;
  print_created_at: string;
  design_session_id: string;
  silhouette_id: string;
  silhouette_name: string;
  colorway_id: string;
  colorway_name: string;
  colorway_hex_primary: string;
  colorway_hex_secondary: string;
  sole_profile: string;
  toe_shape: string;
  us_size: string;
};

function rowToOrder(row: OrderRow): OrderDetail {
  return {
    printJobId: row.print_job_id,
    orderId: row.order_id,
    status: row.status as PrintJobStatus,
    ipClearanceStatus: row.ip_clearance_status as IpClearanceStatus,
    printerFarmJobId: row.printer_farm_job_id,
    dispatchedAt: row.dispatched_at,
    shippedAt: row.shipped_at,
    createdAt: row.print_created_at,
    designSessionId: row.design_session_id,
    silhouetteId: row.silhouette_id,
    silhouetteName: row.silhouette_name,
    colorwayId: row.colorway_id,
    colorwayName: row.colorway_name,
    colorwayHexPrimary: row.colorway_hex_primary,
    colorwayHexSecondary: row.colorway_hex_secondary,
    soleProfile: row.sole_profile,
    toeShape: row.toe_shape,
    usSize: parseFloat(row.us_size),
  };
}

const ORDER_SELECT = `
  SELECT pj.id            AS print_job_id,
         pj.order_id,
         pj.status,
         pj.ip_clearance_status,
         pj.printer_farm_job_id,
         pj.dispatched_at,
         pj.shipped_at,
         pj.created_at    AS print_created_at,
         ds.id            AS design_session_id,
         ss.id            AS silhouette_id,
         ss.name          AS silhouette_name,
         sc.id            AS colorway_id,
         sc.name          AS colorway_name,
         sc.hex_primary   AS colorway_hex_primary,
         sc.hex_secondary AS colorway_hex_secondary,
         ds.sole_profile,
         ds.toe_shape,
         ds.us_size
  FROM print_jobs pj
  JOIN shoe_design_sessions ds ON ds.id = pj.design_session_id
  JOIN shoe_silhouettes     ss ON ss.id = ds.silhouette_id
  JOIN shoe_colorways       sc ON sc.id = ds.colorway_id
`;

export async function fetchUserOrders(userId: string): Promise<OrderDetail[]> {
  try {
    const result = await pool.query<OrderRow>(
      `${ORDER_SELECT}
       WHERE ds.user_id = $1
       ORDER BY pj.created_at DESC`,
      [userId]
    );
    return result.rows.map(rowToOrder);
  } catch {
    return [];
  }
}

export async function fetchOrderById(
  jobId: string,
  userId: string
): Promise<OrderDetail | null> {
  try {
    const result = await pool.query<OrderRow>(
      `${ORDER_SELECT}
       WHERE pj.id = $1 AND ds.user_id = $2`,
      [jobId, userId]
    );
    if (!result.rows[0]) return null;
    return rowToOrder(result.rows[0]);
  } catch {
    return null;
  }
}

export function statusLabel(status: PrintJobStatus): string {
  const labels: Record<PrintJobStatus, string> = {
    queued: "Queued — awaiting dispatch",
    printing: "Printing",
    qc_hold: "Quality check hold",
    shipped: "Shipped",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}

export function ipClearanceLabel(status: IpClearanceStatus): string {
  const labels: Record<IpClearanceStatus, string> = {
    pending: "IP review pending",
    cleared: "IP cleared",
    rejected: "IP rejected",
  };
  return labels[status] ?? status;
}
