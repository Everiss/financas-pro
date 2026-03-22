import React, { useMemo } from 'react';
import { formatCurrency } from '../lib/utils';
import { Icons } from '../components/Icons';
import { Card } from '../components/ui';
import { BankAccount, Transaction } from '../types';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';

export function InvestmentsView({ accounts, transactions }: { accounts: BankAccount[]; transactions: Transaction[] }) {
  const investmentAccounts = useMemo(() => accounts.filter(a => a.type === 'investment'), [accounts]);

  const totalInvested = useMemo(() => {
    return investmentAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  }, [investmentAccounts]);

  const allocation = useMemo(() => {
    const types: Record<string, number> = {};
    investmentAccounts.forEach(acc => {
      const type = acc.investmentType || 'other';
      types[type] = (types[type] || 0) + acc.balance;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [investmentAccounts]);

  const typeLabels: Record<string, string> = {
    cdb: 'CDB / Renda Fixa',
    stock: 'Ações',
    fund: 'Fundos',
    fii: 'FIIs',
    other: 'Outros'
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <Card className="p-6 bg-blue-900 text-white border-none shadow-xl h-fit">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Patrimônio Investido</p>
          <h3 className="text-3xl font-bold tracking-tight">{formatCurrency(totalInvested)}</h3>
          <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <Icons.TrendingUp className="w-4 h-4" />
            <span>Crescimento constante</span>
          </div>
        </Card>

        <Card className="p-6 md:col-span-2 bg-white dark:bg-slate-900 border-none shadow-sm">
          <div className="flex flex-row items-center gap-6">
            <div className="shrink-0 w-[200px] h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {allocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              <h4 className="text-sm font-bold text-blue-900 dark:text-slate-100 mb-4">Alocação de Ativos</h4>
              {allocation.length > 0 ? allocation.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">{typeLabels[item.name]}</span>
                  </div>
                  <span className="text-sm font-bold text-blue-900 dark:text-slate-100">
                    {totalInvested > 0 ? ((item.value / totalInvested) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              )) : (
                <p className="text-sm text-blue-500 dark:text-slate-400 italic">Nenhum investimento cadastrado.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {investmentAccounts.length === 0 ? (
        <p className="text-sm text-blue-500 dark:text-slate-400 italic text-center py-4">Nenhuma conta de investimento cadastrada.</p>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {investmentAccounts.map(acc => {
          const currentBalance = acc.balance;

          return (
            <Card key={acc.id} className="p-5 border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: acc.color }} />
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${acc.color}15`, color: acc.color }}>
                    <Icons.TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-slate-100">{acc.name}</h3>
                    <p className="text-xs text-blue-500 dark:text-slate-400 font-medium">{typeLabels[acc.investmentType || 'other']}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-blue-100/50 dark:border-slate-700/50">
                <p className="text-sm text-blue-500 dark:text-slate-400 mb-1">Valor Atual</p>
                <p className="text-2xl font-bold tracking-tight text-blue-800 dark:text-slate-100">{formatCurrency(currentBalance)}</p>
              </div>
            </Card>
          );
        })}
      </div>
      )}
    </div>
  );
}
