import React, { useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../lib/utils';
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

interface Props {
  accounts: BankAccount[];
  transactions: Transaction[];
  onAporte: (accId: string) => void;
  onAddTransaction: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  cdb:   'CDB / Renda Fixa',
  stock: 'Ações',
  fund:  'Fundos',
  fii:   'FIIs',
  other: 'Outros',
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

export function InvestmentsView({ accounts, transactions, onAporte, onAddTransaction }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const investmentAccounts = useMemo(
    () => accounts.filter(a => a.type === 'investment'),
    [accounts],
  );

  const totalInvested = useMemo(
    () => investmentAccounts.reduce((sum, acc) => sum + acc.balance, 0),
    [investmentAccounts],
  );

  const allocation = useMemo(() => {
    const types: Record<string, number> = {};
    investmentAccounts.forEach(acc => {
      const type = acc.investmentType || 'other';
      types[type] = (types[type] || 0) + acc.balance;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [investmentAccounts]);

  // Per-account transaction breakdown
  const accStats = useMemo(() => {
    return investmentAccounts.reduce<Record<string, {
      aportes: number;
      resgates: number;
      rendimentos: number;
      history: Transaction[];
    }>>((map, acc) => {
      const txs = transactions.filter(t => t.accountId === acc.id);
      const aportes    = txs.filter(t => t.isTransfer && t.type === 'income');
      const resgates   = txs.filter(t => t.isTransfer && t.type === 'expense');
      const rendimentos = txs.filter(t => !t.isTransfer && t.type === 'income');
      map[acc.id] = {
        aportes:    aportes.reduce((s, t) => s + t.amount, 0),
        resgates:   resgates.reduce((s, t) => s + t.amount, 0),
        rendimentos: rendimentos.reduce((s, t) => s + t.amount, 0),
        history: [...txs].sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime()).slice(0, 8),
      };
      return map;
    }, {});
  }, [investmentAccounts, transactions]);

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <Card className="p-6 bg-blue-900 text-white border-none shadow-xl h-fit">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Patrimônio Investido</p>
          <h3 className="text-3xl font-bold tracking-tight">{formatCurrency(totalInvested)}</h3>
          <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <Icons.TrendingUp className="w-4 h-4" />
            <span>{investmentAccounts.length} ativo{investmentAccounts.length !== 1 ? 's' : ''} cadastrado{investmentAccounts.length !== 1 ? 's' : ''}</span>
          </div>
        </Card>

        <Card className="p-6 md:col-span-2 bg-white dark:bg-slate-900 border-none shadow-sm">
          <div className="flex flex-row items-center gap-6">
            <div className="shrink-0 w-[180px] h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {allocation.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
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
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">{TYPE_LABELS[item.name]}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-blue-900 dark:text-slate-100">
                      {totalInvested > 0 ? ((item.value / totalInvested) * 100).toFixed(1) : 0}%
                    </span>
                    <p className="text-xs text-blue-400 dark:text-slate-500">{formatCurrency(item.value)}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-blue-500 dark:text-slate-400 italic">Nenhum investimento cadastrado.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Per-account cards */}
      {investmentAccounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-slate-800 flex items-center justify-center">
            <Icons.TrendingUp className="w-8 h-8 text-blue-400 dark:text-slate-500" />
          </div>
          <div>
            <p className="font-semibold text-blue-900 dark:text-slate-100">Nenhuma conta de investimento</p>
            <p className="text-sm text-blue-400 dark:text-slate-500 mt-1">Cadastre uma conta do tipo <strong>Investimento</strong> em Contas para começar.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {investmentAccounts.map(acc => {
            const stats = accStats[acc.id] ?? { aportes: 0, resgates: 0, rendimentos: 0, history: [] };
            const isExpanded = expandedId === acc.id;

            return (
              <Card key={acc.id} className="p-0 border-none shadow-sm bg-white/80 dark:bg-slate-900/80 overflow-hidden">
                {/* Card header */}
                <div className="flex items-center gap-4 p-5">
                  <div className="w-2 self-stretch rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${acc.color}18`, color: acc.color }}>
                    <Icons.TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-blue-900 dark:text-slate-100">{acc.name}</p>
                    <p className="text-xs text-blue-400 dark:text-slate-500">{TYPE_LABELS[acc.investmentType || 'other']}</p>
                  </div>

                  {/* KPIs */}
                  <div className="hidden sm:flex items-center gap-6 text-right">
                    <div>
                      <p className="text-[10px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Aportes</p>
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{formatCurrency(stats.aportes)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Resgates</p>
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatCurrency(stats.resgates)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Rendimentos</p>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.rendimentos)}</p>
                    </div>
                    <div className="pl-4 border-l border-blue-100 dark:border-slate-700">
                      <p className="text-[10px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Saldo Atual</p>
                      <p className="text-lg font-bold text-blue-900 dark:text-slate-100">{formatCurrency(acc.balance)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                      onClick={() => onAporte(acc.id)}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                      title="Transferir da conta corrente para este investimento"
                    >
                      + Aporte
                    </button>
                    <button
                      onClick={onAddTransaction}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                      title="Registrar rendimento ou resgate"
                    >
                      Rendimento
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : acc.id)}
                      className="p-1.5 rounded-xl text-blue-400 dark:text-slate-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                      title={isExpanded ? 'Fechar histórico' : 'Ver histórico'}
                    >
                      <Icons.ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Mobile KPIs */}
                <div className="sm:hidden grid grid-cols-4 border-t border-blue-50 dark:border-slate-800">
                  {[
                    { label: 'Aportes',    value: stats.aportes,    color: 'text-blue-700 dark:text-blue-400' },
                    { label: 'Resgates',   value: stats.resgates,   color: 'text-amber-600 dark:text-amber-400' },
                    { label: 'Rendimentos', value: stats.rendimentos, color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Saldo',      value: acc.balance,      color: 'text-blue-900 dark:text-slate-100' },
                  ].map(kpi => (
                    <div key={kpi.label} className="px-3 py-2.5 text-center border-r last:border-r-0 border-blue-50 dark:border-slate-800">
                      <p className="text-[9px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">{kpi.label}</p>
                      <p className={`text-xs font-bold mt-0.5 ${kpi.color}`}>{formatCurrency(kpi.value)}</p>
                    </div>
                  ))}
                </div>

                {/* History */}
                {isExpanded && (
                  <div className="border-t border-blue-50 dark:border-slate-800">
                    {stats.history.length === 0 ? (
                      <p className="text-sm text-blue-400 dark:text-slate-500 text-center py-6">Nenhuma movimentação registrada.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-blue-50/50 dark:bg-slate-800/50">
                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Data</th>
                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Descrição</th>
                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-5 py-2.5 text-right text-xs font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-50 dark:divide-slate-800">
                          {stats.history.map(tx => {
                            const isAporte     = tx.isTransfer && tx.type === 'income';
                            const isResgate    = tx.isTransfer && tx.type === 'expense';
                            const isRendimento = !tx.isTransfer && tx.type === 'income';
                            const label = isAporte ? 'Aporte' : isResgate ? 'Resgate' : isRendimento ? 'Rendimento' : tx.type === 'income' ? 'Receita' : 'Despesa';
                            const color = isResgate
                              ? 'text-amber-600 dark:text-amber-400'
                              : tx.type === 'income'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-500';
                            const badge = isAporte
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : isResgate
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
                            return (
                              <tr key={tx.id} className="hover:bg-blue-50/30 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-5 py-3 text-blue-500 dark:text-slate-400 text-xs whitespace-nowrap">{formatDate(tx.date.toDate())}</td>
                                <td className="px-5 py-3 text-blue-800 dark:text-slate-200 font-medium">{tx.description || '—'}</td>
                                <td className="px-5 py-3">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge}`}>{label}</span>
                                </td>
                                <td className={`px-5 py-3 text-right font-bold tracking-tight ${color}`}>
                                  {tx.type === 'income' ? '+' : '−'} {formatCurrency(tx.amount)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
