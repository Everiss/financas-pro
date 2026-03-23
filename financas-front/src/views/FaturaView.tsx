import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { addMonths, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, formatCurrency } from '../lib/utils';
import { Icons } from '../components/Icons';
import { Card } from '../components/ui';
import { Transaction, Category, BankAccount } from '../types';
import { ImportFaturaModal } from '../components/modals/ImportFaturaModal';
import { accountsApi, TransactionResponse } from '../services/api';
import { toTransaction } from '../lib/mappers';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getInvoicePeriod(referenceMonth: Date, closingDay: number, dueDay: number) {
  const year = referenceMonth.getFullYear();
  const month = referenceMonth.getMonth();
  // openDate: dia seguinte ao fechamento do mês anterior (início do dia)
  const openDate  = new Date(year, month - 1, closingDay + 1, 0, 0, 0, 0);
  // closeDate: dia de fechamento do mês atual (fim do dia, para incluir transações do próprio dia)
  const closeDate = new Date(year, month, closingDay, 23, 59, 59, 999);
  const dueMonth  = dueDay <= closingDay ? month + 1 : month;
  const dueDate   = new Date(year, dueMonth, dueDay);
  return { openDate, closeDate, dueDate };
}

function groupByDate(txs: Transaction[]) {
  const map = new Map<string, Transaction[]>();
  for (const t of txs) {
    const key = format(t.date.toDate(), 'yyyy-MM-dd');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

// ─── Credit card visual ───────────────────────────────────────────────────────

function CreditCardTile({
  card,
  selected,
  onClick,
}: {
  card: BankAccount;
  selected: boolean;
  onClick: () => void;
}) {
  const used    = Math.max(0, card.balance);
  const limit   = card.creditLimit ?? 0;
  const pct     = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const barColor = pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-emerald-400';

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex-shrink-0 w-52 rounded-2xl p-4 text-left transition-all duration-200 overflow-hidden group',
        selected
          ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-blue-400 shadow-xl scale-[1.02]'
          : 'opacity-70 hover:opacity-100 hover:shadow-lg',
      )}
      style={{ background: `linear-gradient(135deg, ${card.color ?? '#3b82f6'}cc, ${card.color ?? '#1d4ed8'}99)` }}
    >
      {/* decorative circles */}
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/5" />

      <div className="relative z-10 flex items-center justify-between mb-6">
        <span className="w-8 h-6 rounded bg-yellow-400/80 flex items-center justify-center">
          <span className="text-yellow-900 text-[8px] font-bold">SIM</span>
        </span>
        <Icons.CreditCard className="w-5 h-5 text-white/70" />
      </div>

      <div className="relative z-10">
        <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider mb-0.5">{card.bank?.name ?? 'Cartão'}</p>
        <p className="text-white font-bold text-sm truncate max-w-[10rem]">{card.name}</p>
      </div>

      {/* usage bar */}
      {limit > 0 && (
        <div className="relative z-10 mt-3">
          <div className="flex justify-between text-[10px] text-white/70 font-medium mb-1">
            <span>{formatCurrency(used)}</span>
            <span>/{formatCurrency(limit)}</span>
          </div>
          <div className="h-1 rounded-full bg-white/20 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </button>
  );
}

// ─── Category breakdown ───────────────────────────────────────────────────────

function CategoryBreakdown({ txs, categories }: { txs: Transaction[]; categories: Category[] }) {
  const expenses = txs.filter(t => t.type === 'expense');
  const total    = expenses.reduce((s, t) => s + t.amount, 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of expenses) {
      const catId = t.category || 'outros';
      map.set(catId, (map.get(catId) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([catId, amount]) => ({
        catId,
        amount,
        cat: categories.find(c => c.id === catId),
        pct: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [expenses, categories, total]);

  if (byCategory.length === 0) return null;

  return (
    <Card className="p-5">
      <h4 className="text-sm font-bold text-blue-900 dark:text-slate-100 mb-4">Gastos por categoria</h4>
      <div className="space-y-2.5">
        {byCategory.map(({ catId, amount, cat, pct }) => (
          <div key={catId}>
            <div className="flex justify-between text-xs font-semibold text-blue-700 dark:text-slate-300 mb-1">
              <span className="flex items-center gap-1.5">
                {cat && <span>{cat.icon}</span>}
                <span>{cat?.name ?? 'Outros'}</span>
              </span>
              <span>{formatCurrency(amount)} <span className="text-blue-400 dark:text-slate-500 font-normal">({pct.toFixed(0)}%)</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-blue-100 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: cat?.color ?? '#3b82f6' }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── FaturaView ───────────────────────────────────────────────────────────────

export function FaturaView({
  accounts,
  transactions,
  categories,
  onPayBill,
  onRefresh,
}: {
  accounts: BankAccount[];
  transactions: Transaction[];
  categories: Category[];
  onPayBill: (toId: string, amount: number) => void;
  onRefresh?: () => void;
}) {
  const creditCards = useMemo(
    () => accounts.filter(a => a.type === 'credit'),
    [accounts]
  );

  const [selectedCardId, setSelectedCardId] = useState<string>(
    () => creditCards[0]?.id ?? ''
  );
  const [showImport, setShowImport] = useState(false);
  const [referenceMonth, setReferenceMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Ao trocar de cartão, navega para a fatura que contém a transação mais recente
  useEffect(() => {
    if (!selectedCardId) return;
    const card = creditCards.find(c => c.id === selectedCardId);
    if (!card) return;
    const cardTxs = transactions.filter(t => t.accountId === selectedCardId && !t.isTransfer);
    if (cardTxs.length === 0) return;

    const latest = cardTxs.reduce((best, t) =>
      t.date.toDate() > best.date.toDate() ? t : best
    );

    const txDate = latest.date.toDate();
    const closingDay = card.closingDay ?? 1;

    // Se o dia da transação é maior que o dia de fechamento,
    // ela pertence à fatura do mês seguinte
    const refDate = new Date(txDate);
    if (txDate.getDate() > closingDay) {
      refDate.setMonth(refDate.getMonth() + 1);
    }
    refDate.setDate(1);
    refDate.setHours(0, 0, 0, 0);
    setReferenceMonth(refDate);
  }, [selectedCardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCard = creditCards.find(c => c.id === selectedCardId);

  const { openDate, closeDate, dueDate } = useMemo(() => {
    if (!selectedCard) return { openDate: new Date(), closeDate: new Date(), dueDate: new Date() };
    return getInvoicePeriod(
      referenceMonth,
      selectedCard.closingDay ?? 1,
      selectedCard.dueDay ?? 10
    );
  }, [selectedCard, referenceMonth]);

  const [invoiceTransactions, setInvoiceTransactions] = useState<Transaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);

  const fetchInvoiceTxs = useCallback(async () => {
    if (!selectedCard) return;
    setLoadingTxs(true);
    try {
      const startDate = format(openDate, 'yyyy-MM-dd') + 'T00:00:00.000Z';
      const endDate   = format(closeDate, 'yyyy-MM-dd') + 'T23:59:59.999Z';
      const raw = await accountsApi.getStatement(selectedCard.id, { startDate, endDate });
      const txs = (raw as TransactionResponse[])
        .filter(t => !t.isTransfer)
        .map(toTransaction)
        .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
      setInvoiceTransactions(txs);
    } catch (e) {
      console.error('Erro ao buscar lançamentos da fatura:', e);
    } finally {
      setLoadingTxs(false);
    }
  }, [selectedCard, openDate, closeDate]);

  useEffect(() => { fetchInvoiceTxs(); }, [fetchInvoiceTxs]);

  const totalFatura = useMemo(
    () => invoiceTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [invoiceTransactions]
  );
  const totalCreditos = useMemo(
    () => invoiceTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [invoiceTransactions]
  );

  const today     = new Date();
  const isClosed  = today > closeDate;
  const isFuture  = referenceMonth > today;

  const groupedTxs = useMemo(() => groupByDate(invoiceTransactions), [invoiceTransactions]);

  // ── empty state ──────────────────────────────────────────────────────────────
  if (creditCards.length === 0) {
    return (
      <Card className="py-24 text-center">
        <div className="w-16 h-16 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icons.CreditCard className="w-6 h-6 text-blue-300 dark:text-slate-500" />
        </div>
        <p className="text-blue-500 dark:text-slate-400 font-medium">Nenhum cartão de crédito cadastrado.</p>
        <p className="text-sm text-blue-400 dark:text-slate-500 mt-1">
          Adicione um cartão em <span className="font-semibold">Contas</span> para visualizar as faturas.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Card selector ─────────────────────────────────────────────────────── */}
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {creditCards.map(card => (
          <CreditCardTile
            key={card.id}
            card={card}
            selected={card.id === selectedCardId}
            onClick={() => setSelectedCardId(card.id)}
          />
        ))}
      </div>

      {selectedCard && (
        <>
          {/* ── Invoice period header ──────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 dark:bg-slate-900/70 rounded-2xl px-5 py-4 border border-blue-100/50 dark:border-slate-700/50 shadow-sm">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-blue-900 dark:text-slate-100 capitalize text-lg">
                  Fatura de {format(referenceMonth, 'MMMM yyyy', { locale: ptBR })}
                </h3>
                <span className={cn(
                  'text-xs font-semibold px-2.5 py-1 rounded-full',
                  isFuture
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    : isClosed
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                )}>
                  {isFuture ? 'Futura' : isClosed ? 'Fechada' : 'Aberta'}
                </span>
              </div>
              <p className="text-xs text-blue-400 dark:text-slate-500 mt-1">
                {format(openDate, 'dd/MM/yyyy')} → {format(closeDate, 'dd/MM/yyyy')}
                {' · '}
                Vencimento: <span className="font-semibold text-blue-500 dark:text-slate-400">{format(dueDate, 'dd/MM/yyyy')}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {selectedCard && (
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Icons.Upload className="w-3.5 h-3.5" />
                  Importar Fatura
                </button>
              )}
              <button
                onClick={() => setReferenceMonth(prev => subMonths(prev, 1))}
                className="p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800 text-blue-400 dark:text-slate-500 transition-colors"
              >
                <Icons.ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); setReferenceMonth(d); }}
                className="px-3 py-1 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors"
              >
                Atual
              </button>
              <button
                onClick={() => setReferenceMonth(prev => addMonths(prev, 1))}
                className="p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800 text-blue-400 dark:text-slate-500 transition-colors"
              >
                <Icons.ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Metrics row ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-[11px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider mb-1">Total da Fatura</p>
              <p className="text-xl font-bold text-blue-900 dark:text-slate-100">{formatCurrency(Math.max(0, selectedCard.balance))}</p>
              {totalFatura > 0 && (
                <p className="text-xs text-blue-400 dark:text-slate-500 mt-0.5">
                  {formatCurrency(totalFatura)} neste período
                  {totalCreditos > 0 && <span className="text-emerald-500"> − {formatCurrency(totalCreditos)} créditos</span>}
                </p>
              )}
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider mb-1">Limite Disponível</p>
              <p className="text-xl font-bold text-emerald-600">
                {formatCurrency(Math.max(0, (selectedCard.creditLimit ?? 0) - Math.max(0, selectedCard.balance)))}
              </p>
              {(selectedCard.creditLimit ?? 0) > 0 && (
                <p className="text-xs text-blue-400 dark:text-slate-500 mt-0.5">
                  de {formatCurrency(selectedCard.creditLimit ?? 0)}
                </p>
              )}
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider mb-1">Uso do Limite</p>
              {(selectedCard.creditLimit ?? 0) > 0 ? (
                <>
                  <p className={cn('text-xl font-bold', ((selectedCard.balance / (selectedCard.creditLimit ?? 1)) * 100) > 80 ? 'text-red-500' : 'text-blue-900 dark:text-slate-100')}>
                    {((Math.max(0, selectedCard.balance) / (selectedCard.creditLimit ?? 1)) * 100).toFixed(0)}%
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-blue-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500',
                        (selectedCard.balance / (selectedCard.creditLimit ?? 1)) > 0.8 ? 'bg-red-500' :
                        (selectedCard.balance / (selectedCard.creditLimit ?? 1)) > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
                      )}
                      style={{ width: `${Math.min(100, (Math.max(0, selectedCard.balance) / (selectedCard.creditLimit ?? 1)) * 100)}%` }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-xl font-bold text-blue-900 dark:text-slate-100">—</p>
              )}
            </Card>
            <Card className="p-4 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider mb-1">Pagar Fatura</p>
              <div>
                <p className="text-xl font-bold text-blue-900 dark:text-slate-100 mb-2">
                  {formatCurrency(Math.max(0, selectedCard.balance))}
                </p>
                <button
                  onClick={() => onPayBill(selectedCard.id, Math.max(0, selectedCard.balance))}
                  disabled={selectedCard.balance <= 0}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Icons.Banknote className="w-4 h-4" />
                  Pagar
                </button>
              </div>
            </Card>
          </div>

          {/* ── Two-column: breakdown + transactions ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Category breakdown */}
            <div className="lg:col-span-1">
              <CategoryBreakdown txs={invoiceTransactions} categories={categories} />
            </div>

            {/* Transaction list grouped by date */}
            <div className="lg:col-span-2">
              <Card className="p-0 overflow-hidden border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="px-6 py-4 border-b border-blue-100 dark:border-slate-700 flex items-center justify-between">
                  <h4 className="font-semibold text-blue-900 dark:text-slate-100">Lançamentos</h4>
                  <span className="text-xs font-semibold text-blue-400 dark:text-slate-500 bg-blue-50 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                    {invoiceTransactions.length} item{invoiceTransactions.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {loadingTxs ? (
                  <div className="py-20 flex justify-center items-center">
                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : invoiceTransactions.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="w-14 h-14 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Icons.CreditCard className="w-6 h-6 text-blue-300 dark:text-slate-500" />
                    </div>
                    <p className="text-blue-500 dark:text-slate-400 font-medium text-sm">Nenhuma transação neste período.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-blue-100/50 dark:divide-slate-700/50">
                    {groupedTxs.map(([dateKey, dayTxs]) => {
                      const date = new Date(dateKey + 'T12:00:00');
                      const dayTotal = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                      return (
                        <div key={dateKey}>
                          {/* Date header */}
                          <div className="px-5 py-2 flex items-center justify-between bg-blue-50/50 dark:bg-slate-800/50">
                            <span className="text-xs font-bold text-blue-500 dark:text-slate-400 capitalize">
                              {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                            </span>
                            {dayTotal > 0 && (
                              <span className="text-xs font-semibold text-blue-400 dark:text-slate-500">
                                {formatCurrency(dayTotal)}
                              </span>
                            )}
                          </div>
                          {/* Transactions */}
                          {dayTxs.map(t => {
                            const cat = categories.find(c => c.id === t.category);
                            return (
                              <div key={t.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-blue-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                {/* Category icon */}
                                <div
                                  className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                                  style={{ backgroundColor: `${cat?.color ?? '#3b82f6'}20` }}
                                >
                                  {cat?.icon ?? '💳'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-blue-900 dark:text-slate-100 truncate">
                                    {t.description || 'Sem descrição'}
                                  </p>
                                  <p className="text-xs text-blue-400 dark:text-slate-500 mt-0.5">{cat?.name ?? 'Outros'}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={cn(
                                    'text-sm font-bold',
                                    t.type === 'income' ? 'text-emerald-600' : 'text-blue-900 dark:text-slate-100'
                                  )}>
                                    {t.type === 'income' ? '+' : '−'} {formatCurrency(t.amount)}
                                  </p>
                                  {t.paymentMethod && (
                                    <p className="text-[10px] text-blue-300 dark:text-slate-600 mt-0.5 capitalize">{t.paymentMethod}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
      {/* Import modal */}
      {showImport && selectedCard && (
        <ImportFaturaModal
          open={showImport}
          onClose={() => setShowImport(false)}
          account={selectedCard}
          categories={categories}
          onSuccess={() => { setShowImport(false); onRefresh?.(); fetchInvoiceTxs(); }}
        />
      )}
    </div>
  );
}
