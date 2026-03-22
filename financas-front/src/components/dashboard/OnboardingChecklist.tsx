import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Icons } from '../Icons';
import { Bank, BankAccount, Category, Transaction } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  userId: string;
  banks: Bank[];
  accounts: BankAccount[];
  categories: Category[];
  transactions: Transaction[];
  onNavigate: (tab: string) => void;
  onAddTransaction: () => void;
}

interface Step {
  id: string;
  label: string;
  description: string;
  done: boolean;
  icon: keyof typeof Icons;
  action: { label: string; onClick: () => void };
}

function storageKey(userId: string) {
  return `onboarding_dismissed_${userId}`;
}

export function OnboardingChecklist({ userId, banks, accounts, categories, transactions, onNavigate, onAddTransaction }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(storageKey(userId)) === 'true';
  });
  const [allDoneAck, setAllDoneAck] = useState(false);

  const hasIncome  = transactions.some(t => t.type === 'income'  && !t.isTransfer);
  const hasExpense = transactions.some(t => t.type === 'expense' && !t.isTransfer);

  const steps: Step[] = [
    {
      id: 'bank',
      label: 'Cadastre seu banco',
      description: 'Crie pelo menos um banco para poder adicionar contas.',
      done: banks.length > 0,
      icon: 'Landmark',
      action: { label: 'Ir para Contas', onClick: () => onNavigate('accounts') },
    },
    {
      id: 'account',
      label: 'Adicione uma conta ou cartão',
      description: 'Cadastre sua conta corrente, poupança ou cartão de crédito com o saldo atual.',
      done: accounts.length > 0,
      icon: 'CreditCard',
      action: { label: 'Ir para Contas', onClick: () => onNavigate('accounts') },
    },
    {
      id: 'category',
      label: 'Crie suas categorias',
      description: 'Organize seus gastos e receitas em categorias (ex.: Alimentação, Salário).',
      done: categories.length > 0,
      icon: 'Tag',
      action: { label: 'Ir para Categorias', onClick: () => onNavigate('categories') },
    },
    {
      id: 'income',
      label: 'Registre sua primeira receita',
      description: 'Lance seu salário ou qualquer entrada de dinheiro em uma conta.',
      done: hasIncome,
      icon: 'TrendingUp',
      action: { label: 'Nova Transação', onClick: onAddTransaction },
    },
    {
      id: 'expense',
      label: 'Registre sua primeira despesa',
      description: 'Lance um gasto e vincule-o a uma conta ou cartão de crédito.',
      done: hasExpense,
      icon: 'ShoppingCart',
      action: { label: 'Nova Transação', onClick: onAddTransaction },
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone   = doneCount === steps.length;
  const progress  = Math.round((doneCount / steps.length) * 100);

  // Quando tudo for concluído, aguarda 4s e descarta automaticamente
  useEffect(() => {
    if (allDone && !dismissed) {
      setAllDoneAck(true);
      const t = setTimeout(() => {
        localStorage.setItem(storageKey(userId), 'true');
        setDismissed(true);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [allDone, dismissed, userId]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey(userId), 'true');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        className="bg-white dark:bg-slate-900 rounded-3xl border border-blue-100 dark:border-slate-700 shadow-sm overflow-hidden"
      >
        {/* Header */}
        <div className={cn(
          'px-6 py-5 flex items-center justify-between',
          allDone
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-800/40'
            : 'bg-blue-50/60 dark:bg-slate-800/50 border-b border-blue-100 dark:border-slate-700'
        )}>
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0',
              allDone ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-blue-100 dark:bg-slate-700'
            )}>
              {allDone
                ? <Icons.CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                : <Icons.Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              }
            </div>
            <div>
              {allDone ? (
                <>
                  <h4 className="font-bold text-emerald-800 dark:text-emerald-300">Configuração concluída!</h4>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">Seu perfil financeiro está pronto. Esta mensagem será fechada automaticamente.</p>
                </>
              ) : (
                <>
                  <h4 className="font-bold text-blue-900 dark:text-slate-100">Primeiros passos</h4>
                  <p className="text-xs text-blue-500 dark:text-slate-400 mt-0.5">{doneCount} de {steps.length} etapas concluídas</p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress ring */}
            {!allDone && (
              <div className="relative w-10 h-10 shrink-0">
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-blue-100 dark:text-slate-700" />
                  <circle
                    cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
                    strokeDasharray={`${progress * 0.942} 94.2`}
                    strokeLinecap="round"
                    className="text-blue-600 dark:text-blue-400 transition-all duration-700"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400">{progress}%</span>
              </div>
            )}
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-full text-blue-300 dark:text-slate-600 hover:text-blue-600 dark:hover:text-slate-300 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors"
              title="Fechar"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Steps */}
        {!allDone && (
          <div className="divide-y divide-blue-50 dark:divide-slate-800">
            {steps.map((step, idx) => {
              const Icon = Icons[step.icon] || Icons.Circle;
              const isNext = !step.done && steps.slice(0, idx).every(s => s.done);
              return (
                <div
                  key={step.id}
                  className={cn(
                    'flex items-center gap-4 px-6 py-4 transition-colors',
                    step.done
                      ? 'opacity-50'
                      : isNext
                        ? 'bg-blue-50/40 dark:bg-slate-800/40'
                        : ''
                  )}
                >
                  {/* Step indicator */}
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all',
                    step.done
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700'
                      : isNext
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-white dark:bg-slate-900 border-blue-200 dark:border-slate-700'
                  )}>
                    {step.done
                      ? <Icons.Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      : <Icon className={cn('w-3.5 h-3.5', isNext ? 'text-white' : 'text-blue-300 dark:text-slate-600')} />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-semibold',
                      step.done ? 'line-through text-blue-400 dark:text-slate-600' : 'text-blue-900 dark:text-slate-100'
                    )}>
                      {step.label}
                    </p>
                    {!step.done && (
                      <p className="text-xs text-blue-400 dark:text-slate-500 mt-0.5">{step.description}</p>
                    )}
                  </div>

                  {/* CTA */}
                  {!step.done && (
                    <button
                      onClick={step.action.onClick}
                      className={cn(
                        'shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl transition-all whitespace-nowrap',
                        isNext
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/30'
                          : 'bg-blue-100 dark:bg-slate-700 text-blue-600 dark:text-slate-300 hover:bg-blue-200 dark:hover:bg-slate-600'
                      )}
                    >
                      {step.action.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
