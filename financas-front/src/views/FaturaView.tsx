import React, { useState, useMemo } from 'react';
import { addMonths, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { Icons } from '../components/Icons';
import { Card } from '../components/ui';
import { Transaction, Category, BankAccount } from '../types';

// Calcula o período da fatura com base no mês de referência e no dia de fechamento
function getInvoicePeriod(referenceMonth: Date, closingDay: number, dueDay: number) {
  const year = referenceMonth.getFullYear();
  const month = referenceMonth.getMonth(); // 0-based

  // Fecha no dia `closingDay` do mês de referência
  const closeDate = new Date(year, month, closingDay);

  // Abre no dia seguinte ao fechamento do mês anterior
  const openDate = new Date(year, month - 1, closingDay + 1);

  // Vencimento: dia `dueDay` do mês de referência (ou próximo se dueDay < closingDay)
  const dueMonth = dueDay <= closingDay ? month + 1 : month;
  const dueDate = new Date(year, dueMonth, dueDay);

  return { openDate, closeDate, dueDate };
}

export function FaturaView({
  accounts,
  transactions,
  categories,
  onPayBill,
}: {
  accounts: BankAccount[];
  transactions: Transaction[];
  categories: Category[];
  onPayBill: (toId: string, amount: number) => void;
}) {
  const creditCards = useMemo(
    () => accounts.filter(a => a.type === 'credit'),
    [accounts]
  );

  const [selectedCardId, setSelectedCardId] = useState<string>(
    () => creditCards[0]?.id ?? ''
  );
  const [referenceMonth, setReferenceMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const selectedCard = creditCards.find(c => c.id === selectedCardId);

  const { openDate, closeDate, dueDate } = useMemo(() => {
    if (!selectedCard) return { openDate: new Date(), closeDate: new Date(), dueDate: new Date() };
    return getInvoicePeriod(
      referenceMonth,
      selectedCard.closingDay ?? 1,
      selectedCard.dueDay ?? 10
    );
  }, [selectedCard, referenceMonth]);

  const invoiceTransactions = useMemo(() => {
    if (!selectedCard) return [];
    return transactions
      .filter(t => {
        if (t.accountId !== selectedCard.id) return false;
        if (t.isTransfer) return false; // ignora pagamentos de fatura
        const d = t.date.toDate();
        return d >= openDate && d <= closeDate;
      })
      .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
  }, [selectedCard, transactions, openDate, closeDate]);

  const totalFatura = useMemo(
    () => invoiceTransactions
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0),
    [invoiceTransactions]
  );

  const today = new Date();
  const isClosed = today > closeDate;
  const isFuture = referenceMonth > today;

  if (creditCards.length === 0) {
    return (
      <Card className="py-24 text-center">
        <div className="w-16 h-16 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icons.CreditCard className="w-6 h-6 text-blue-300 dark:text-slate-500" />
        </div>
        <p className="text-blue-500 dark:text-slate-400 font-medium">
          Nenhum cartão de crédito cadastrado.
        </p>
        <p className="text-sm text-blue-400 dark:text-slate-500 mt-1">
          Adicione um cartão em <span className="font-semibold">Contas</span> para visualizar as faturas.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seletor de cartão */}
      <div className="flex flex-wrap gap-2">
        {creditCards.map(card => (
          <button
            key={card.id}
            onClick={() => setSelectedCardId(card.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all duration-200',
              selectedCardId === card.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white dark:bg-slate-900 text-blue-700 dark:text-slate-300 border border-blue-100 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-500'
            )}
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: card.color }}
            />
            {card.name}
          </button>
        ))}
      </div>

      {selectedCard && (
        <>
          {/* Cabeçalho do período */}
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

          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-xs font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider mb-1">Total da Fatura</p>
              <p className="text-xl font-bold text-blue-900 dark:text-slate-100">{formatCurrency(totalFatura)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider mb-1">Limite Disponível</p>
              <p className="text-xl font-bold text-emerald-600">
                {formatCurrency(Math.max(0, (selectedCard.creditLimit ?? 0) - Math.max(0, selectedCard.balance)))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider mb-1">Limite Total</p>
              <p className="text-xl font-bold text-blue-900 dark:text-slate-100">{formatCurrency(selectedCard.creditLimit ?? 0)}</p>
            </Card>
            <Card className="p-4 flex flex-col justify-between">
              <p className="text-xs font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider mb-1">Pagar Fatura</p>
              <button
                onClick={() => onPayBill(selectedCard.id, Math.max(0, selectedCard.balance))}
                disabled={selectedCard.balance <= 0}
                className="mt-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Icons.Banknote className="w-4 h-4" />
                Pagar
              </button>
            </Card>
          </div>

          {/* Barra de uso do limite */}
          {(selectedCard.creditLimit ?? 0) > 0 && (
            <div className="bg-white/70 dark:bg-slate-900/70 rounded-2xl px-5 py-4 border border-blue-100/50 dark:border-slate-700/50 shadow-sm">
              <div className="flex justify-between text-xs font-semibold mb-2">
                <span className="text-blue-500 dark:text-slate-400">
                  Usado: {formatCurrency(Math.max(0, selectedCard.balance))}
                </span>
                <span className="text-blue-400 dark:text-slate-500">
                  {((Math.max(0, selectedCard.balance) / (selectedCard.creditLimit ?? 1)) * 100).toFixed(0)}% do limite
                </span>
              </div>
              <div className="w-full h-2 bg-blue-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    (selectedCard.balance / (selectedCard.creditLimit ?? 1)) > 0.8
                      ? 'bg-red-500'
                      : (selectedCard.balance / (selectedCard.creditLimit ?? 1)) > 0.5
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  )}
                  style={{ width: `${Math.min(100, (Math.max(0, selectedCard.balance) / (selectedCard.creditLimit ?? 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Tabela de transações */}
          <Card className="p-0 overflow-hidden border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="px-6 py-4 border-b border-blue-100 dark:border-slate-700 flex items-center justify-between">
              <h4 className="font-semibold text-blue-900 dark:text-slate-100">
                Transações no período
              </h4>
              <span className="text-xs font-semibold text-blue-400 dark:text-slate-500 bg-blue-50 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                {invoiceTransactions.length} lançamento{invoiceTransactions.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-blue-100 dark:border-slate-700 bg-blue-50/50 dark:bg-slate-800/50">
                    <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Descrição</th>
                    <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Categoria</th>
                    <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100/50 dark:divide-slate-700/50">
                  {invoiceTransactions.map(t => {
                    const cat = categories.find(c => c.id === t.category);
                    return (
                      <tr key={t.id} className="hover:bg-blue-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-blue-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(t.date.toDate())}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-blue-800 dark:text-slate-200">
                          {t.description || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            {cat?.name || 'Outros'}
                          </span>
                        </td>
                        <td className={cn(
                          'px-6 py-4 text-sm font-bold text-right whitespace-nowrap tracking-tight',
                          t.type === 'income' ? 'text-emerald-600' : 'text-blue-900 dark:text-slate-100'
                        )}>
                          {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {invoiceTransactions.length === 0 && (
              <div className="py-24 text-center">
                <div className="w-16 h-16 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icons.CreditCard className="w-6 h-6 text-blue-300 dark:text-slate-500" />
                </div>
                <p className="text-blue-500 dark:text-slate-400 font-medium">
                  Nenhuma transação neste período.
                </p>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
