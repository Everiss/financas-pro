import React, { useMemo } from 'react';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { Icons, IconName } from '../Icons';
import { Button, Card } from '../ui';
import { transactionsApi, remindersApi } from '../../services/api';
import { Reminder, Category, BankAccount } from '../../types';

export function ReminderItem({ reminder, category, accounts, userId, onRefresh }: { reminder: Reminder; category?: Category; accounts: BankAccount[]; userId: string; onRefresh: () => Promise<void>; key?: React.Key }) {
  const Icon = category ? Icons[category.icon as IconName] : Icons.Calendar;
  const isOverdue = reminder.dueDate.toDate() < new Date();

  // For credit card reminders, use current card balance instead of stored amount
  const account = reminder.accountId ? accounts.find(a => a.id === reminder.accountId) : undefined;
  const effectiveAmount = account?.type === 'credit' ? Math.max(0, account.balance) : reminder.amount;

  const handlePay = async () => {
    try {
      await transactionsApi.create({
        amount: effectiveAmount,
        type: reminder.type,
        categoryId: reminder.category,
        date: new Date().toISOString().split('T')[0],
        description: reminder.title,
        accountId: reminder.accountId,
        paymentMethod: account?.type === 'credit' ? 'credit' : 'debit',
      });

      if (reminder.frequency === 'once') {
        await remindersApi.delete(reminder.id);
      } else {
        const nextDate = new Date(reminder.dueDate.toDate());
        if (reminder.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        if (reminder.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        if (reminder.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        if (reminder.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
        await remindersApi.update(reminder.id, { dueDate: nextDate.toISOString().split('T')[0] });
      }
      await onRefresh();
    } catch (err) {
      console.error('Erro ao registrar pagamento:', err);
    }
  };

  return (
    <div className="flex items-center gap-4 group bg-white dark:bg-slate-800/50 hover:bg-blue-50/80 dark:hover:bg-slate-800 p-4 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm transition-all duration-300">
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105', reminder.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600')}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-blue-800 dark:text-slate-200 truncate">{reminder.title}</p>
        {reminder.notes && <p className="text-xs text-blue-400 dark:text-slate-500 truncate mt-0.5 italic">{reminder.notes}</p>}
        <div className="flex items-center gap-2 text-xs mt-1">
          <span className={isOverdue ? 'text-red-500 font-semibold bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-md' : 'text-blue-500 dark:text-slate-400 font-medium'}>
            {isOverdue ? 'Atrasado: ' : 'Vence: '} {formatDate(reminder.dueDate.toDate())}
          </span>
          {reminder.accountId && (
            <span className="text-blue-400 dark:text-slate-500 flex items-center gap-1">
              • <Icons.Wallet className="w-3 h-3" /> {accounts.find(a => a.id === reminder.accountId)?.name || 'Conta não encontrada'}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className={cn('font-bold text-right text-lg tracking-tight', reminder.type === 'income' ? 'text-emerald-600' : 'text-blue-900 dark:text-slate-100')}>
          {formatCurrency(effectiveAmount)}
        </div>
        <Button
          variant="secondary"
          className={cn(
            "px-4 py-1.5 text-xs font-semibold h-auto transition-all",
            reminder.type === 'income' ? "hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200" : "hover:bg-blue-900 hover:text-white"
          )}
          onClick={handlePay}
        >
          {reminder.type === 'income' ? 'Receber' : 'Pagar'}
        </Button>
      </div>
    </div>
  );
}

export function UpcomingReminders({ reminders, categories, accounts, userId, onRefresh }: { reminders: Reminder[]; categories: Category[]; accounts: BankAccount[]; userId: string; onRefresh: () => Promise<void> }) {
  const upcoming = useMemo(() => {
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    return reminders.filter(r => r.dueDate.toDate() <= nextWeek).slice(0, 3);
  }, [reminders]);

  if (upcoming.length === 0) return null;

  return (
    <Card title="Próximos Vencimentos" subtitle="Lembretes para os próximos 7 dias" className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="space-y-2">
        {upcoming.map(r => (
          <ReminderItem key={r.id} reminder={r} category={categories.find(c => c.id === r.category)} accounts={accounts} userId={userId} onRefresh={onRefresh} />
        ))}
      </div>
    </Card>
  );
}
