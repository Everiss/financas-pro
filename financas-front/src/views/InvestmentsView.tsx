import React, { useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../lib/utils';
import { Icons } from '../components/Icons';
import { Card } from '../components/ui';
import { Bank, BankAccount, Transaction } from '../types';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';

interface Props {
  banks: Bank[];
  accounts: BankAccount[];
  transactions: Transaction[];
  onAporte: (accId: string) => void;
  onTransfer: () => void;
  onAddTransaction: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  cdb:      'CDB / Renda Fixa',
  stock:    'Ações',
  fund:     'Fundos',
  fii:      'FIIs',
  other:    'Outros',
  checking: 'Caixa / Disponível',
  savings:  'Caixa / Disponível',
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

export function InvestmentsView({ banks, accounts, transactions, onAporte, onTransfer, onAddTransaction }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Banks that have at least one investment account
  const brokerageBanks = useMemo(() => {
    return banks.filter(b =>
      accounts.some(a => a.bankId === b.id && a.type === 'investment'),
    );
  }, [banks, accounts]);

  // All investment-type accounts (for summary)
  const investmentAccounts = useMemo(
    () => accounts.filter(a => a.type === 'investment'),
    [accounts],
  );

  const totalInvested   = useMemo(() => investmentAccounts.reduce((s, a) => s + a.balance, 0), [investmentAccounts]);

  // Cash accounts that live inside a brokerage bank
  const brokerageCashAccounts = useMemo(() =>
    accounts.filter(a =>
      (a.type === 'checking' || a.type === 'savings') &&
      brokerageBanks.some(b => b.id === a.bankId),
    ),
  [accounts, brokerageBanks]);

  const totalCash = useMemo(() => brokerageCashAccounts.reduce((s, a) => s + a.balance, 0), [brokerageCashAccounts]);

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
    return accounts.reduce<Record<string, {
      aportes: number; resgates: number; rendimentos: number; history: Transaction[];
    }>>((map, acc) => {
      const txs = transactions.filter(t => t.accountId === acc.id);
      const aportes     = txs.filter(t => t.isTransfer && t.type === 'income');
      const resgates    = txs.filter(t => t.isTransfer && t.type === 'expense');
      const rendimentos = txs.filter(t => !t.isTransfer && t.type === 'income');
      map[acc.id] = {
        aportes:     aportes.reduce((s, t) => s + t.amount, 0),
        resgates:    resgates.reduce((s, t) => s + t.amount, 0),
        rendimentos: rendimentos.reduce((s, t) => s + t.amount, 0),
        history:     [...txs].sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime()).slice(0, 8),
      };
      return map;
    }, {});
  }, [accounts, transactions]);

  const AccountRow = ({ acc, bankColor }: { acc: BankAccount; bankColor: string; key?: string }) => {
    const stats = accStats[acc.id] ?? { aportes: 0, resgates: 0, rendimentos: 0, history: [] };
    const isInvestment = acc.type === 'investment';
    const isCash       = acc.type === 'checking' || acc.type === 'savings';
    const isExpanded   = expandedId === acc.id;

    return (
      <div className="border-t border-blue-50 dark:border-slate-800 first:border-t-0">
        <div className="flex items-center gap-3 px-5 py-4">
          {/* Icon */}
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${bankColor}18`, color: bankColor }}>
            {isCash
              ? <Icons.Banknote className="w-4 h-4" />
              : <Icons.TrendingUp className="w-4 h-4" />
            }
          </div>

          {/* Name + type */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-900 dark:text-slate-100 truncate">{acc.name}</p>
            <p className="text-xs text-blue-400 dark:text-slate-500">
              {isCash ? 'Disponível para negociar' : (TYPE_LABELS[acc.investmentType || 'other'])}
            </p>
          </div>

          {/* KPIs — desktop */}
          {isInvestment && (
            <div className="hidden sm:flex items-center gap-5 text-right mr-3">
              <div>
                <p className="text-[10px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Aportes</p>
                <p className="text-xs font-bold text-blue-700 dark:text-blue-400">{formatCurrency(stats.aportes)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Rendimentos</p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.rendimentos)}</p>
              </div>
            </div>
          )}

          {/* Balance */}
          <div className="text-right shrink-0 mr-2">
            <p className={`text-base font-bold ${isCash ? 'text-amber-600 dark:text-amber-400' : 'text-blue-900 dark:text-slate-100'}`}>
              {formatCurrency(acc.balance)}
            </p>
            {isCash && <p className="text-[10px] text-blue-400 dark:text-slate-500 font-medium">disponível</p>}
            {isInvestment && <p className="text-[10px] text-blue-400 dark:text-slate-500 font-medium">investido</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isCash && (
              <button
                onClick={onTransfer}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 transition-colors"
                title="Transferir entre contas desta corretora"
              >
                Aplicar
              </button>
            )}
            {isInvestment && (
              <>
                <button
                  onClick={() => onAporte(acc.id)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                  title="Aportar neste investimento"
                >
                  + Aporte
                </button>
                <button
                  onClick={onAddTransaction}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 transition-colors"
                  title="Registrar rendimento"
                >
                  Rendimento
                </button>
              </>
            )}
            <button
              onClick={() => setExpandedId(isExpanded ? null : acc.id)}
              className="p-1 rounded-lg text-blue-400 dark:text-slate-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* History */}
        {isExpanded && (
          <div className="bg-blue-50/30 dark:bg-slate-800/30 border-t border-blue-50 dark:border-slate-800">
            {stats.history.length === 0 ? (
              <p className="text-xs text-blue-400 dark:text-slate-500 text-center py-5">Nenhuma movimentação registrada.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-5 py-2 text-left text-[10px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Data</th>
                    <th className="px-5 py-2 text-left text-[10px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Descrição</th>
                    <th className="px-5 py-2 text-left text-[10px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-5 py-2 text-right text-[10px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100/50 dark:divide-slate-700/50">
                  {stats.history.map(tx => {
                    const isAporte     = tx.isTransfer && tx.type === 'income';
                    const isResgate    = tx.isTransfer && tx.type === 'expense';
                    const isRendimento = !tx.isTransfer && tx.type === 'income';
                    const label  = isAporte ? 'Aporte' : isResgate ? 'Resgate/Retirada' : isRendimento ? 'Rendimento' : tx.type === 'income' ? 'Entrada' : 'Saída';
                    const badge  = isAporte     ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                 : isResgate    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                 : isRendimento ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                 : tx.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                 : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
                    const color  = tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400';
                    return (
                      <tr key={tx.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-5 py-2.5 text-[11px] text-blue-400 dark:text-slate-500 whitespace-nowrap">{formatDate(tx.date.toDate())}</td>
                        <td className="px-5 py-2.5 text-xs text-blue-800 dark:text-slate-200 font-medium">{tx.description || '—'}</td>
                        <td className="px-5 py-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge}`}>{label}</span>
                        </td>
                        <td className={`px-5 py-2.5 text-right text-xs font-bold ${color}`}>
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
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-blue-900 text-white border-none shadow-xl">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">Total Investido</p>
          <h3 className="text-3xl font-bold tracking-tight">{formatCurrency(totalInvested)}</h3>
          <p className="text-blue-400 text-xs mt-3 font-medium">capital alocado em ativos</p>
        </Card>
        <Card className="p-6 border-none shadow-sm bg-white dark:bg-slate-900">
          <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">Disponível nas Corretoras</p>
          <h3 className="text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">{formatCurrency(totalCash)}</h3>
          <p className="text-blue-400 dark:text-slate-500 text-xs mt-3 font-medium">aguardando aplicação</p>
        </Card>
        <Card className="p-6 border-none shadow-sm bg-white dark:bg-slate-900">
          <p className="text-emerald-600 text-xs font-bold uppercase tracking-widest mb-1">Patrimônio na Corretora</p>
          <h3 className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{formatCurrency(totalInvested + totalCash)}</h3>
          <p className="text-blue-400 dark:text-slate-500 text-xs mt-3 font-medium">investido + disponível</p>
        </Card>
      </div>

      {/* Allocation chart */}
      {allocation.length > 0 && (
        <Card className="p-6 bg-white dark:bg-slate-900 border-none shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="shrink-0 w-[160px] h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocation} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                    {allocation.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full space-y-3">
              <h4 className="text-sm font-bold text-blue-900 dark:text-slate-100">Alocação de Ativos</h4>
              {allocation.map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium flex-1">{TYPE_LABELS[item.name]}</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-blue-900 dark:text-slate-100">{formatCurrency(item.value)}</span>
                    <span className="text-xs text-blue-400 dark:text-slate-500 ml-2">
                      {totalInvested > 0 ? ((item.value / totalInvested) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Brokerage groups */}
      {brokerageBanks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-slate-800 flex items-center justify-center">
            <Icons.TrendingUp className="w-8 h-8 text-blue-400 dark:text-slate-500" />
          </div>
          <div>
            <p className="font-semibold text-blue-900 dark:text-slate-100">Nenhuma conta de investimento</p>
            <p className="text-sm text-blue-400 dark:text-slate-500 mt-1">
              Em <strong>Contas</strong>, cadastre um banco (ex: XP, BTG) com uma conta do tipo <strong>Investimento</strong>.
            </p>
            <p className="text-sm text-blue-400 dark:text-slate-500 mt-1">
              Para controlar o caixa da corretora, adicione também uma conta <strong>Corrente</strong> no mesmo banco.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {brokerageBanks.map(bank => {
            const bankAccs   = accounts.filter(a => a.bankId === bank.id);
            const cashAccs   = bankAccs.filter(a => a.type === 'checking' || a.type === 'savings');
            const investAccs = bankAccs.filter(a => a.type === 'investment');
            const totalBank  = bankAccs.filter(a => a.type !== 'credit').reduce((s, a) => s + a.balance, 0);
            const totalBankCash = cashAccs.reduce((s, a) => s + a.balance, 0);
            const totalBankInvested = investAccs.reduce((s, a) => s + a.balance, 0);

            return (
              <Card key={bank.id} className="p-0 border-none shadow-sm bg-white/90 dark:bg-slate-900/90 overflow-hidden">
                {/* Bank header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-blue-50 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${bank.color}20`, color: bank.color }}>
                      {React.createElement(Icons[bank.icon as keyof typeof Icons] || Icons.Landmark, { className: 'w-4 h-4' })}
                    </div>
                    <div>
                      <p className="font-bold text-blue-900 dark:text-slate-100 text-sm">{bank.name}</p>
                      <p className="text-xs text-blue-400 dark:text-slate-500">
                        {investAccs.length} ativo{investAccs.length !== 1 ? 's' : ''}
                        {cashAccs.length > 0 && ` · ${cashAccs.length} caixa`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-right">
                    {cashAccs.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Disponível</p>
                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalBankCash)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider">Investido</p>
                      <p className="text-sm font-bold text-blue-900 dark:text-slate-100">{formatCurrency(totalBankInvested)}</p>
                    </div>
                    <div className="pl-4 border-l border-blue-100 dark:border-slate-700">
                      <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Total</p>
                      <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalBank)}</p>
                    </div>
                  </div>
                </div>

                {/* Cash accounts first */}
                {cashAccs.map(acc => (
                  <AccountRow key={acc.id} acc={acc} bankColor={bank.color} />
                ))}

                {/* Investment accounts */}
                {investAccs.map(acc => (
                  <AccountRow key={acc.id} acc={acc} bankColor={bank.color} />
                ))}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
