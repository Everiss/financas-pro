import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';
import { Icons, IconName } from '../Icons';
import { Button, Input, Select } from '../ui';
import { goalsApi } from '../../services/api';
import { Goal } from '../../types';

export function GoalModal({ onClose, userId, goal, onRefresh }: { onClose: () => void; userId: string; goal: Goal | null; onRefresh: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: goal?.name || '',
    targetAmount: goal?.targetAmount || 0,
    currentAmount: goal?.currentAmount || 0,
    category: goal?.category || 'Viagem',
    deadline: goal?.deadline ? goal.deadline.toDate().toISOString().split('T')[0] : '',
    color: goal?.color || '#3b82f6',
    icon: goal?.icon || 'Plane'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const goalData = {
      name: form.name,
      targetAmount: Number(form.targetAmount),
      currentAmount: Number(form.currentAmount),
      category: form.category,
      deadline: form.deadline || undefined,
      color: form.color,
      icon: form.icon,
    };

    try {
      if (goal?.id) {
        await goalsApi.update(goal.id, goalData);
      } else {
        await goalsApi.create(goalData);
      }
      await onRefresh();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { name: 'Viagem', icon: 'Plane', color: '#3b82f6' },
    { name: 'Casa', icon: 'Home', color: '#10b981' },
    { name: 'Carro', icon: 'Car', color: '#f59e0b' },
    { name: 'Educação', icon: 'GraduationCap', color: '#8b5cf6' },
    { name: 'Reserva de Emergência', icon: 'Shield', color: '#ef4444' },
    { name: 'Aposentadoria', icon: 'Briefcase', color: '#6366f1' },
    { name: 'Outros', icon: 'Target', color: '#64748b' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-900/40 dark:bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-blue-100/50 dark:border-slate-700/50"
      >
        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">{goal ? 'Editar Meta' : 'Nova Meta Financeira'}</h3>
            <p className="text-blue-100 text-xs mt-1">Defina seus objetivos e acompanhe seu progresso.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Nome da Meta"
              placeholder="Ex: Viagem para o Japão"
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Valor Alvo"
                type="number"
                step="0.01"
                required
                value={form.targetAmount}
                onChange={e => setForm({ ...form, targetAmount: Number(e.target.value) })}
              />
              <Input
                label="Valor Atual"
                type="number"
                step="0.01"
                required
                value={form.currentAmount}
                onChange={e => setForm({ ...form, currentAmount: Number(e.target.value) })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Categoria"
                options={categories.map(c => ({ value: c.name, label: c.name }))}
                value={form.category}
                onChange={e => {
                  const cat = categories.find(c => c.name === e.target.value);
                  if (cat) {
                    setForm({ ...form, category: cat.name, icon: cat.icon, color: cat.color });
                  }
                }}
              />
              <Input
                label="Prazo (opcional)"
                type="date"
                value={form.deadline}
                onChange={e => setForm({ ...form, deadline: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-blue-900 uppercase tracking-widest">Ícone e Cor</label>
              <div className="flex gap-3 flex-wrap">
                {categories.map(cat => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setForm({ ...form, icon: cat.icon, color: cat.color })}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                      form.icon === cat.icon ? "ring-2 ring-offset-2 ring-blue-600 scale-110" : "opacity-60 hover:opacity-100"
                    )}
                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                  >
                    {(() => {
                      const Icon = Icons[cat.icon as IconName] || Icons.Target;
                      return <Icon className="w-5 h-5" />;
                    })()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Salvando...' : goal ? 'Salvar Alterações' : 'Criar Meta'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
