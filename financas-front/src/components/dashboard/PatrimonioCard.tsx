import React, { useMemo } from 'react';
import { cn, formatCurrency } from '../../lib/utils';
import { Icons } from '../Icons';
import { Transaction, BankAccount } from '../../types';

export function PatrimonioCard({ accounts, transactions }: { accounts: BankAccount[]; transactions: Transaction[] }) {
  const stats = useMemo(() => {
    const contasCorrentes = accounts
      .filter(a => a.type === 'checking' || a.type === 'savings')
      .reduce((s, a) => s + a.balance, 0);

    const investimentos = accounts
      .filter(a => a.type === 'investment')
      .reduce((s, a) => s + a.balance, 0);

    const faturas = accounts
      .filter(a => a.type === 'credit')
      .reduce((s, a) => s + Math.max(0, a.balance), 0);

    const limiteTotal = accounts
      .filter(a => a.type === 'credit' && (a.creditLimit ?? 0) > 0)
      .reduce((s, a) => s + (a.creditLimit ?? 0), 0);

    const limiteDisponivel = Math.max(0, limiteTotal - faturas);
    const usoPercent = limiteTotal > 0 ? (faturas / limiteTotal) * 100 : 0;

    return { contasCorrentes, investimentos, faturas, limiteTotal, limiteDisponivel, usoPercent, patrimonio: contasCorrentes + investimentos - faturas };
  }, [accounts, transactions]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 text-white shadow-xl shadow-blue-900/20 p-6">
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
        <Icons.Wallet className="w-56 h-56" />
      </div>
      <div className="relative z-10">
        <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-1">Patrimônio Líquido</p>
        <h2 className={cn('text-5xl font-bold tracking-tight mb-1', stats.patrimonio >= 0 ? 'text-white' : 'text-red-300')}>
          {formatCurrency(stats.patrimonio)}
        </h2>
        <p className="text-blue-300/60 text-xs font-medium mb-6">Contas + Investimentos − Faturas abertas</p>

        {/* Tiles: Contas, Investimentos, Cartões */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Contas e Poupança */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/15 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Icons.Wallet className="w-4 h-4 text-blue-300 shrink-0" />
              <span className="text-[10px] font-bold text-blue-200/70 uppercase tracking-wider">Contas e Poupança</span>
            </div>
            <p className="text-lg font-bold text-white">{formatCurrency(stats.contasCorrentes)}</p>
          </div>

          {/* Investimentos */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/15 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Icons.TrendingUp className="w-4 h-4 text-blue-300 shrink-0" />
              <span className="text-[10px] font-bold text-blue-200/70 uppercase tracking-wider">Investimentos</span>
            </div>
            <p className="text-lg font-bold text-white">{formatCurrency(stats.investimentos)}</p>
          </div>

          {/* Cartões de Crédito — tile especial com barra */}
          {stats.limiteTotal > 0 && (
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/15 transition-colors col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <Icons.CreditCard className="w-4 h-4 text-blue-300 shrink-0" />
                <span className="text-[10px] font-bold text-blue-200/70 uppercase tracking-wider">Cartões de Crédito</span>
              </div>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className={cn('text-lg font-bold leading-none', stats.faturas > 0 ? 'text-red-300' : 'text-white')}>
                    {formatCurrency(stats.faturas)}
                    <span className="text-[10px] font-semibold text-blue-200/50 ml-1">utilizado</span>
                  </p>
                  <p className="text-[11px] text-blue-200/60 font-medium mt-0.5">
                    de {formatCurrency(stats.limiteTotal)} no limite
                  </p>
                </div>
                <span className={cn('text-xs font-bold', stats.usoPercent > 80 ? 'text-red-300' : stats.usoPercent > 50 ? 'text-amber-300' : 'text-emerald-300')}>
                  {stats.usoPercent.toFixed(0)}%
                </span>
              </div>
              {/* Barra de uso */}
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', stats.usoPercent > 80 ? 'bg-red-400' : stats.usoPercent > 50 ? 'bg-amber-400' : 'bg-emerald-400')}
                  style={{ width: `${Math.min(stats.usoPercent, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-blue-200/50 font-medium mt-1.5">
                Disponível: <span className="text-emerald-300 font-bold">{formatCurrency(stats.limiteDisponivel)}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
