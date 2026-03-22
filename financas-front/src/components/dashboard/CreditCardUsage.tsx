import React, { useMemo } from 'react';
import { cn, formatCurrency } from '../../lib/utils';
import { motion } from 'motion/react';
import { Card } from '../ui';
import { Transaction, BankAccount } from '../../types';

export function CreditCardUsage({ accounts, transactions, onPayBill }: { accounts: BankAccount[]; transactions: Transaction[]; onPayBill?: (toId: string, amount: number) => void }) {
  const creditCards = useMemo(() => {
    return accounts
      .filter(a => a.type === 'credit' && a.creditLimit && a.creditLimit > 0)
      .map(acc => {
        const used = Math.max(0, acc.balance);
        const available = Math.max(0, acc.creditLimit! - used);
        const percentage = Math.min((used / acc.creditLimit!) * 100, 100);
        return { id: acc.id, name: acc.name, used, available, limit: acc.creditLimit!, percentage, color: acc.color };
      });
  }, [accounts, transactions]);

  if (creditCards.length === 0) return null;

  return (
    <Card title="Cartões de Crédito" subtitle="Limite utilizado vs disponível" className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="space-y-6">
        {creditCards.map(card => (
          <div key={card.id} className="space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-blue-900 dark:text-slate-100 text-sm">{card.name}</h4>
                <p className="text-[10px] text-blue-500 dark:text-slate-400 font-medium uppercase tracking-wider">Limite: {formatCurrency(card.limit)}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className={cn("text-sm font-bold", card.percentage > 90 ? "text-red-600" : "text-blue-900 dark:text-slate-100")}>
                    {formatCurrency(card.used)}
                  </span>
                  <span className="text-blue-400 dark:text-slate-500 text-xs mx-1">utilizado</span>
                </div>
                {onPayBill && card.used > 0 && (
                  <button
                    onClick={() => onPayBill(card.id, card.used)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors whitespace-nowrap"
                  >
                    Pagar Fatura
                  </button>
                )}
              </div>
            </div>

            <div className="relative h-3 bg-blue-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${card.percentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={cn("absolute h-full rounded-full", card.percentage > 90 ? "bg-red-500" : card.percentage > 70 ? "bg-amber-500" : "bg-emerald-500")}
                style={{ backgroundColor: card.percentage <= 70 ? card.color : undefined }}
              />
            </div>

            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-blue-400">{card.percentage.toFixed(1)}% utilizado</span>
              <span className="text-emerald-600">Disponível: {formatCurrency(card.available)}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
