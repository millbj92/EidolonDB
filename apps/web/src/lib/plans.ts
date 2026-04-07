export type PlanName = 'free' | 'pro' | 'team' | 'enterprise';

export type PlanLimits = {
  memories: number;
  queries: number;
  apiKeys: number;
};

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free: { memories: 10_000, queries: 1_000, apiKeys: 1 },
  pro: { memories: 500_000, queries: 100_000, apiKeys: 10 },
  team: { memories: Number.POSITIVE_INFINITY, queries: 1_000_000, apiKeys: 50 },
  enterprise: { memories: Number.POSITIVE_INFINITY, queries: Number.POSITIVE_INFINITY, apiKeys: 500 },
};

export function toPlanName(plan: string | null | undefined): PlanName {
  if (plan === 'pro' || plan === 'team' || plan === 'enterprise') {
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
