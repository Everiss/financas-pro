import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePlan, PlanFeature, PlanLimit, FEATURE_LABELS, LIMIT_LABELS } from '../contexts/PlanContext';
import { subscriptionApi } from '../services/api';

// ── UpgradeModal ──────────────────────────────────────────────────────────────

interface UpgradeModalProps {
  feature?: PlanFeature;
  limit?: PlanLimit;
  current?: number;
  max?: number;
  onClose: () => void;
}

export function UpgradeModal({ feature, limit, current, max, onClose }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const { plan } = usePlan();

  const featureLabel = feature ? FEATURE_LABELS[feature] : limit ? LIMIT_LABELS[limit] : '';
  const isLimitReached = limit !== undefined;

  const handleUpgrade = async () => {
    const priceId = import.meta.env.VITE_STRIPE_PRICE_PRO ?? '';
    if (!priceId) { alert('Configure VITE_STRIPE_PRICE_PRO no .env'); return; }
    setLoading(true);
    try {
      const { url } = await subscriptionApi.checkout(priceId);
      if (url) window.location.href = url;
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center"
          onClick={e => e.stopPropagation()}
        >
          {/* Ícone */}
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/25">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>

          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {isLimitReached ? 'Limite atingido' : 'Recurso PRO'}
          </h3>

          <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">
            {isLimitReached
              ? `Você atingiu o limite de ${max} ${featureLabel} do plano ${plan}.`
              : `${featureLabel} está disponível apenas nos planos PRO e Família.`}
          </p>

          {isLimitReached && current !== undefined && (
            <div className="my-4 bg-slate-100 dark:bg-slate-800 rounded-2xl p-3">
              <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                <span>Uso atual</span>
                <span className="text-red-500 font-bold">{current}/{max}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, ((current ?? 0) / (max ?? 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <div className="text-left space-y-2 mb-4">
              {['Transações ilimitadas', 'IA Financeira', 'Open Finance', 'Exportar Excel'].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {f}
                </div>
              ))}
            </div>

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 disabled:opacity-60 text-white font-bold py-3 rounded-2xl text-sm transition-all shadow-lg shadow-blue-500/25 hover:-translate-y-0.5 active:scale-[.98]"
            >
              {loading ? 'Aguarde...' : 'Fazer upgrade para PRO — R$ 19/mês'}
            </button>
            <button onClick={onClose} className="w-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm py-2 transition-colors">
              Continuar no plano gratuito
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── PlanGate ──────────────────────────────────────────────────────────────────

interface PlanGateProps {
  /** Feature booleana que deve estar ativa no plano */
  feature?: PlanFeature;
  /** Limite numérico a verificar */
  limit?: PlanLimit;
  /** Valor atual para verificar contra o limite */
  current?: number;
  children: React.ReactNode;
  /** Se true, mostra o conteúdo mas desabilitado, em vez de esconder */
  showLocked?: boolean;
}

/**
 * Envolve qualquer feature com controle de plano.
 *
 * Uso simples (feature booleana):
 *   <PlanGate feature="ai"><BotaoIA /></PlanGate>
 *
 * Uso com limite numérico:
 *   <PlanGate limit="accounts" current={accounts.length}><BotaoNovaContá /></PlanGate>
 */
export function PlanGate({ feature, limit, current = 0, children, showLocked = true }: PlanGateProps) {
  const { can, withinLimit, limits } = usePlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const allowed = feature
    ? can(feature)
    : limit
      ? withinLimit(limit, current)
      : true;

  if (allowed) return <>{children}</>;

  const max = limit ? limits[limit] ?? undefined : undefined;

  if (!showLocked) return null;

  return (
    <>
      <div
        className="relative cursor-pointer group"
        onClick={() => setUpgradeOpen(true)}
        title="Recurso disponível no plano PRO"
      >
        <div className="pointer-events-none opacity-50 select-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 shadow-md group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40 transition-colors">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">PRO</span>
          </div>
        </div>
      </div>
      {upgradeOpen && (
        <UpgradeModal
          feature={feature}
          limit={limit}
          current={current}
          max={max ?? undefined}
          onClose={() => setUpgradeOpen(false)}
        />
      )}
    </>
  );
}

// ── PlanBadge ─────────────────────────────────────────────────────────────────

/** Badge de plano para exibir na sidebar ou header */
export function PlanBadge() {
  const { plan, trialActive, trialEndsAt } = usePlan();

  const configs = {
    FREE: { label: 'Gratuito', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-500 dark:text-slate-400' },
    PRO: { label: 'PRO', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-600 dark:text-blue-400' },
    FAMILY: { label: 'Família', bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-600 dark:text-violet-400' },
  };

  const cfg = configs[plan];
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>
      {trialActive && daysLeft !== null ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Trial PRO · {daysLeft}d
        </>
      ) : (
        cfg.label
      )}
    </div>
  );
}
