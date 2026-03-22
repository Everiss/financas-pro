import React, { useState, useMemo } from 'react';
import { cn, formatDate, formatCurrency } from '../lib/utils';
import { AnimatePresence } from 'motion/react';
import { Icons } from '../components/Icons';
import { Button, Card } from '../components/ui';
import { transactionsApi, remindersApi } from '../services/api';
import { Reminder, Category, BankAccount } from '../types';
import { ReminderModal } from '../components/modals/ReminderModal';
import { useConfirm } from '../contexts/ConfirmContext';

export { ReminderItem } from '../components/dashboard/UpcomingReminders';

const PAGE_SIZE_REMINDERS = 8;

export function ReminderManager({ reminders, categories, accounts, userId, onRefresh }: { reminders: Reminder[]; categories: Category[]; accounts: BankAccount[]; userId: string; onRefresh: () => Promise<void> }) {
  const [isAdding, setIsAdding] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [pickingAccountFor, setPickingAccountFor] = useState<string | null>(null);
  const [pickedAccountId, setPickedAccountId] = useState('');
  const { confirm } = useConfirm();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterFreq, setFilterFreq] = useState<'all' | 'once' | 'monthly' | 'weekly' | 'yearly' | 'daily'>('all');
  const [page, setPage] = useState(1);

  const now = new Date();
  const in30 = new Date(); in30.setDate(now.getDate() + 30);

  const frequencyLabel = (f: string) =>
    ({ once: 'Única', daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' }[f] ?? f);

  // Apply search + filters
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return reminders.filter(r => {
      if (q && !r.title.toLowerCase().includes(q) && !(r.notes?.toLowerCase().includes(q))) return false;
      if (filterType !== 'all' && r.type !== filterType) return false;
      if (filterFreq !== 'all' && r.frequency !== filterFreq) return false;
      return true;
    });
  }, [reminders, search, filterType, filterFreq]);

  // Reset page when filters change
  const resetPage = () => setPage(1);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE_REMINDERS));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE_REMINDERS, page * PAGE_SIZE_REMINDERS);

  const overdue  = paginated.filter(r => r.dueDate.toDate() < now);
  const upcoming = paginated.filter(r => { const d = r.dueDate.toDate(); return d >= now && d <= in30; });
  const future   = paginated.filter(r => r.dueDate.toDate() > in30);

  // For credit card reminders, always use the current card balance as the effective amount
  const effectiveAmount = (r: Reminder): number => {
    if (!r.accountId) return r.amount;
    const account = accounts.find(a => a.id === r.accountId);
    if (account?.type === 'credit') return Math.max(0, account.balance);
    return r.amount;
  };

  const handlePay = async (r: Reminder, overrideAccountId?: string) => {
    const amount = effectiveAmount(r);
    const resolvedAccountId = overrideAccountId || r.accountId;

    // If amount > 0 and no account linked, show inline account picker
    if (amount > 0 && !resolvedAccountId) {
      setPickingAccountFor(r.id);
      setPickedAccountId('');
      return;
    }

    setPayingId(r.id);
    setPickingAccountFor(null);
    try {
      // Only create a transaction if there's an actual amount
      if (amount > 0) {
        const account = resolvedAccountId ? accounts.find(a => a.id === resolvedAccountId) : undefined;
        await transactionsApi.create({
          amount,
          type: r.type,
          categoryId: r.category || undefined,
          date: new Date().toISOString().split('T')[0],
          description: r.title,
          accountId: resolvedAccountId!,
          paymentMethod: account ? (account.type === 'credit' ? 'credit' : 'debit') : 'debit',
        });
      }

      if (r.frequency === 'once') {
        await remindersApi.delete(r.id);
      } else {
        const next = new Date(r.dueDate.toDate());
        if (r.frequency === 'daily')   next.setDate(next.getDate() + 1);
        if (r.frequency === 'weekly')  next.setDate(next.getDate() + 7);
        if (r.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
        if (r.frequency === 'yearly')  next.setFullYear(next.getFullYear() + 1);
        await remindersApi.update(r.id, { dueDate: next.toISOString().split('T')[0] });
      }
      await onRefresh();
    } catch (err) {
      console.error('Erro ao registrar pagamento:', err);
    } finally {
      setPayingId(null);
    }
  };

  const handleDelete = async (r: Reminder) => {
    const ok = await confirm({
      title: 'Excluir lembrete?',
      description: r.title,
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    await remindersApi.delete(r.id);
    await onRefresh();
  };

  const ReminderRow = ({ r }: { r: Reminder }) => {
    const isPaying = payingId === r.id;
    const isPickingAccount = pickingAccountFor === r.id;
    const isOverdueRow = r.dueDate.toDate() < now;
    const amount = effectiveAmount(r);
    const isInformational = amount === 0;
    const nonCreditAccounts = accounts.filter(a => a.type !== 'credit');
    return (
      <>
        <tr className="hover:bg-blue-50/80 dark:hover:bg-slate-800/50 transition-colors group">
          <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
            <span className={cn(isOverdueRow ? 'text-red-500 font-semibold' : 'text-blue-500 dark:text-slate-400')}>
              {formatDate(r.dueDate.toDate())}
            </span>
          </td>
          <td className="px-6 py-4">
            <p className="text-sm font-semibold text-blue-800 dark:text-slate-200">{r.title}</p>
            {r.notes && <p className="text-xs text-blue-400 dark:text-slate-500 italic mt-0.5 truncate max-w-[200px]">{r.notes}</p>}
          </td>
          <td className="px-6 py-4 text-sm font-medium text-blue-500 dark:text-slate-400">
            {frequencyLabel(r.frequency)}
          </td>
          <td className={cn('px-6 py-4 text-sm font-bold text-right whitespace-nowrap tracking-tight', r.type === 'income' ? 'text-emerald-600' : 'text-blue-900 dark:text-slate-100')}>
            {isInformational ? <span className="text-blue-400 dark:text-slate-500 text-xs font-medium">Aviso</span> : <>{r.type === 'income' ? '+' : '−'} {formatCurrency(amount)}</>}
          </td>
          <td className="px-6 py-4 text-right">
            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button
                onClick={() => handlePay(r)}
                disabled={isPaying}
                className={cn(
                  'px-3 py-1.5 text-xs font-bold rounded-xl transition-all disabled:opacity-50',
                  isInformational
                    ? 'bg-blue-100 dark:bg-slate-700 text-blue-600 dark:text-slate-300 hover:bg-blue-200 dark:hover:bg-slate-600'
                    : r.type === 'income'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200'
                      : 'bg-blue-900 text-white hover:bg-blue-800'
                )}
              >
                {isPaying ? '...' : isInformational ? 'Concluir' : r.type === 'income' ? 'Receber' : 'Pagar'}
              </button>
              <button
                onClick={() => handleDelete(r)}
                className="p-1.5 text-blue-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors"
              >
                <Icons.Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
        </tr>
        {isPickingAccount && (
          <tr className="bg-amber-50/70 dark:bg-amber-950/20">
            <td colSpan={5} className="px-6 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Icons.AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Selecione a conta para registrar este pagamento:</span>
                <select
                  value={pickedAccountId}
                  onChange={e => setPickedAccountId(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-blue-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">— Selecione —</option>
                  {nonCreditAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>
                  ))}
                </select>
                <button
                  onClick={() => { if (pickedAccountId) handlePay(r, pickedAccountId); }}
                  disabled={!pickedAccountId}
                  className="text-xs font-bold px-3 py-1.5 bg-blue-900 text-white rounded-xl hover:bg-blue-800 disabled:opacity-40 transition-colors"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setPickingAccountFor(null)}
                  className="text-xs text-blue-400 dark:text-slate-500 hover:text-blue-700 px-2 py-1.5"
                >
                  Cancelar
                </button>
              </div>
            </td>
          </tr>
        )}
      </>
    );
  };

  const Section = ({ title, color, items }: { title: string; color: string; items: Reminder[] }) => {
    if (items.length === 0) return null;
    return (
      <>
        <tr>
          <td colSpan={5} className="px-6 pt-5 pb-2">
            <span className={cn('text-[10px] font-bold uppercase tracking-widest', color)}>{title}</span>
          </td>
        </tr>
        {items.map(r => <React.Fragment key={r.id}><ReminderRow r={r} /></React.Fragment>)}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 dark:text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }}
            placeholder="Buscar lembrete..."
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-2xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-900 dark:text-slate-100 placeholder:text-blue-300 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Type filter */}
          <div className="flex bg-blue-100 dark:bg-slate-800 rounded-2xl p-1 gap-0.5">
            {(['all', 'expense', 'income'] as const).map(t => (
              <button key={t} onClick={() => { setFilterType(t); resetPage(); }}
                className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                  filterType === t ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-slate-100 shadow-sm' : 'text-blue-500 dark:text-slate-400 hover:text-blue-700')}>
                {t === 'all' ? 'Todos' : t === 'expense' ? 'Despesas' : 'Receitas'}
              </button>
            ))}
          </div>

          {/* Frequency filter */}
          <select
            value={filterFreq}
            onChange={e => { setFilterFreq(e.target.value as any); resetPage(); }}
            className="text-xs font-semibold px-3 py-2 rounded-2xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          >
            <option value="all">Frequência</option>
            <option value="once">Única</option>
            <option value="daily">Diária</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
            <option value="yearly">Anual</option>
          </select>

          <Button onClick={() => setIsAdding(true)}>
            <Icons.Plus className="w-4 h-4" />
            Novo Lembrete
          </Button>
        </div>
      </div>

      {/* Results count */}
      {(search || filterType !== 'all' || filterFreq !== 'all') && (
        <p className="text-xs text-blue-400 dark:text-slate-500 font-medium">
          {filtered.length} lembrete{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          {search && <> para "<span className="text-blue-600 dark:text-slate-300">{search}</span>"</>}
          {' '}
          <button onClick={() => { setSearch(''); setFilterType('all'); setFilterFreq('all'); resetPage(); }} className="text-blue-500 hover:text-blue-700 underline ml-1">Limpar filtros</button>
        </p>
      )}

      <Card className="p-0 overflow-hidden border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-blue-100 dark:border-slate-700 bg-blue-50/50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Vencimento</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Título</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Frequência</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider text-right">Valor</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100/50 dark:divide-slate-700/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="py-20 text-center">
                      <div className="w-14 h-14 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Icons.Search className="w-5 h-5 text-blue-300 dark:text-slate-500" />
                      </div>
                      <p className="text-blue-500 dark:text-slate-400 font-medium text-sm">
                        {reminders.length === 0 ? 'Nenhum lembrete configurado.' : 'Nenhum lembrete encontrado.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  <Section title="Vencidos" color="text-red-500" items={overdue} />
                  <Section title="Próximos 30 dias" color="text-amber-500" items={upcoming} />
                  <Section title="Futuros" color="text-blue-400 dark:text-slate-500" items={future} />
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-blue-100 dark:border-slate-700/50 bg-blue-50/30 dark:bg-slate-800/30">
            <p className="text-xs text-blue-400 dark:text-slate-500 font-medium">
              Página {page} de {totalPages} · {filtered.length} lembretes
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-blue-400 dark:text-slate-500 hover:bg-blue-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Icons.ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && (arr[idx - 1] as number) !== p - 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-blue-300 dark:text-slate-600 text-xs">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={cn(
                        'w-8 h-8 rounded-lg text-xs font-bold transition-all',
                        page === p
                          ? 'bg-blue-900 dark:bg-blue-600 text-white'
                          : 'text-blue-500 dark:text-slate-400 hover:bg-blue-100 dark:hover:bg-slate-700'
                      )}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-blue-400 dark:text-slate-500 hover:bg-blue-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Icons.ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      <AnimatePresence>
        {isAdding && (
          <ReminderModal onClose={() => setIsAdding(false)} categories={categories} accounts={accounts} userId={userId} onRefresh={onRefresh} />
        )}
      </AnimatePresence>
    </div>
  );
}
