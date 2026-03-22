import React, { useMemo } from 'react';
import { cn, formatCurrency } from '../../lib/utils';
import { Icons, IconName } from '../Icons';
import { Card } from '../ui';
import { Transaction, BankAccount } from '../../types';
import { subMonths } from '../../lib/constants';

export function StatCard({ title, amount, icon, color, trend }: { title: string; amount: number; icon: IconName; color: 'blue' | 'emerald' | 'red'; trend?: number | null }) {
  const Icon = Icons[icon];
  const colors = {
    blue: 'text-blue-600 bg-blue-50/50',
    emerald: 'text-emerald-600 bg-emerald-50/50',
    red: 'text-red-600 bg-red-50/50',
  };

  return (
    <Card className="relative overflow-hidden group border-none shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm hover:shadow-md transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-blue-900/60 dark:text-slate-400">{title}</p>
        <div className={cn('p-2.5 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3', colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <h4 className="text-3xl font-bold tracking-tight text-blue-900 dark:text-slate-100">{formatCurrency(amount)}</h4>
        {trend !== null && trend !== undefined && (
          <div className={cn('flex items-center gap-1 mt-1.5 text-xs font-semibold', trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {trend >= 0 ? <Icons.ArrowUpRight className="w-3.5 h-3.5" /> : <Icons.ArrowDownLeft className="w-3.5 h-3.5" />}
            <span>{Math.abs(trend)}% vs mês anterior</span>
          </div>
        )}
      </div>
    </Card>
  );
}

export function DashboardStats({ transactions, accounts, month }: { transactions: Transaction[]; accounts: BankAccount[]; month: Date }) {
  const stats = useMemo(() => {
    const filterByMonth = (txs: Transaction[], m: Date) =>
      txs.filter(t => {
        const d = t.date.toDate();
        return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
      });

    const prevMonth = subMonths(month, 1);
    const monthTxs = filterByMonth(transactions, month);
    const prevTxs = filterByMonth(transactions, prevMonth);

    const income = monthTxs.filter(t => t.type === 'income' && !t.isTransfer).reduce((acc, t) => acc + t.amount, 0);
    const expense = monthTxs.filter(t => t.type === 'expense' && !t.isTransfer).reduce((acc, t) => acc + t.amount, 0);
    const prevIncome = prevTxs.filter(t => t.type === 'income' && !t.isTransfer).reduce((acc, t) => acc + t.amount, 0);
    const prevExpense = prevTxs.filter(t => t.type === 'expense' && !t.isTransfer).reduce((acc, t) => acc + t.amount, 0);

    const calcTrend = (curr: number, prev: number) =>
      prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);

    const balance = accounts.reduce((acc, a) => a.type === 'credit' ? acc - a.balance : acc + a.balance, 0);
    const invested = accounts
      .filter(a => a.type === 'investment')
      .reduce((sum, a) => sum + a.balance, 0);

    return {
      income, expense, balance, invested,
      incomeTrend: calcTrend(income, prevIncome),
      expenseTrend: calcTrend(expense, prevExpense),
    };
  }, [transactions, accounts, month]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Saldo Total" amount={stats.balance} icon="Wallet" color="blue" />
      <StatCard title="Investimentos" amount={stats.invested} icon="TrendingUp" color="blue" />
      <StatCard title="Receitas" amount={stats.income} icon="ArrowUpRight" color="emerald" trend={stats.incomeTrend} />
      <StatCard title="Despesas" amount={stats.expense} icon="ArrowDownLeft" color="red" trend={stats.expenseTrend} />
    </div>
  );
}
