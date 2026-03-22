import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { Icons } from '../components/Icons';
import { Button, Card, Input } from '../components/ui';
import { transactionsApi } from '../services/api';
import { Transaction, Category, BankAccount } from '../types';
import { PlanGate } from '../components/PlanGate';
import { TransactionModal } from '../components/modals/TransactionModal';
import { AnimatePresence } from 'motion/react';
import { useConfirm } from '../contexts/ConfirmContext';

export function TransactionManager({ transactions, categories, accounts, onRefresh, userId }: { transactions: Transaction[]; categories: Category[]; accounts: BankAccount[]; onRefresh: () => Promise<void>; userId: string }) {
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [search, setSearch] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const { confirm } = useConfirm();

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      const matchesFilter = filter === 'all' || t.type === filter;
      const matchesSearch = t.description?.toLowerCase().includes(search.toLowerCase()) ||
                           categories.find(c => c.id === t.category)?.name.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [transactions, categories, filter, search]);

  const handleDelete = async (t: Transaction) => {
    const ok = await confirm({
      title: 'Excluir transação',
      description: t.description || undefined,
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await transactionsApi.delete(t.id);
      await onRefresh();
    } catch (err) {
      console.error('Erro ao excluir transação:', err);
    }
  };

  const handleExport = () => {
    const rows = filtered.map(t => ({
      Data: formatDate(t.date.toDate()),
      Descrição: t.description || '-',
      Tipo: t.type === 'income' ? 'Receita' : 'Despesa',
      Categoria: categories.find(c => c.id === t.category)?.name || 'Outros',
      Conta: accounts.find(a => a.id === t.accountId)?.name || '-',
      'Forma de Pagamento': t.paymentMethod === 'credit' ? 'Crédito' : t.paymentMethod === 'debit' ? 'Débito' : '-',
      Valor: t.type === 'income' ? t.amount : -t.amount,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transações');
    XLSX.writeFile(wb, `transacoes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
          <Input
            placeholder="Buscar transações..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={filter === 'all' ? 'primary' : 'secondary'} onClick={() => setFilter('all')} className="px-3 py-2 text-xs">Tudo</Button>
          <Button variant={filter === 'income' ? 'primary' : 'secondary'} onClick={() => setFilter('income')} className="px-3 py-2 text-xs">Receitas</Button>
          <Button variant={filter === 'expense' ? 'primary' : 'secondary'} onClick={() => setFilter('expense')} className="px-3 py-2 text-xs">Despesas</Button>
          <PlanGate feature="exportExcel">
            <Button variant="secondary" onClick={handleExport} className="px-3 py-2 text-xs flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
              <Icons.Download className="w-3.5 h-3.5" />
              Exportar Excel
            </Button>
          </PlanGate>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-blue-100 dark:border-slate-700 bg-blue-50/50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Categoria / Conta</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider text-right">Valor</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100/50 dark:divide-slate-700/50">
              {filtered.map(t => {
                const account = accounts.find(a => a.id === t.accountId);
                return (
                  <tr key={t.id} className="hover:bg-blue-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 text-sm font-medium text-blue-500 dark:text-slate-400 whitespace-nowrap">{formatDate(t.date.toDate())}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-blue-800 dark:text-slate-200">{t.description || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-fit">
                          {categories.find(c => c.id === t.category)?.name || 'Outros'}
                        </span>
                        {account && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 dark:text-slate-400">
                            {t.paymentMethod === 'credit' ? <Icons.CreditCard className="w-3 h-3" /> : <Icons.Landmark className="w-3 h-3" />}
                            {account.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={cn('px-6 py-4 text-sm font-bold text-right whitespace-nowrap tracking-tight', t.type === 'income' ? 'text-emerald-600' : 'text-blue-900 dark:text-slate-100')}>
                      {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditingTransaction(t)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                          <Icons.Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(t)} className="p-2 text-blue-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                          <Icons.Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-24 text-center">
            <div className="w-16 h-16 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.Search className="w-6 h-6 text-blue-300 dark:text-slate-500" />
            </div>
            <p className="text-blue-500 dark:text-slate-400 font-medium">Nenhuma transação encontrada.</p>
          </div>
        )}
      </Card>

      <AnimatePresence>
        {editingTransaction && (
          <TransactionModal
            onClose={() => setEditingTransaction(null)}
            categories={categories}
            accounts={accounts}
            transactions={transactions}
            userId={userId}
            onRefresh={onRefresh}
            editTransaction={editingTransaction}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
