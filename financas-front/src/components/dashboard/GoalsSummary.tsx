import React from 'react';
import { cn, formatCurrency } from '../../lib/utils';
import { motion } from 'motion/react';
import { Icons, IconName } from '../Icons';
import { Button, Card } from '../ui';
import { Goal } from '../../types';

export function GoalsSummary({ goals, onSeeAll }: { goals: Goal[]; onSeeAll: () => void }) {
  const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount);

  if (activeGoals.length === 0) return null;

  return (
    <Card
      title="Metas Financeiras"
      subtitle="Acompanhe o progresso dos seus sonhos"
      className="border-none shadow-sm bg-white/50 backdrop-blur-sm"
      action={<Button variant="ghost" className="text-xs font-medium" onClick={onSeeAll}>Ver Todas</Button>}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {activeGoals.slice(0, 2).map(goal => {
          const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
          const Icon = Icons[goal.icon as IconName] || Icons.Target;

          return (
            <div key={goal.id} className="space-y-3 p-4 rounded-2xl bg-white dark:bg-slate-800/50 border border-blue-100 dark:border-slate-700 shadow-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${goal.color}20`, color: goal.color }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-900 dark:text-slate-100 text-sm">{goal.name}</h4>
                    <p className="text-[10px] text-blue-500 dark:text-slate-400 font-medium uppercase tracking-wider">{goal.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-blue-900 dark:text-slate-100">{percentage.toFixed(0)}%</span>
                </div>
              </div>

              <div className="h-2 bg-blue-50 dark:bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: goal.color }}
                />
              </div>

              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-blue-400 dark:text-slate-500">{formatCurrency(goal.currentAmount)}</span>
                <span className="text-blue-900 dark:text-slate-300">Alvo: {formatCurrency(goal.targetAmount)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
