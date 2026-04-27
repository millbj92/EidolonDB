export type PlanName = 'free' | 'developer' | 'growth' | 'enterprise';

export type PlanLimits = {
  /** Memory operations per month (ingest, read, write, query, etc.) */
  opsPerMonth: number;
  apiKeys: number;
  /** Overage cost per 100k ops, in cents (0 = no overages allowed) */
  overagePer100kCents: number;
};

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free:        { opsPerMonth: 10_000,      apiKeys: 1,   overagePer100kCents: 0 },
  developer:   { opsPerMonth: 200_000,     apiKeys: 10,  overagePer100kCents: 25 },
  growth:      { opsPerMonth: 1_000_000,   apiKeys: 50,  overagePer100kCents: 10 },
  enterprise:  { opsPerMonth: Number.POSITIVE_INFINITY, apiKeys: 500, overagePer100kCents: 0 },
};

export const CAP_PLAN_LIMITS = {
  free: { plans: 0, applies: 0, projects: 0 },
  'capabilities-developer': { plans: 10000, applies: 2000, projects: 1 },
  'capabilities-team': { plans: 50000, applies: 10000, projects: 3 },
  'capabilities-enterprise': {
    plans: Number.POSITIVE_INFINITY,
    applies: Number.POSITIVE_INFINITY,
    projects: Number.POSITIVE_INFINITY,
  },
  'suite-starter': { plans: 10000, applies: 2000, projects: 1 },
  'suite-pro': { plans: 50000, applies: 10000, projects: 3 },
} as const;

export function toPlanName(plan: string | null | undefined): PlanName {
  if (plan === 'developer' || plan === 'growth' || plan === 'enterprise') {
    return plan;
  }
  return 'free';
}

export function formatLimit(limit: number): string {
  if (!Number.isFinite(limit)) {
    return 'Unlimited';
  }
  return new Intl.NumberFormat('en-US').format(limit);
}
