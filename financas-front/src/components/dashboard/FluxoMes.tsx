import React, { useMemo } from 'react';
import { cn, formatCurrency } from '../../lib/utils';
import { Icons } from '../Icons';
import { Card } from '../ui';
import { Transaction } from '../../types';
import { subMonths } from '../../lib/constants';
import { StatCard } from './DashboardStats';

export function FluxoMes({ transactions, month }: { transactions: Transaction[]; month: Date }) {
  const stats = useMemo(() => {
    const filterByMonth = (txs: Transaction[], m: Date) =>
      txs.filter(t => {
        const d = t.date.toDate();
        return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
      });
    const prevMonth = subMonths(month, 1);
    const monthTxs = filterByMonth(transactions, month);
    const prevTxs = filterByMonth(transactions, prevMonth);
    const income = monthTxs.filter(t => t.type === 'income' && !t.isTransfer).reduce((a, t) => a + t.amount, 0);
    const expense = monthTxs.filter(t => t.type === 'expense' && !t.isTransfer).reduce((a, t) => a + t.amount, 0);
    const prevIncome = prevTxs.filter(t => t.type === 'income' && !t.isTransfer).reduce((a, t) => a + t.amount, 0);
    const prevExpense = prevTxs.filter(t => t.type === 'expense' && !t.isTransfer).reduce((a, t) => a + t.amount, 0);
    const calcTrend = (curr: number, prev: number) => prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);
    return { income, expense, resultado: income - expense, incomeTrend: calcTrend(income, prevIncome), expenseTrend: calcTrend(expense, prevExpense) };
  }, [transactions, month]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard title="Receitas" amount={stats.income} icon="ArrowUpRight" color="emerald" trend={stats.incomeTrend} />
      <StatCard title="Despesas" amount={stats.expense} icon="ArrowDownLeft" color="red" trend={stats.expenseTrend} />
      <Card className="relative overflow-hidden border-none shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-blue-900/60 dark:text-slate-400">Resultado do Mês</p>
          <div className={cn('p-2.5 rounded-2xl', stats.resultado >= 0 ? 'text-emerald-600 bg-emerald-50/50' : 'text-red-600 bg-red-50/50')}>
            {stats.resultado >= 0 ? <Icons.ArrowUpRight className="w-5 h-5" /> : <Icons.ArrowDownLeft className="w-5 h-5" />}
          </div>
        </div>
        <h4 className={cn('text-3xl font-bold tracking-tight', stats.resultado >= 0 ? 'text-emerald-600' : 'text-red-600')}>
          {stats.resultado >= 0 ? '+' : ''}{formatCurrency(stats.resultado)}
        </h4>
        <p className="text-xs font-medium text-blue-400 dark:text-slate-500 mt-1.5">
          {stats.resultado >= 0 ? 'Saldo positivo no mês' : 'Déficit no mês'}
        </p>
      </Card>
    </div>
  );
}
