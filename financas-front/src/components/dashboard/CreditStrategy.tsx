import React, { useMemo } from 'react';
import { Icons } from '../Icons';
import { Card } from '../ui';
import { BankAccount } from '../../types';

export function CreditStrategy({ accounts }: { accounts: BankAccount[] }) {
  const creditCards = accounts.filter(a => a.type === 'credit' && a.closingDay);

  const bestCard = useMemo(() => {
    if (creditCards.length === 0) return null;

    const today = new Date().getDate();

    return creditCards.reduce((best, current) => {
      if (!best) return current;

      const getDaysSinceClosing = (closingDay: number) => {
        if (today > closingDay) return today - closingDay;
        return today + (31 - closingDay); // Using 31 for safety
      };

      const bestDays = getDaysSinceClosing(best.closingDay!);
      const currentDays = getDaysSinceClosing(current.closingDay!);

      return currentDays < bestDays ? current : best;
    }, null as BankAccount | null);
  }, [creditCards]);

  if (!bestCard) return null;

  return (
    <Card className="border-none shadow-sm bg-indigo-50/50 backdrop-blur-sm border border-indigo-100/50 p-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
          <Icons.TrendingUp className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest">Estratégia de Compra</h3>
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">RECOMENDADO</span>
          </div>
          <p className="text-blue-700 text-sm mt-1">
            Melhor cartão para usar hoje: <span className="font-bold text-indigo-800">{bestCard.name}</span>
          </p>
          <p className="text-[10px] text-blue-500 font-medium mt-1">
            O fechamento foi dia {bestCard.closingDay}, garantindo o maior prazo para pagamento da próxima fatura.
          </p>
        </div>
      </div>
    </Card>
  );
}
