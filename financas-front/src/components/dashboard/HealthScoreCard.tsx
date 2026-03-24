import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { Transaction, BankAccount } from '../../types';
import { calculateHealthMetrics, SCORE_COLOR, STATUS_COLORS, STATUS_LABELS } from '../../lib/healthMetrics';

// ─── Gauge circular SVG ────────────────────────────────────────────────────────

function ScoreGauge({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75; // 270° do arco
  const filled = arc * (score / 100);
  const color = SCORE_COLOR(score);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[135deg]">
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={8}
        className="stroke-slate-200 dark:stroke-slate-700"
        strokeDasharray={`${arc} ${circ - arc}`} strokeLinecap="round" />
      {/* Fill */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={8}
        stroke={color}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }} />
    </svg>
  );
}

// ─── HealthScoreCard ──────────────────────────────────────────────────────────

interface Props {
  transactions: Transaction[];
  accounts: BankAccount[];
  onNavigate: () => void;
}

export function HealthScoreCard({ transactions, accounts, onNavigate }: Props) {
  const metrics = useMemo(
    () => calculateHealthMetrics(transactions, accounts),
    [transactions, accounts],
  );

  const worst = [...metrics.indicators].sort((a, b) => a.score - b.score).slice(0, 3);

  const statusBg =
    metrics.score >= 75 ? 'from-emerald-500/10 to-emerald-600/5 border-emerald-200/50 dark:border-emerald-800/50' :
    metrics.score >= 50 ? 'from-blue-500/10 to-blue-600/5 border-blue-200/50 dark:border-blue-800/50' :
    metrics.score >= 25 ? 'from-amber-500/10 to-amber-600/5 border-amber-200/50 dark:border-amber-800/50' :
                          'from-red-500/10 to-red-600/5 border-red-200/50 dark:border-red-800/50';

  if (!metrics.hasEnoughData) {
    return (
      <div
        onClick={onNavigate}
        className="cursor-pointer rounded-2xl border bg-white/60 dark:bg-slate-900/60 p-5 flex items-center gap-4 hover:shadow-md transition-all"
      >
        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-slate-800 flex items-center justify-center text-2xl">🫀</div>
        <div>
          <p className="font-bold text-blue-900 dark:text-slate-100 text-sm">Saúde Financeira</p>
          <p className="text-xs text-blue-400 dark:text-slate-500 mt-0.5">Adicione transações para calcular seu score.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onNavigate}
      className={cn(
        'cursor-pointer rounded-2xl border bg-gradient-to-br p-5 hover:shadow-lg transition-all duration-200 group',
        statusBg,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 dark:text-slate-500">Saúde Financeira</p>
          <p className="font-bold text-blue-900 dark:text-slate-100 mt-0.5">{metrics.statusLabel}</p>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/60 dark:bg-slate-800/60 text-blue-600 dark:text-blue-400 group-hover:underline">
          Ver análise →
        </span>
      </div>

      {/* Score + gauge */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative shrink-0">
          <ScoreGauge score={metrics.score} size={80} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black text-blue-900 dark:text-slate-100 leading-none">{metrics.score}</span>
            <span className="text-[9px] font-semibold text-blue-400 dark:text-slate-500 leading-none">/ 100</span>
          </div>
        </div>

        {/* Mini indicators */}
        <div className="flex-1 space-y-1.5">
          {worst.map(ind => {
            const col = STATUS_COLORS[ind.status];
            return (
              <div key={ind.key} className="flex items-center gap-2">
                <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', {
                  'bg-emerald-500': ind.status === 'excellent',
                  'bg-blue-500': ind.status === 'good',
                  'bg-amber-500': ind.status === 'warning',
                  'bg-red-500': ind.status === 'critical',
                })} />
                <span className="text-[11px] text-blue-700 dark:text-slate-300 flex-1 truncate">{ind.label}</span>
                <span className={cn('text-[11px] font-bold', col.text)}>{ind.displayValue}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${metrics.score}%`, backgroundColor: SCORE_COLOR(metrics.score) }}
        />
      </div>

      {/* Status labels */}
      <div className="flex justify-between text-[9px] font-semibold text-blue-300 dark:text-slate-600 mt-1">
        <span>Vulnerável</span><span>Atenção</span><span>Equilíbrio</span><span>Saudável</span>
      </div>
    </div>
  );
}
