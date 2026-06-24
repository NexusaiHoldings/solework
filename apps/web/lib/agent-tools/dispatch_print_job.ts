/**
 * Domain agent tool: dispatch_print_job
 *
 * Dispatches queued print jobs whose IP clearance status is 'cleared'.
 * Registered in DOMAIN_DISPATCH so the substrate's approved-actions cron
 * can invoke it via the agent runtime.
 *
 * Args:
 *   job_id (string, required) — UUID of the print_jobs row to dispatch.
 *     If omitted, dispatches ALL queued+cleared jobs (batch mode).
 */

import type { HandlerContext, HandlerResult } from "@nexus/identity-and-access";
import { dispatchPrintJob, fetchQueuedPrintJobs, fetchPrintJobById } from "@/lib/shoes/print-jobs";

type Args = Record<string, unknown>;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function handleDispatchPrintJob(
  _ctx: HandlerContext,
  args: Args
): Promise<HandlerResult> {
  const jobId = args.job_id;

  // Single-job mode: dispatch one specific job
  if (jobId !== undefined) {
    if (!isUuid(jobId)) {
      return {
        status: 400,
        body: { error: "job_id must be a valid UUID" },
      };
    }

    const existing = await fetchPrintJobById(jobId);
    if (!existing) {
      return {
        status: 404,
        body: { error: `Print job ${jobId} not found` },
      };
    }
    if (existing.status !== "queued") {
      return {
        status: 409,
        body: {
          error: `Print job ${jobId} is already in status '${existing.status}' — only queued jobs can be dispatched`,
        },
      };
    }
    if (existing.ipClearanceStatus !== "cleared") {
      return {
        status: 409,
        body: {
          error: `Print job ${jobId} IP clearance is '${existing.ipClearanceStatus}' — must be 'cleared' before dispatch`,
        },
      };
    }

    const dispatched = await dispatchPrintJob(jobId);
    if (!dispatched) {
      return {
        status: 500,
        body: { error: `Failed to dispatch print job ${jobId}` },
      };
    }

    return {
      status: 200,
      body: {
        dispatched: 1,
        jobs: [
          {
            id: dispatched.id,
            status: dispatched.status,
            printer_farm_job_id: dispatched.printerFarmJobId,
            dispatched_at: dispatched.dispatchedAt,
          },
        ],
      },
    };
  }

  // Batch mode: dispatch all queued+cleared jobs
  const queued = await fetchQueuedPrintJobs();
  if (queued.length === 0) {
    return {
      status: 200,
      body: { dispatched: 0, message: "No queued+cleared print jobs found" },
    };
  }

  const results: object[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const job of queued) {
    const dispatched = await dispatchPrintJob(job.id);
    if (dispatched) {
      successCount += 1;
      results.push({
        id: dispatched.id,
        status: dispatched.status,
        printer_farm_job_id: dispatched.printerFarmJobId,
        dispatched_at: dispatched.dispatchedAt,
      });
    } else {
      failCount += 1;
      results.push({ id: job.id, error: "dispatch failed" });
    }
  }

  return {
    status: 200,
    body: {
      dispatched: successCount,
      failed: failCount,
      total: queued.length,
      jobs: results,
    },
  };
}
