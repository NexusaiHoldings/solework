/**
 * Print-job dispatch pipeline — create and dispatch print jobs from confirmed designs.
 * Feature: Print-job dispatch (CR-001).
 */
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export type PrintJobStatus = "queued" | "printing" | "qc_hold" | "shipped" | "cancelled";
export type IpClearanceStatus = "pending" | "cleared" | "rejected";

export interface PrintJob {
  id: string;
  designSessionId: string;
  orderId: string;
  status: PrintJobStatus;
  ipClearanceStatus: IpClearanceStatus;
  printerFarmJobId: string | null;
  dispatchedAt: string | null;
  shippedAt: string | null;
  createdAt: string;
}

type PrintJobRow = {
  id: string;
  design_session_id: string;
  order_id: string;
  status: string;
  ip_clearance_status: string;
  printer_farm_job_id: string | null;
  dispatched_at: string | null;
  shipped_at: string | null;
  created_at: string;
};

function rowToJob(row: PrintJobRow): PrintJob {
  return {
    id: row.id,
    designSessionId: row.design_session_id,
    orderId: row.order_id,
    status: row.status as PrintJobStatus,
    ipClearanceStatus: row.ip_clearance_status as IpClearanceStatus,
    printerFarmJobId: row.printer_farm_job_id,
    dispatchedAt: row.dispatched_at,
    shippedAt: row.shipped_at,
    createdAt: row.created_at,
  };
}

export async function createPrintJob(params: {
  designSessionId: string;
  orderId: string;
}): Promise<PrintJob | null> {
  try {
    const result = await pool.query<PrintJobRow>(
      `INSERT INTO print_jobs (design_session_id, order_id)
       VALUES ($1, $2)
       RETURNING id, design_session_id, order_id, status, ip_clearance_status,
                 printer_farm_job_id, dispatched_at, shipped_at, created_at`,
      [params.designSessionId, params.orderId]
    );
    if (!result.rows[0]) return null;
    return rowToJob(result.rows[0]);
  } catch {
    return null;
  }
}

export async function dispatchPrintJob(jobId: string): Promise<PrintJob | null> {
  // Generate printer farm job reference — in production this calls the print-farm API
  const farmJobId = `PF-${Date.now()}-${jobId.slice(0, 8).toUpperCase()}`;
  try {
    const result = await pool.query<PrintJobRow>(
      `UPDATE print_jobs
       SET status               = 'printing',
           printer_farm_job_id  = $2,
           dispatched_at        = now()
       WHERE id = $1
         AND status               = 'queued'
         AND ip_clearance_status  = 'cleared'
       RETURNING id, design_session_id, order_id, status, ip_clearance_status,
                 printer_farm_job_id, dispatched_at, shipped_at, created_at`,
      [jobId, farmJobId]
    );
    if (!result.rows[0]) return null;
    return rowToJob(result.rows[0]);
  } catch {
    return null;
  }
}

export async function fetchQueuedPrintJobs(): Promise<PrintJob[]> {
  try {
    const result = await pool.query<PrintJobRow>(
      `SELECT id, design_session_id, order_id, status, ip_clearance_status,
              printer_farm_job_id, dispatched_at, shipped_at, created_at
       FROM print_jobs
       WHERE status = 'queued'
         AND ip_clearance_status = 'cleared'
       ORDER BY created_at ASC`
    );
    return result.rows.map(rowToJob);
  } catch {
    return [];
  }
}

export async function fetchPrintJobsByUser(userId: string): Promise<PrintJob[]> {
  try {
    const result = await pool.query<PrintJobRow>(
      `SELECT pj.id, pj.design_session_id, pj.order_id, pj.status,
              pj.ip_clearance_status, pj.printer_farm_job_id,
              pj.dispatched_at, pj.shipped_at, pj.created_at
       FROM print_jobs pj
       JOIN shoe_design_sessions ds ON ds.id = pj.design_session_id
       WHERE ds.user_id = $1
       ORDER BY pj.created_at DESC`,
      [userId]
    );
    return result.rows.map(rowToJob);
  } catch {
    return [];
  }
}

export async function fetchPrintJobById(jobId: string): Promise<PrintJob | null> {
  try {
    const result = await pool.query<PrintJobRow>(
      `SELECT id, design_session_id, order_id, status, ip_clearance_status,
              printer_farm_job_id, dispatched_at, shipped_at, created_at
       FROM print_jobs
       WHERE id = $1`,
      [jobId]
    );
    if (!result.rows[0]) return null;
    return rowToJob(result.rows[0]);
  } catch {
    return null;
  }
}
