import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { subscriptionApi, SubscriptionStatus } from '../services/api';

// ── Limites por plano (espelha o backend plan.config.ts) ──────────────────────

export type PlanFeature =
  | 'ai'
  | 'openFinance'
  | 'exportExcel'
  | 'multiUser';

export type PlanLimit =
  | 'transactionsPerMonth'
  | 'accounts'
  | 'goals';

export interface PlanLimits {
  transactionsPerMonth: number | null;
  accounts: number | null;
  goals: number | null;
  ai: boolean;
  openFinance: boolean;
  exportExcel: boolean;
  multiUser: boolean;
}

const LIMITS: Record<'FREE' | 'PRO' | 'FAMILY', PlanLimits> = {
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

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  ai: 'IA Financeira',
  openFinance: 'Open Finance',
  exportExcel: 'Exportar Excel',
  multiUser: 'Multi-usuário',
};

export const LIMIT_LABELS: Record<PlanLimit, string> = {
  transactionsPerMonth: 'transações por mês',
  accounts: 'contas',
  goals: 'metas',
};

// ── Contexto ──────────────────────────────────────────────────────────────────

interface PlanContextValue {
  plan: 'FREE' | 'PRO' | 'FAMILY';
  trialActive: boolean;
  trialEndsAt: string | null;
  limits: PlanLimits;
  /** Verifica se uma feature booleana está disponível */
  can: (feature: PlanFeature) => boolean;
  /** Verifica se um recurso numérico está dentro do limite (null = ilimitado) */
  withinLimit: (limit: PlanLimit, current: number) => boolean;
  /** Recarrega o status (chame após upgrade) */
  refresh: () => Promise<void>;
  loading: boolean;
}

const PlanContext = createContext<PlanContextValue>({
  plan: 'FREE',
  trialActive: false,
  trialEndsAt: null,
  limits: LIMITS.FREE,
  can: () => false,
  withinLimit: () => true,
  refresh: async () => {},
  loading: true,
});

export function PlanProvider({ children, authenticated }: { children: React.ReactNode; authenticated: boolean }) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!authenticated) { setLoading(false); return; }
    try {
      const s = await subscriptionApi.getStatus();
      setStatus(s);
    } catch {
      // usuário sem assinatura ainda — padrão FREE
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => { load(); }, [load]);

  const plan = (status?.plan ?? 'FREE') as 'FREE' | 'PRO' | 'FAMILY';
  const trialActive = status?.trialActive ?? false;

  // Durante o trial, FREE recebe limites de PRO
  const effectivePlan = (plan === 'FREE' && trialActive) ? 'PRO' : plan;
  const limits = LIMITS[effectivePlan];

  const can = useCallback((feature: PlanFeature) => limits[feature] as boolean, [limits]);

  const withinLimit = useCallback((limit: PlanLimit, current: number) => {
    const max = limits[limit];
    return max === null || current < max;
  }, [limits]);

  return (
    <PlanContext.Provider value={{
      plan,
      trialActive,
      trialEndsAt: status?.trialEndsAt ?? null,
      limits,
      can,
      withinLimit,
      refresh: load,
      loading,
    }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}
