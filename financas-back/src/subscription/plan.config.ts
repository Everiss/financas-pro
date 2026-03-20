export type PlanType = 'FREE' | 'PRO' | 'FAMILY';

export interface PlanLimits {
  transactionsPerMonth: number | null; // null = ilimitado
  accounts: number | null;
  goals: number | null;
  ai: boolean;
  openFinance: boolean;
  exportExcel: boolean;
  multiUser: boolean;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  FREE: {
    transactionsPerMonth: 50,
    accounts: 2,
    goals: 2,
    ai: false,
    openFinance: false,
    exportExcel: false,
    multiUser: false,
  },
  PRO: {
    transactionsPerMonth: null,
    accounts: null,
    goals: null,
    ai: true,
    openFinance: true,
    exportExcel: true,
    multiUser: false,
  },
  FAMILY: {
    transactionsPerMonth: null,
    accounts: null,
    goals: null,
    ai: true,
    openFinance: true,
    exportExcel: true,
    multiUser: true,
  },
};

/** Verifica se o usuário está em trial ativo */
export function isTrialActive(trialEndsAt: Date | null): boolean {
  if (!trialEndsAt) return false;
  return new Date() < new Date(trialEndsAt);
}

/** Retorna os limites efetivos (trial = PRO temporário) */
export function getEffectiveLimits(plan: PlanType, trialEndsAt: Date | null): PlanLimits {
  if (plan === 'FREE' && isTrialActive(trialEndsAt)) {
    return PLAN_LIMITS['PRO'];
  }
  return PLAN_LIMITS[plan];
}
