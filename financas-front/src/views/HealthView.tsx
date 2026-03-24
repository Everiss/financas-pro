import React, { useMemo } from 'react';
import { cn, formatCurrency } from '../lib/utils';
import { Transaction, BankAccount } from '../types';
import {
  calculateHealthMetrics,
  HealthIndicator,
  SCORE_COLOR,
  STATUS_COLORS,
  STATUS_LABELS,
} from '../lib/healthMetrics';

// ─── Gauge ────────────────────────────────────────────────────────────────────

function BigGauge({ score }: { score: number }) {
  const size = 160;
  const r = 68;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const filled = arc * (score / 100);
  const color = SCORE_COLOR(score);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[135deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={12}
        className="stroke-slate-200 dark:stroke-slate-700"
        strokeDasharray={`${arc} ${circ - arc}`} strokeLinecap="round" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={12}
        stroke={color}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }} />
    </svg>
  );
}

function MiniGauge({ score, size = 52 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const filled = arc * (score / 100);
  const color = SCORE_COLOR(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[135deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={5}
        className="stroke-slate-200 dark:stroke-slate-700"
        strokeDasharray={`${arc} ${circ - arc}`} strokeLinecap="round" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={5}
        stroke={color}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round" />
    </svg>
  );
}

// ─── IndicatorCard ────────────────────────────────────────────────────────────

function IndicatorCard({ ind }: { ind: HealthIndicator }) {
  const col = STATUS_COLORS[ind.status];

  return (
    <div className={cn('rounded-2xl border p-5 flex flex-col gap-3', col.bg, col.border)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{ind.icon}</span>
          <p className="text-sm font-bold text-blue-900 dark:text-slate-100">{ind.label}</p>
        </div>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0', col.bg, col.text, col.border)}>
          {STATUS_LABELS[ind.status]}
        </span>
      </div>

      {/* Value + gauge */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <MiniGauge score={ind.score} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-black text-blue-900 dark:text-slate-100">{ind.score}</span>
          </div>
        </div>
        <div>
          <p className={cn('text-2xl font-black', col.text)}>{ind.displayValue}</p>
          <p className="text-[10px] text-blue-400 dark:text-slate-500 mt-0.5">{ind.benchmark}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${ind.score}%`, backgroundColor: SCORE_COLOR(ind.score) }}
        />
      </div>

      {/* Description */}
      <p className="text-xs text-blue-600 dark:text-slate-400 leading-relaxed">{ind.description}</p>

      {/* Tip */}
      <div className={cn('rounded-xl px-3 py-2 text-xs leading-relaxed border', col.bg, col.text, col.border)}>
        💡 {ind.tip}
      </div>
    </div>
  );
}

// ─── HealthView ───────────────────────────────────────────────────────────────

interface Props {
  transactions: Transaction[];
  accounts: BankAccount[];
}

export function HealthView({ transactions, accounts }: Props) {
  const metrics = useMemo(
    () => calculateHealthMetrics(transactions, accounts),
    [transactions, accounts],
  );

  const color = SCORE_COLOR(metrics.score);

  const statusConfig = {
    healthy:    { label: 'Saudável',       emoji: '🟢', desc: 'Suas finanças estão em ótima forma. Continue mantendo esses hábitos!' },
    balanced:   { label: 'Em equilíbrio',  emoji: '🔵', desc: 'Você está no caminho certo, mas há oportunidades de melhora.' },
    attention:  { label: 'Atenção',        emoji: '🟡', desc: 'Alguns indicadores precisam de atenção. Foque nos pontos críticos.' },
    vulnerable: { label: 'Vulnerável',     emoji: '🔴', desc: 'Situação de risco. Priorize medidas de estabilização financeira.' },
  }[metrics.status];

  // ordena: crítico → atenção → bom → excelente
  const sortedIndicators = [...metrics.indicators].sort((a, b) => a.score - b.score);

  if (!metrics.hasEnoughData) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-20 h-20 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-4xl mb-4">🫀</div>
        <p className="text-blue-900 dark:text-slate-100 font-bold text-lg mb-2">Sem dados suficientes</p>
        <p className="text-blue-400 dark:text-slate-500 text-sm max-w-xs">
          Adicione receitas e despesas nos últimos 30 dias para calcular seus indicadores de saúde financeira.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Score geral ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-blue-100/50 dark:border-slate-700/50 shadow-sm p-6">
        <div className="flex flex-col md:flex-row items-center gap-8">

          {/* Gauge + número */}
          <div className="relative shrink-0">
            <BigGauge score={metrics.score} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span className="text-4xl font-black text-blue-900 dark:text-slate-100 leading-none">{metrics.score}</span>
              <span className="text-xs font-semibold text-blue-400 dark:text-slate-500">/ 100</span>
            </div>
          </div>

          {/* Status + breakdown */}
          <div className="flex-1 w-full">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">{statusConfig.emoji}</span>
              <h2 className="text-2xl font-black text-blue-900 dark:text-slate-100">{statusConfig.label}</h2>
            </div>
            <p className="text-sm text-blue-500 dark:text-slate-400 mb-5">{statusConfig.desc}</p>

            {/* Barra de progresso com rótulos */}
            <div className="space-y-1 mb-4">
              <div className="h-3 rounded-full bg-gradient-to-r from-red-400 via-amber-400 via-blue-400 to-emerald-400 relative overflow-hidden opacity-30" />
              <div className="relative h-3 -mt-4">
                <div
                  className="absolute top-0 h-3 rounded-full transition-all duration-700"
                  style={{ width: `${metrics.score}%`, backgroundColor: color, opacity: 0.9 }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-semibold text-blue-300 dark:text-slate-600">
                <span>0 Vulnerável</span><span>25 Atenção</span><span>50 Equilíbrio</span><span>75 Saudável</span><span>100</span>
              </div>
            </div>

            {/* Grid de pesos */}
            <div className="grid grid-cols-3 gap-2">
              {metrics.indicators.map(ind => (
                <div key={ind.key} className="flex items-center gap-1.5">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', {
                    'bg-emerald-500': ind.status === 'excellent',
                    'bg-blue-500': ind.status === 'good',
                    'bg-amber-500': ind.status === 'warning',
                    'bg-red-500': ind.status === 'critical',
                  })} />
                  <span className="text-[11px] text-blue-600 dark:text-slate-400 truncate">{ind.label}</span>
                  <span className="text-[11px] font-bold text-blue-900 dark:text-slate-200 ml-auto">{ind.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo financeiro */}
          <div className="shrink-0 flex flex-col gap-3 min-w-[160px]">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-center">
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Receita / mês</p>
              <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(metrics.monthlyIncome)}</p>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-center">
              <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Despesa / mês</p>
              <p className="text-lg font-black text-red-700 dark:text-red-300">{formatCurrency(metrics.monthlyExpenses)}</p>
            </div>
            <div className={cn('rounded-xl border px-4 py-3 text-center',
              metrics.monthlyIncome > metrics.monthlyExpenses
                ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
            )}>
              <p className="text-[10px] font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Saldo / mês</p>
              <p className={cn('text-lg font-black',
                metrics.monthlyIncome > metrics.monthlyExpenses
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-amber-700 dark:text-amber-300'
              )}>
                {formatCurrency(metrics.monthlyIncome - metrics.monthlyExpenses)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Indicadores ─────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-bold text-blue-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span>Indicadores detalhados</span>
          <span className="text-xs font-normal text-blue-400 dark:text-slate-500">— ordenados do mais crítico ao melhor</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedIndicators.map(ind => (
            <IndicatorCard key={ind.key} ind={ind} />
          ))}
        </div>
      </div>

      {/* ── Metodologia ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-blue-100/50 dark:border-slate-700/50 p-5">
        <h4 className="text-sm font-bold text-blue-900 dark:text-slate-100 mb-3">📚 Metodologia</h4>
        <p className="text-xs text-blue-500 dark:text-slate-400 leading-relaxed">
          O score de saúde financeira é calculado com base em 6 indicadores ponderados, inspirados nos frameworks{' '}
          <strong>I-SFB (Febraban + Banco Central do Brasil)</strong>,{' '}
          <strong>FinHealth Score® (Financial Health Network)</strong> e{' '}
          <strong>CFPB Financial Well-Being Scale</strong>. Os pesos são:{' '}
          Reserva de Emergência (25%), Taxa de Poupança (20%), Endividamento — DTI (20%),
          Utilização de Crédito (15%), Índice de Liquidez (10%) e Comprometimento de Renda (10%).
          Os dados são calculados com base nas transações dos últimos 30 dias e nos saldos atuais das contas.
        </p>
      </div>

    </div>
  );
}
