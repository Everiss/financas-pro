import React from 'react';
import { cn, formatCurrency } from '../../lib/utils';
import { Card } from '../ui';
import { Transaction, Category } from '../../types';

export function BudgetProgress({ transactions, categories, month }: { transactions: Transaction[]; categories: Category[]; month: Date }) {
  const expensesThisMonth = transactions.filter(t => {
    const d = t.date.toDate();
    return t.type === 'expense' && !t.isTransfer && d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
  });

  const categoriesWithBudget = categories.filter(c => c.budget && c.budget > 0);

  if (categoriesWithBudget.length === 0) return null;

  return (
    <Card title="Metas de Gastos (Este Mês)" subtitle="Acompanhe seu orçamento por categoria" className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="space-y-6">
        {categoriesWithBudget.map(cat => {
          const spent = expensesThisMonth.filter(t => t.category === cat.id).reduce((acc, t) => acc + t.amount, 0);
          const budget = cat.budget!;
          const percentage = Math.min((spent / budget) * 100, 100);
          const isOverBudget = spent > budget;
          const isNearBudget = percentage >= 80 && !isOverBudget;

          return (
            <div key={cat.id} className="space-y-3">
              <div className="flex justify-between text-sm items-end">
                <span className="font-medium flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </span>
                <span className="text-blue-500 dark:text-slate-400 text-xs font-medium">
                  <span className={cn("text-sm", isOverBudget ? 'text-red-600 font-bold' : 'text-blue-900 dark:text-slate-100')}>
                    {formatCurrency(spent)}
                  </span>
                  <span className="mx-1">/</span>
                  {formatCurrency(budget)}
                </span>
              </div>
              <div className="h-2 bg-blue-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    isOverBudget ? "bg-red-500" : isNearBudget ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
