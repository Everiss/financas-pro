import React, { useMemo } from 'react';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Icons, IconName } from '../Icons';
import { Button, Card } from '../ui';
import { Transaction, Category, BankAccount } from '../../types';

export function TransactionItem({ transaction, category, account, showDate = false }: { transaction: Transaction; category?: Category; account?: BankAccount; showDate?: boolean; key?: string }) {
  const Icon = category ? Icons[category.icon as IconName] : Icons.MoreHorizontal;

  return (
    <div className="flex items-center gap-4 group p-3.5 rounded-2xl bg-white dark:bg-slate-800/50 hover:bg-blue-50/80 dark:hover:bg-slate-800 border border-blue-100 dark:border-slate-700 shadow-sm transition-all duration-300">
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105', transaction.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600')}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-blue-800 dark:text-slate-200 truncate">{transaction.description || category?.name || 'Sem descrição'}</p>
        <div className="flex items-center gap-2 text-xs font-medium text-blue-500 dark:text-slate-400 mt-1">
          <span className="bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-md text-blue-600 dark:text-blue-400">{category?.name || 'Outros'}</span>
          {account && (
            <>
              <span className="w-1 h-1 bg-blue-300 dark:bg-slate-600 rounded-full" />
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                {transaction.paymentMethod === 'credit' ? <Icons.CreditCard className="w-3 h-3" /> : <Icons.Landmark className="w-3 h-3" />}
                {account.name}
              </span>
            </>
          )}
          {showDate && (
            <>
              <span className="w-1 h-1 bg-blue-300 rounded-full" />
              <span>{formatDate(transaction.date.toDate())}</span>
            </>
          )}
        </div>
      </div>
      <div className={cn('font-bold text-right text-lg tracking-tight', transaction.type === 'income' ? 'text-emerald-600' : 'text-blue-900 dark:text-slate-100')}>
        {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
      </div>
    </div>
  );
}

export function RecentTransactions({ transactions, categories, accounts, month, onSeeAll }: { transactions: Transaction[]; categories: Category[]; accounts: BankAccount[]; month: Date; onSeeAll: () => void }) {
  const monthTxs = useMemo(() =>
    transactions
      .filter(t => {
        const d = t.date.toDate();
        return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
      })
      .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime())
      .slice(0, 8),
    [transactions, month]
  );

  return (
    <Card title="Transações Recentes" subtitle={format(month, 'MMM yyyy', { locale: ptBR })} className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" action={<Button variant="ghost" className="text-xs font-medium" onClick={onSeeAll}>Ver Tudo</Button>}>
      <div className="space-y-2">
        {monthTxs.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.AlertCircle className="w-6 h-6 text-blue-300 dark:text-slate-500" />
            </div>
            <p className="text-blue-500 dark:text-slate-400 font-medium">Nenhuma transação neste mês.</p>
          </div>
        ) : (
          monthTxs.map(t => (
            <TransactionItem key={t.id} transaction={t} category={categories.find(c => c.id === t.category)} account={accounts.find(a => a.id === t.accountId)} showDate />
          ))
        )}
      </div>
    </Card>
  );
}
