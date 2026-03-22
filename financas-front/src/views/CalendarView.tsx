import React, { useState, useMemo } from 'react';
import { cn, formatCurrency } from '../lib/utils';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Icons, IconName } from '../components/Icons';
import { remindersApi } from '../services/api';
import { Reminder, Transaction, Category, BankAccount } from '../types';
import { subMonths } from '../lib/constants';

export function CalendarView({ reminders, transactions, categories, accounts, onRefresh }: { reminders: Reminder[]; transactions: Transaction[]; categories: Category[]; accounts: BankAccount[]; onRefresh: () => Promise<void> }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filter, setFilter] = useState<'all' | 'expense' | 'income' | 'reminder' | 'card'>('all');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ created: number; skipped: number } | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Credit cards with closing/due days
  const creditCards = useMemo(
    () => accounts.filter(a => a.type === 'credit' && (a.closingDay || a.dueDay)),
    [accounts]
  );

  const getCardEvents = (day: Date) => {
    if (!isSameMonth(day, monthStart)) return [];
    const d = parseInt(format(day, 'd'));
    const events: { cardName: string; color: string; kind: 'closing' | 'due' }[] = [];
    creditCards.forEach(acc => {
      if (acc.closingDay === d) events.push({ cardName: acc.name, color: acc.color, kind: 'closing' });
      if (acc.dueDay === d) events.push({ cardName: acc.name, color: acc.color, kind: 'due' });
    });
    return events;
  };

  const getDayData = (day: Date) => {
    const dayReminders = reminders.filter(r => isSameDay(r.dueDate.toDate(), day));
    const dayTransactions = transactions.filter(t => isSameDay(t.date.toDate(), day));
    const cardEvents = getCardEvents(day);

    let filteredReminders = dayReminders;
    let filteredTransactions = dayTransactions;
    let filteredCardEvents = cardEvents;

    if (filter === 'expense') {
      filteredReminders = dayReminders.filter(r => r.type === 'expense');
      filteredTransactions = dayTransactions.filter(t => t.type === 'expense');
      filteredCardEvents = [];
    } else if (filter === 'income') {
      filteredReminders = dayReminders.filter(r => r.type === 'income');
      filteredTransactions = dayTransactions.filter(t => t.type === 'income');
      filteredCardEvents = [];
    } else if (filter === 'reminder') {
      filteredTransactions = [];
      filteredCardEvents = [];
    } else if (filter === 'card') {
      filteredReminders = [];
      filteredTransactions = [];
    }

    const totalExpense = [...filteredReminders.filter(r => r.type === 'expense'), ...filteredTransactions.filter(t => t.type === 'expense' && !t.isTransfer)]
      .reduce((sum, item) => sum + item.amount, 0);
    const totalIncome = [...filteredReminders.filter(r => r.type === 'income'), ...filteredTransactions.filter(t => t.type === 'income' && !t.isTransfer)]
      .reduce((sum, item) => sum + item.amount, 0);

    return { reminders: filteredReminders, transactions: filteredTransactions, cardEvents: filteredCardEvents, totalExpense, totalIncome, isCritical: totalExpense > 500 };
  };

  const handleGenerateReminders = async () => {
    setGenerating(true);
    setGenResult(null);
    let created = 0;
    let skipped = 0;

    // Helper: next date with a given day-of-month (from today forward)
    const nextDateWithDay = (day: number): string => {
      const now = new Date();
      const candidate = new Date(now.getFullYear(), now.getMonth(), day);
      if (candidate < now) candidate.setMonth(candidate.getMonth() + 1);
      return candidate.toISOString().split('T')[0];
    };

    for (const card of creditCards) {
      // Vencimento (due day) → expense reminder to pay the bill
      if (card.dueDay) {
        const title = `Vencimento — ${card.name}`;
        const alreadyExists = reminders.some(
          r => r.title === title && (r.frequency === 'monthly' || r.frequency === 'once')
        );
        if (alreadyExists) {
          skipped++;
        } else {
          await remindersApi.create({
            title,
            amount: Math.max(0, card.balance ?? 0),
            type: 'expense',
            dueDate: nextDateWithDay(card.dueDay),
            frequency: 'monthly',
            accountId: card.id,
            notes: `Pagamento da fatura do cartão ${card.name}. Vencimento todo dia ${card.dueDay}.`,
          });
          created++;
        }
      }

      // Fechamento (closing day) → expense reminder to stop spending
      if (card.closingDay) {
        const title = `Fechamento — ${card.name}`;
        const alreadyExists = reminders.some(
          r => r.title === title && (r.frequency === 'monthly' || r.frequency === 'once')
        );
        if (alreadyExists) {
          skipped++;
        } else {
          await remindersApi.create({
            title,
            amount: 0,
            type: 'expense',
            dueDate: nextDateWithDay(card.closingDay),
            frequency: 'monthly',
            accountId: card.id,
            notes: `Fechamento da fatura do cartão ${card.name}. Fecha todo dia ${card.closingDay}.`,
          });
          created++;
        }
      }
    }

    await onRefresh();
    setGenResult({ created, skipped });
    setGenerating(false);
  };

  // Build a list of upcoming card events this month for the summary panel
  const upcomingCardEvents = useMemo(() => {
    const today = new Date();
    return days
      .filter(d => isSameMonth(d, monthStart))
      .flatMap(d => getCardEvents(d).map(ev => ({ ...ev, date: d })))
      .filter(ev => ev.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [days, creditCards, monthStart]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-blue-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Icons.ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-xl font-bold text-blue-900 dark:text-slate-100 capitalize min-w-[150px] text-center">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-blue-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Icons.ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {creditCards.length > 0 && (
            <button
              onClick={handleGenerateReminders}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-2xl border border-blue-200 dark:border-slate-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-50 transition-all"
            >
              <Icons.Bell className="w-3.5 h-3.5" />
              {generating ? 'Gerando...' : 'Gerar lembretes dos cartões'}
            </button>
          )}
          <div className="flex p-1 bg-blue-100 dark:bg-slate-800 rounded-2xl overflow-x-auto">
            {(['all', 'expense', 'income', 'reminder', 'card'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn('px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all', filter === f ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-slate-100 shadow-sm' : 'text-blue-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-slate-200')}
              >
                {f === 'all' && 'Tudo'}
                {f === 'expense' && 'Despesas'}
                {f === 'income' && 'Receitas'}
                {f === 'reminder' && 'Lembretes'}
                {f === 'card' && '💳 Cartões'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generation result feedback */}
      <AnimatePresence>
        {genResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              'flex items-center gap-3 p-4 rounded-2xl border text-sm font-medium',
              genResult.created > 0
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                : 'bg-blue-50 dark:bg-slate-800 border-blue-200 dark:border-slate-700 text-blue-600 dark:text-blue-400'
            )}
          >
            <Icons.Bell className="w-4 h-4 shrink-0" />
            <span>
              {genResult.created > 0
                ? `${genResult.created} lembrete${genResult.created > 1 ? 's' : ''} criado${genResult.created > 1 ? 's' : ''} com sucesso!`
                : 'Nenhum lembrete novo — todos os cartões já possuem lembretes configurados.'}
              {genResult.skipped > 0 && genResult.created > 0 && ` (${genResult.skipped} já existiam)`}
            </span>
            <button onClick={() => setGenResult(null)} className="ml-auto text-current opacity-50 hover:opacity-100 transition-opacity">
              <Icons.X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      {creditCards.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-orange-400" />
            <span className="text-xs font-medium text-blue-500 dark:text-slate-400">Fechamento da fatura</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span className="text-xs font-medium text-blue-500 dark:text-slate-400">Vencimento da fatura</span>
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-blue-200/60 dark:border-slate-700/60 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-blue-100 dark:border-slate-700 bg-blue-50/50 dark:bg-slate-800/50">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="py-3 text-center text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const data = getDayData(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const hasClosing = data.cardEvents.some(e => e.kind === 'closing');
            const hasDue = data.cardEvents.some(e => e.kind === 'due');
            const hasEvents = data.cardEvents.length > 0 || data.reminders.length > 0 || data.transactions.length > 0;
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;

            return (
              <div
                key={day.toString()}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={cn(
                  "min-h-[100px] sm:min-h-[120px] p-2 border-r border-b border-blue-100 dark:border-slate-700/50 last:border-r-0 transition-all relative",
                  !isCurrentMonth && "bg-blue-50/30 dark:bg-slate-800/30",
                  isToday(day) && "bg-blue-900/[0.02] dark:bg-blue-500/5",
                  hasDue && isCurrentMonth && "ring-1 ring-inset ring-red-200 dark:ring-red-900/40",
                  hasClosing && isCurrentMonth && !hasDue && "ring-1 ring-inset ring-orange-200 dark:ring-orange-900/40",
                  isSelected && "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-400 dark:ring-blue-500",
                  hasEvents && isCurrentMonth && "cursor-pointer hover:bg-blue-50/60 dark:hover:bg-slate-800/60",
                  !hasEvents && "cursor-default"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                    isSelected ? "bg-blue-600 text-white" :
                    isToday(day) ? "bg-blue-900 dark:bg-blue-500 text-white" :
                    isCurrentMonth ? "text-blue-900 dark:text-slate-200" : "text-blue-300 dark:text-slate-600"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {data.isCritical && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                </div>

                <div className="space-y-0.5">
                  {data.cardEvents.map((ev, idx) => (
                    <div key={idx} className={cn('text-[8px] font-bold px-1 py-0.5 rounded truncate flex items-center gap-0.5', ev.kind === 'closing' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300')}>
                      <Icons.CreditCard className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{ev.cardName}</span>
                    </div>
                  ))}
                  {data.totalIncome > 0 && (
                    <div className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-md truncate">
                      + {formatCurrency(data.totalIncome)}
                    </div>
                  )}
                  {data.totalExpense > 0 && (
                    <div className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md truncate", data.isCritical ? "bg-red-50 text-red-600" : "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400")}>
                      - {formatCurrency(data.totalExpense)}
                    </div>
                  )}
                  {data.reminders.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {data.reminders.map(r => (
                        <div key={r.id} className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day detail modal */}
      <AnimatePresence>
        {selectedDay && (() => {
          const allCardEvents = getCardEvents(selectedDay);
          const allReminders = reminders.filter(r => isSameDay(r.dueDate.toDate(), selectedDay));
          const allTransactions = transactions.filter(t => isSameDay(t.date.toDate(), selectedDay));
          const totalIncome = allTransactions.filter(t => t.type === 'income' && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
          const totalExpense = allTransactions.filter(t => t.type === 'expense' && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
          const isEmpty = allCardEvents.length === 0 && allReminders.length === 0 && allTransactions.length === 0;

          return (
            <motion.div
              key="day-detail-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
              onClick={() => setSelectedDay(null)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

              {/* Modal */}
              <motion.div
                key="day-detail-modal"
                initial={{ opacity: 0, y: 40, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.97 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-blue-200/60 dark:border-slate-700/60 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                {/* Drag handle (mobile) */}
                <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
                  <div className="w-10 h-1 rounded-full bg-blue-200 dark:bg-slate-700" />
                </div>

                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 dark:border-slate-700/50 bg-blue-50/50 dark:bg-slate-800/50 shrink-0">
                  <div>
                    <h3 className="text-base font-bold text-blue-900 dark:text-slate-100 capitalize">
                      {format(selectedDay, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </h3>
                    {!isEmpty && (
                      <p className="text-xs text-blue-500 dark:text-slate-400 font-medium mt-0.5">
                        {[allCardEvents.length > 0 && `${allCardEvents.length} evento${allCardEvents.length > 1 ? 's' : ''} de cartão`, allReminders.length > 0 && `${allReminders.length} lembrete${allReminders.length > 1 ? 's' : ''}`, allTransactions.length > 0 && `${allTransactions.length} transaç${allTransactions.length > 1 ? 'ões' : 'ão'}`].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setSelectedDay(null)} className="p-2 rounded-xl text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-800 transition-colors">
                    <Icons.X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable content */}
                <div className="p-6 space-y-6 overflow-y-auto">
                  {isEmpty && (
                    <div className="py-8 text-center">
                      <div className="w-12 h-12 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Icons.Calendar className="w-5 h-5 text-blue-300 dark:text-slate-500" />
                      </div>
                      <p className="text-sm text-blue-400 dark:text-slate-500 font-medium">Nenhum evento neste dia.</p>
                    </div>
                  )}

                  {/* Card events */}
                  {allCardEvents.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-3">Cartões de Crédito</p>
                      <div className="space-y-2">
                        {allCardEvents.map((ev, idx) => {
                          const card = accounts.find(a => a.type === 'credit' && a.name === ev.cardName);
                          const used = card ? Math.max(0, card.balance) : 0;
                          const available = card?.creditLimit ? Math.max(0, card.creditLimit - used) : null;

                          return (
                            <div key={idx} className={cn('p-4 rounded-2xl border', ev.kind === 'closing' ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-900/40' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/40')}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', ev.kind === 'closing' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600')}>
                                    <Icons.CreditCard className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-blue-900 dark:text-slate-100 text-sm">{ev.cardName}</p>
                                    <p className={cn('text-xs font-semibold', ev.kind === 'closing' ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400')}>
                                      {ev.kind === 'closing' ? '📅 Fechamento da fatura' : '⚠️ Vencimento — data de pagamento'}
                                    </p>
                                  </div>
                                </div>
                                {card?.creditLimit && (
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-bold text-blue-900 dark:text-slate-100">{formatCurrency(used)}</p>
                                    <p className="text-[10px] text-blue-400 dark:text-slate-500 font-medium">de {formatCurrency(card.creditLimit)}</p>
                                  </div>
                                )}
                              </div>
                              {card?.creditLimit && (
                                <div className="mt-3 space-y-1.5">
                                  <div className="h-1.5 bg-white/60 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className={cn('h-full rounded-full', used / card.creditLimit > 0.8 ? 'bg-red-500' : used / card.creditLimit > 0.5 ? 'bg-amber-500' : 'bg-emerald-500')}
                                      style={{ width: `${Math.min((used / card.creditLimit) * 100, 100)}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-[10px] font-semibold">
                                    <span className="text-blue-400 dark:text-slate-500">{((used / card.creditLimit) * 100).toFixed(0)}% utilizado</span>
                                    {available !== null && <span className="text-emerald-600">Disponível: {formatCurrency(available)}</span>}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Reminders */}
                  {allReminders.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-3">Lembretes</p>
                      <div className="space-y-2">
                        {allReminders.map(r => {
                          const cat = categories.find(c => c.id === r.category);
                          const CatIcon = cat ? Icons[cat.icon as IconName] || Icons.MoreHorizontal : Icons.MoreHorizontal;
                          return (
                            <div key={r.id} className="flex items-center gap-3 p-3.5 rounded-2xl border border-blue-100 dark:border-slate-700 bg-blue-50/30 dark:bg-slate-800/30">
                              <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', r.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-500')} style={cat ? { backgroundColor: `${cat.color}20`, color: cat.color } : {}}>
                                <CatIcon className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-blue-900 dark:text-slate-100 text-sm truncate">{r.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {cat && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>{cat.name}</span>}
                                  <span className="text-[10px] text-blue-400 dark:text-slate-500 font-medium capitalize">{r.frequency}</span>
                                </div>
                                {r.notes && <p className="text-xs text-blue-400 dark:text-slate-500 mt-1 truncate">{r.notes}</p>}
                              </div>
                              <p className={cn('font-bold text-sm shrink-0', r.type === 'income' ? 'text-emerald-600' : 'text-red-600')}>
                                {r.type === 'income' ? '+' : '−'}{formatCurrency(r.amount)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Transactions */}
                  {allTransactions.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest">Transações</p>
                        <div className="flex items-center gap-3 text-xs font-semibold">
                          {totalIncome > 0 && <span className="text-emerald-600">+{formatCurrency(totalIncome)}</span>}
                          {totalExpense > 0 && <span className="text-red-500">−{formatCurrency(totalExpense)}</span>}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {allTransactions.map(t => {
                          const cat = categories.find(c => c.id === t.category);
                          const acc = accounts.find(a => a.id === t.accountId);
                          const CatIcon = cat ? Icons[cat.icon as IconName] || Icons.MoreHorizontal : Icons.MoreHorizontal;
                          return (
                            <div key={t.id} className="flex items-center gap-3 p-3.5 rounded-2xl border border-blue-100 dark:border-slate-700 bg-blue-50/30 dark:bg-slate-800/30">
                              <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', t.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-500')} style={cat ? { backgroundColor: `${cat.color}20`, color: cat.color } : {}}>
                                <CatIcon className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-blue-900 dark:text-slate-100 text-sm truncate">{t.description || cat?.name || 'Sem descrição'}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {cat && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>{cat.name}</span>}
                                  {acc && (
                                    <span className="text-[10px] text-blue-400 dark:text-slate-500 font-medium flex items-center gap-0.5">
                                      {t.paymentMethod === 'credit' ? <Icons.CreditCard className="w-3 h-3" /> : <Icons.Landmark className="w-3 h-3" />}
                                      {acc.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className={cn('font-bold text-sm shrink-0', t.type === 'income' ? 'text-emerald-600' : 'text-blue-900 dark:text-slate-100')}>
                                {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm">
          <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Receitas</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(days.reduce((sum, day) => sum + getDayData(day).totalIncome, 0))}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm">
          <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Despesas</p>
          <p className="text-xl font-bold text-blue-900 dark:text-slate-100">{formatCurrency(days.reduce((sum, day) => sum + getDayData(day).totalExpense, 0))}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm">
          <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-1">Saldo do Período</p>
          <p className="text-xl font-bold text-blue-900 dark:text-slate-100">{formatCurrency(days.reduce((sum, day) => sum + (getDayData(day).totalIncome - getDayData(day).totalExpense), 0))}</p>
        </div>
      </div>

      {/* Upcoming card events this month */}
      {upcomingCardEvents.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm p-5">
          <h4 className="text-sm font-bold text-blue-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Icons.CreditCard className="w-4 h-4 text-blue-400" />
            Próximos eventos de cartão — {format(currentDate, 'MMMM', { locale: ptBR })}
          </h4>
          <div className="space-y-2">
            {upcomingCardEvents.map((ev, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 dark:bg-slate-800/50 border border-blue-100/50 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold', ev.kind === 'closing' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600')}>
                    {format(ev.date, 'd')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-slate-100">{ev.cardName}</p>
                    <p className={cn('text-xs font-medium', ev.kind === 'closing' ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400')}>
                      {ev.kind === 'closing' ? 'Fechamento da fatura' : 'Vencimento — data de pagamento'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-400 dark:text-slate-500 uppercase tracking-wider">
                  {format(ev.date, "dd MMM", { locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
