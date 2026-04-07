import type { FastifyBaseLogger } from 'fastify';
import { sql } from 'drizzle-orm';
import { db, memories } from '../../common/db/index.js';
import { runLifecycle } from './service.js';

const LIFECYCLE_HOUR_UTC = 2; // Run at 2:00 AM UTC daily
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns milliseconds until the next occurrence of the target hour (UTC).
 */
function msUntilNextRun(targetHourUtc: number): number {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(targetHourUtc, 0, 0, 0);

  // If we've already passed the target hour today, schedule for tomorrow
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime() - now.getTime();
}

/**
 * Fetches all distinct tenant IDs that have at least one memory.
 */
async function getActiveTenants(): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT tenant_id FROM ${memories}
    ORDER BY tenant_id
  `);
  return (result.rows as Array<{ tenant_id: string }>).map((r) => r.tenant_id);
}

/**
 * Runs the lifecycle pipeline for all active tenants.
 */
async function runLifecycleForAllTenants(logger: FastifyBaseLogger): Promise<void> {
  logger.info('[lifecycle-scheduler] Starting scheduled lifecycle run');

  let tenants: string[];
  try {
    tenants = await getActiveTenants();
  } catch (err) {
    logger.error({ err }, '[lifecycle-scheduler] Failed to fetch active tenants');
    return;
  }

  if (tenants.length === 0) {
    logger.info('[lifecycle-scheduler] No active tenants, skipping');
    return;
  }

  logger.info(`[lifecycle-scheduler] Running lifecycle for ${tenants.length} tenant(s)`);

  for (const tenantId of tenants) {
    try {
      const result = await runLifecycle(tenantId, {
        triggeredBy: 'cron',
        logger,
      });
      logger.info(
        {
          tenantId,
          expired: result.summary.expired,
          promoted: result.summary.promoted,
          distilled: result.summary.distilled,
          archived: result.summary.archived,
          unchanged: result.summary.unchanged,
          durationMs: result.summary.durationMs,
        },
        '[lifecycle-scheduler] Tenant lifecycle complete'
      );
    } catch (err) {
      logger.error({ err, tenantId }, '[lifecycle-scheduler] Lifecycle failed for tenant');
    }
  }

  logger.info('[lifecycle-scheduler] Scheduled lifecycle run complete');
}

/**
 * Starts the lifecycle scheduler. Runs once at LIFECYCLE_HOUR_UTC UTC daily.
 * Call this after the server starts listening.
 */
export function scheduleLifecycle(logger: FastifyBaseLogger): void {
  const msUntilFirst = msUntilNextRun(LIFECYCLE_HOUR_UTC);
  const nextRun = new Date(Date.now() + msUntilFirst);

  logger.info(
    `[lifecycle-scheduler] Scheduled — next run at ${nextRun.toISOString()} (in ${Math.round(msUntilFirst / 60000)} min)`
  );

  // Wait until first scheduled time, then run every 24h
  setTimeout(() => {
    void runLifecycleForAllTenants(logger);

    setInterval(() => {
      void runLifecycleForAllTenants(logger);
    }, MS_PER_DAY);
  }, msUntilFirst);
}
