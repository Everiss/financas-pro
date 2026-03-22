import React, { useState } from 'react';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Icons, IconName } from '../components/Icons';
import { Button, Card } from '../components/ui';
import { goalsApi, AiGoalsStrategy } from '../services/api';
import { Goal, Transaction, BankAccount, Category } from '../types';
import { PlanGate } from '../components/PlanGate';
import { GoalModal } from '../components/modals/GoalModal';
import { getGoalInsights } from '../services/aiService';

export function GoalItem({ goal, onEdit, onDelete }: { goal: Goal; onEdit: () => void; onDelete: () => void; key?: string }) {
  const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  const Icon = Icons[goal.icon as IconName] || Icons.Target;
  const isCompleted = goal.currentAmount >= goal.targetAmount;

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden border-none shadow-sm">
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${goal.color}20`, color: goal.color }}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-blue-900 dark:text-slate-100 text-lg leading-tight">{goal.name}</h4>
              <p className="text-xs text-blue-500 dark:text-slate-400 font-semibold uppercase tracking-widest mt-0.5">{goal.category}</p>
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 transition-colors">
              <Icons.Edit2 className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 transition-colors">
              <Icons.Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-2xl font-bold text-blue-900 dark:text-slate-100">{percentage.toFixed(0)}%</span>
            <span className="text-xs font-bold text-blue-500 dark:text-slate-400 uppercase tracking-wider">
              {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
            </span>
          </div>
          <div className="h-3 bg-blue-50 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ backgroundColor: goal.color }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-blue-50">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-500">
            <Icons.Calendar className="w-3.5 h-3.5" />
            {goal.deadline ? formatDate(goal.deadline.toDate()) : 'Sem prazo'}
          </div>
          {isCompleted && (
            <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold uppercase tracking-widest">
              <Icons.CheckCircle className="w-4 h-4" />
              Concluído
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function GoalsView({ goals, userId, transactions, accounts, categories, onRefresh }: { goals: Goal[]; userId: string; transactions: Transaction[]; accounts: BankAccount[]; categories: Category[]; onRefresh: () => Promise<void> }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [aiAdvice, setAiAdvice] = useState<AiGoalsStrategy | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setIsModalOpen(true);
  };

  const handleDelete = async (goalId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta meta?')) {
      try {
        await goalsApi.delete(goalId);
        await onRefresh();
      } catch (error) {
        console.error('Erro ao excluir meta:', error);
      }
    }
  };

  const getAiHelp = async () => {
    if (goals.length === 0) return;
    setLoadingAi(true);
    const insights = await getGoalInsights();
    if (insights) setAiAdvice(insights);
    setLoadingAi(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-blue-900 dark:text-slate-100">Suas Metas</h3>
          <p className="text-sm text-blue-500 dark:text-slate-400">Planeje e acompanhe seus objetivos financeiros.</p>
        </div>
        <div className="flex gap-2">
          <PlanGate feature="ai">
            <Button variant="secondary" onClick={getAiHelp} disabled={loadingAi || goals.length === 0} className="relative overflow-hidden group">
              {loadingAi && (
                <motion.div
                  layoutId="ai-loading"
                  className="absolute inset-0 bg-blue-600/10"
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                />
              )}
              <Icons.Sparkles className={cn("w-4 h-4 relative z-10", loadingAi && "animate-spin text-blue-600")} />
              <span className="relative z-10">{loadingAi ? 'Analisando seu Perfil...' : 'Consultar IA'}</span>
            </Button>
          </PlanGate>
          <PlanGate limit="goals" current={goals.length}>
            <Button onClick={() => { setEditingGoal(null); setIsModalOpen(true); }}>
              <Icons.Plus className="w-4 h-4" />
              Nova Meta
            </Button>
          </PlanGate>
        </div>
      </div>

      {aiAdvice && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden border border-white/10"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <Icons.Sparkles className="w-48 h-48" />
          </div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Icons.Sparkles className="w-6 h-6 text-blue-300" />
                </div>
                <div>
                  <h4 className="font-bold text-xl tracking-tight">Estratégias Personalizadas</h4>
                  <p className="text-blue-300/60 text-xs font-bold uppercase tracking-widest">Análise via Gemini AI</p>
                </div>
              </div>
              <button
                onClick={() => setAiAdvice(null)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <Icons.X className="w-5 h-5 text-white/50" />
              </button>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-8">
              <p className="text-blue-100 text-sm leading-relaxed italic">
                <Icons.Quote className="w-4 h-4 text-blue-400 inline-block mr-2 mb-1 rotate-180" />
                {aiAdvice.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {aiAdvice.advice.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all duration-300 group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h5 className="font-bold text-lg text-white group-hover:text-blue-300 transition-colors">{item.goalName}</h5>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                      item.feasibility === 'Alta' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      item.feasibility === 'Média' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                    )}>
                      Viabilidade: {item.feasibility}
                    </div>
                  </div>

                  <p className="text-sm text-blue-100/70 leading-relaxed mb-6">{item.strategy}</p>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-blue-300/40 uppercase tracking-widest">Tempo Estimado</p>
                      <div className="flex items-center gap-2 text-sm font-bold text-blue-100">
                        <Icons.Calendar className="w-4 h-4 text-blue-400" />
                        {item.estimatedTime}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-blue-300/40 uppercase tracking-widest">Aporte Mensal</p>
                      <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                        <Icons.TrendingUp className="w-4 h-4" />
                        {item.monthlySavingNeeded}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-dashed border-blue-200 dark:border-slate-600">
            <div className="w-20 h-20 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.Target className="w-10 h-10 text-blue-300 dark:text-slate-500" />
            </div>
            <h4 className="text-lg font-bold text-blue-900 dark:text-slate-100">Nenhuma meta definida</h4>
            <p className="text-blue-500 dark:text-slate-400 max-w-xs mx-auto mt-2">Comece a planejar seu futuro criando sua primeira meta financeira.</p>
            <Button variant="secondary" className="mt-6" onClick={() => setIsModalOpen(true)}>Criar Primeira Meta</Button>
          </div>
        ) : (
          goals.map(goal => (
            <GoalItem key={goal.id} goal={goal} onEdit={() => handleEdit(goal)} onDelete={() => { handleDelete(goal.id!); }} />
          ))
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <GoalModal
            onClose={() => setIsModalOpen(false)}
            userId={userId}
            goal={editingGoal}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
