import { Transaction, BankAccount } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type IndicatorStatus = 'excellent' | 'good' | 'warning' | 'critical';

export interface HealthIndicator {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  unit: string;
  score: number; // 0–100
  status: IndicatorStatus;
  benchmark: string;
  description: string;
  tip: string;
  icon: string;
  weight: number; // peso no score geral
}

export interface HealthMetrics {
  score: number; // 0–100
  status: 'healthy' | 'balanced' | 'attention' | 'vulnerable';
  statusLabel: string;
  indicators: HealthIndicator[];
  monthlyIncome: number;
  monthlyExpenses: number;
  hasEnoughData: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Interpolação linear entre dois intervalos */
function lerp(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  const ratio = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + ratio * (outMax - outMin);
}

function fmtPct(v: number) {
  return `${Math.abs(v).toFixed(1)}%`;
}

function fmtMonths(v: number) {
  if (v >= 1) return `${v.toFixed(1)} meses`;
  const days = Math.round(v * 30);
  return `${days} dias`;
}

// ─── Cálculo principal ─────────────────────────────────────────────────────────

export function calculateHealthMetrics(
  transactions: Transaction[],
  accounts: BankAccount[],
): HealthMetrics {
  const now = new Date();
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
  const d90 = new Date(now); d90.setDate(d90.getDate() - 90);

  const recent = transactions.filter(t => !t.isTransfer && t.date.toDate() >= d30);
  const last90 = transactions.filter(t => !t.isTransfer && t.date.toDate() >= d90);

  const monthlyIncome   = recent.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthlyExpenses = recent.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const avg3mExpenses   = last90.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) / 3;
  const monthRef        = avg3mExpenses > 0 ? avg3mExpenses : monthlyExpenses;

  const hasEnoughData = monthlyIncome > 0 || monthlyExpenses > 0;

  const creditCards  = accounts.filter(a => a.type === 'credit');
  const loanAccounts = accounts.filter(a => a.type === 'loan');

  // ── 1. Taxa de Poupança ──────────────────────────────────────────────────────
  const savingsRate = monthlyIncome > 0
    ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100
    : 0;

  const savingsScore: number =
    savingsRate >= 20 ? 100 :
    savingsRate >= 10 ? lerp(savingsRate, 10, 20, 60, 99) :
    savingsRate >= 0  ? lerp(savingsRate, 0, 10, 20, 59)  : 0;

  const savingsStatus: IndicatorStatus =
    savingsRate >= 20 ? 'excellent' :
    savingsRate >= 10 ? 'good' :
    savingsRate >= 0  ? 'warning' : 'critical';

  // ── 2. Endividamento (DTI) ───────────────────────────────────────────────────
  const creditPayments = recent
    .filter(t => t.type === 'expense' && t.paymentMethod === 'credit')
    .reduce((s, t) => s + t.amount, 0);

  const loanPayments = recent
    .filter(t => loanAccounts.some(a => a.id === t.accountId) && t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const dti = monthlyIncome > 0
    ? ((creditPayments + loanPayments) / monthlyIncome) * 100
    : 0;

  const dtiScore: number =
    dti <= 15 ? 100 :
    dti <= 25 ? lerp(dti, 15, 25, 75, 99) :
    dti <= 36 ? lerp(dti, 25, 36, 40, 74) :
                lerp(dti, 36, 70, 0, 39);

  const dtiStatus: IndicatorStatus =
    dti <= 15 ? 'excellent' :
    dti <= 25 ? 'good' :
    dti <= 36 ? 'warning' : 'critical';

  // ── 3. Reserva de Emergência ─────────────────────────────────────────────────
  const savingsBalance  = accounts.filter(a => a.type === 'savings').reduce((s, a) => s + Math.max(0, a.balance), 0);
  const checkingBalance = accounts.filter(a => a.type === 'checking').reduce((s, a) => s + Math.max(0, a.balance), 0);
  const emergencyBase   = savingsBalance > 0 ? savingsBalance : checkingBalance * 0.5;
  const emergencyMonths = monthRef > 0 ? emergencyBase / monthRef : 0;

  const emergencyScore: number =
    emergencyMonths >= 6 ? 100 :
    emergencyMonths >= 3 ? lerp(emergencyMonths, 3, 6, 60, 99) :
    emergencyMonths >= 1 ? lerp(emergencyMonths, 1, 3, 20, 59) :
                           lerp(emergencyMonths, 0, 1, 0, 19);

  const emergencyStatus: IndicatorStatus =
    emergencyMonths >= 6 ? 'excellent' :
    emergencyMonths >= 3 ? 'good' :
    emergencyMonths >= 1 ? 'warning' : 'critical';

  // ── 4. Utilização de Crédito ─────────────────────────────────────────────────
  const totalCreditBalance = creditCards.reduce((s, a) => s + Math.max(0, a.balance), 0);
  const totalCreditLimit   = creditCards.reduce((s, a) => s + (a.creditLimit ?? 0), 0);
  const creditUtil         = totalCreditLimit > 0 ? (totalCreditBalance / totalCreditLimit) * 100 : 0;

  const creditScore: number =
    creditUtil <= 10 ? 100 :
    creditUtil <= 30 ? lerp(creditUtil, 10, 30, 70, 99) :
    creditUtil <= 70 ? lerp(creditUtil, 30, 70, 20, 69) :
                      lerp(creditUtil, 70, 100, 0, 19);

  const creditStatus: IndicatorStatus =
    creditUtil <= 10 ? 'excellent' :
    creditUtil <= 30 ? 'good' :
    creditUtil <= 70 ? 'warning' : 'critical';

  // ── 5. Índice de Liquidez ────────────────────────────────────────────────────
  const liquidBalance  = accounts.filter(a => a.type === 'checking' || a.type === 'savings').reduce((s, a) => s + Math.max(0, a.balance), 0);
  const liquidityMonths = monthRef > 0 ? liquidBalance / monthRef : 0;

  const liquidityScore: number =
    liquidityMonths >= 3   ? 100 :
    liquidityMonths >= 1   ? lerp(liquidityMonths, 1, 3, 50, 99) :
    liquidityMonths >= 0.5 ? lerp(liquidityMonths, 0.5, 1, 20, 49) :
                             lerp(liquidityMonths, 0, 0.5, 0, 19);

  const liquidityStatus: IndicatorStatus =
    liquidityMonths >= 3   ? 'excellent' :
    liquidityMonths >= 1   ? 'good' :
    liquidityMonths >= 0.5 ? 'warning' : 'critical';

  // ── 6. Comprometimento de Renda (regra 50/30/20) ─────────────────────────────
  const commitment = monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 0;

  const commitmentScore: number =
    commitment <= 50 ? 100 :
    commitment <= 65 ? lerp(commitment, 50, 65, 60, 99) :
    commitment <= 85 ? lerp(commitment, 65, 85, 20, 59) : 0;

  const commitmentStatus: IndicatorStatus =
    commitment <= 50 ? 'excellent' :
    commitment <= 65 ? 'good' :
    commitment <= 85 ? 'warning' : 'critical';

  // ── Score Geral ──────────────────────────────────────────────────────────────
  const weights = { savings: 0.20, dti: 0.20, emergency: 0.25, credit: 0.15, liquidity: 0.10, commitment: 0.10 };

  const score = Math.round(
    savingsScore    * weights.savings    +
    dtiScore        * weights.dti        +
    emergencyScore  * weights.emergency  +
    creditScore     * weights.credit     +
    liquidityScore  * weights.liquidity  +
    commitmentScore * weights.commitment,
  );

  const status =
    score >= 75 ? 'healthy' :
    score >= 50 ? 'balanced' :
    score >= 25 ? 'attention' : 'vulnerable';

  const statusLabel =
    score >= 75 ? 'Saudável' :
    score >= 50 ? 'Em equilíbrio' :
    score >= 25 ? 'Atenção' : 'Vulnerável';

  // ── Indicadores ──────────────────────────────────────────────────────────────
  const indicators: HealthIndicator[] = [
    {
      key: 'savings',
      label: 'Taxa de Poupança',
      value: savingsRate,
      displayValue: fmtPct(Math.max(0, savingsRate)),
      unit: '%',
      score: Math.round(savingsScore),
      status: savingsStatus,
      benchmark: '≥ 20% da renda (regra 20%)',
      description: 'Percentual da renda guardado após pagar todas as despesas do mês.',
      tip: savingsRate < 0
        ? 'Você está gastando mais do que ganha. Identifique e corte gastos urgentemente.'
        : savingsRate < 10
        ? 'Automatize a poupança: transfira um valor fixo no dia do pagamento antes de gastar.'
        : savingsRate < 20
        ? 'Você está no caminho certo! Pequenos ajustes podem te levar à meta de 20%.'
        : 'Excelente! Continue e diversifique: CDB, Tesouro Direto, fundos de investimento.',
      icon: '💰',
      weight: weights.savings,
    },
    {
      key: 'dti',
      label: 'Endividamento (DTI)',
      value: dti,
      displayValue: fmtPct(dti),
      unit: '%',
      score: Math.round(dtiScore),
      status: dtiStatus,
      benchmark: '< 25% da renda mensal',
      description: 'Parcela da renda comprometida com pagamentos de dívidas (cartões e empréstimos).',
      tip: dti > 36
        ? 'DTI crítico! Priorize quitar dívidas de maior juros. Considere renegociação ou consignado.'
        : dti > 25
        ? 'Evite assumir novas dívidas. Concentre esforços em quitar as atuais mais caras.'
        : 'Ótimo controle! Mantenha o DTI abaixo de 25% para ter folga financeira.',
      icon: '📊',
      weight: weights.dti,
    },
    {
      key: 'emergency',
      label: 'Reserva de Emergência',
      value: emergencyMonths,
      displayValue: fmtMonths(emergencyMonths),
      unit: 'meses',
      score: Math.round(emergencyScore),
      status: emergencyStatus,
      benchmark: '≥ 6 meses de despesas (CFPB)',
      description: 'Meses de despesas cobertos pela reserva em poupança ou conta de fácil resgate.',
      tip: emergencyMonths < 1
        ? 'Emergência! Construa 1 mês de reserva antes de qualquer outro investimento.'
        : emergencyMonths < 3
        ? 'Continue priorizando a reserva. Evite investimentos de risco até completar 3 meses.'
        : emergencyMonths < 6
        ? 'Boa reserva! A meta ideal são 6 meses para maior segurança financeira.'
        : 'Reserva completa! Valores além de 6 meses podem render mais em outros investimentos.',
      icon: '🛡️',
      weight: weights.emergency,
    },
    {
      key: 'credit',
      label: 'Utilização de Crédito',
      value: creditUtil,
      displayValue: fmtPct(creditUtil),
      unit: '%',
      score: Math.round(creditScore),
      status: creditStatus,
      benchmark: '< 30% do limite total',
      description: 'Percentual do limite total dos cartões de crédito que está sendo utilizado.',
      tip: creditUtil > 70
        ? 'Utilização muito alta! Evite novos gastos no crédito e quite os saldos o quanto antes.'
        : creditUtil > 30
        ? 'Tente manter abaixo de 30% para proteger seu score de crédito e ter margem de segurança.'
        : 'Excelente! Baixa utilização demonstra saúde e melhora seu score no Serasa/Boa Vista.',
      icon: '💳',
      weight: weights.credit,
    },
    {
      key: 'liquidity',
      label: 'Índice de Liquidez',
      value: liquidityMonths,
      displayValue: fmtMonths(liquidityMonths),
      unit: 'meses',
      score: Math.round(liquidityScore),
      status: liquidityStatus,
      benchmark: '≥ 3 meses em contas líquidas',
      description: 'Disponibilidade imediata de recursos em conta corrente e poupança.',
      tip: liquidityMonths < 0.5
        ? 'Saldo crítico! Reduza gastos imediatamente e mantenha pelo menos 2 semanas de despesas.'
        : liquidityMonths < 1
        ? 'Saldo baixo. Priorize ter pelo menos 1 mês de despesas acessível.'
        : liquidityMonths < 3
        ? 'Mantenha ao menos 3 meses de despesas acessíveis para imprevistos.'
        : 'Boa liquidez! Valores acima de 6 meses podem ser aplicados com mais rentabilidade.',
      icon: '💧',
      weight: weights.liquidity,
    },
    {
      key: 'commitment',
      label: 'Comprometimento de Renda',
      value: commitment,
      displayValue: fmtPct(commitment),
      unit: '%',
      score: Math.round(commitmentScore),
      status: commitmentStatus,
      benchmark: '< 50% (regra 50/30/20)',
      description: 'Percentual total da renda consumido por despesas no mês (ideal: 80% gastos, 20% poupança).',
      tip: commitment > 85
        ? 'Renda totalmente comprometida! Identifique gastos supérfluos e corte-os urgentemente.'
        : commitment > 65
        ? 'Gastos acima do ideal. Aplique a regra 50/30/20: necessidades, desejos e poupança.'
        : 'Bom controle! Você tem folga para poupar e investir. Continue assim.',
      icon: '📈',
      weight: weights.commitment,
    },
  ];

  return { score, status, statusLabel, indicators, monthlyIncome, monthlyExpenses, hasEnoughData };
}

// ─── Cores por status ─────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<IndicatorStatus, { bg: string; text: string; border: string; fill: string }> = {
  excellent: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', fill: '#10b981' },
  good:      { bg: 'bg-blue-50 dark:bg-blue-950/30',    text: 'text-blue-700 dark:text-blue-400',    border: 'border-blue-200 dark:border-blue-800',    fill: '#3b82f6' },
  warning:   { bg: 'bg-amber-50 dark:bg-amber-950/30',  text: 'text-amber-700 dark:text-amber-400',  border: 'border-amber-200 dark:border-amber-800',  fill: '#f59e0b' },
  critical:  { bg: 'bg-red-50 dark:bg-red-950/30',      text: 'text-red-700 dark:text-red-400',      border: 'border-red-200 dark:border-red-800',      fill: '#ef4444' },
};

export const STATUS_LABELS: Record<IndicatorStatus, string> = {
  excellent: 'Excelente',
  good:      'Bom',
  warning:   'Atenção',
  critical:  'Crítico',
};

export const SCORE_COLOR = (score: number) =>
  score >= 75 ? '#10b981' :
  score >= 50 ? '#3b82f6' :
  score >= 25 ? '#f59e0b' : '#ef4444';
