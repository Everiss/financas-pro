import React, { useState } from 'react';
import { cn, formatCurrency } from '../lib/utils';
import { Icons, IconName } from '../components/Icons';
import { Button, Card, Input } from '../components/ui';
import { categoriesApi } from '../services/api';
import { Category } from '../types';

export function CategoryManager({ categories, userId, onRefresh }: { categories: Category[]; userId: string; onRefresh: () => Promise<void> }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', icon: 'Tag', color: '#000000', budget: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBudget, setEditBudget] = useState('');

  const handleAdd = async () => {
    if (!newCat.name) return;
    try {
      const catData: any = { name: newCat.name, icon: newCat.icon, color: newCat.color };
      if (newCat.budget && parseFloat(newCat.budget) > 0) {
        catData.budget = parseFloat(newCat.budget);
      }
      await categoriesApi.create(catData);
      setNewCat({ name: '', icon: 'Tag', color: '#000000', budget: '' });
      setIsAdding(false);
      await onRefresh();
    } catch (err) {
      console.error('Erro ao criar categoria:', err);
    }
  };

  const handleUpdateBudget = async (id: string) => {
    try {
      const val = parseFloat(editBudget);
      await categoriesApi.update(id, { budget: isNaN(val) || val <= 0 ? 0 : val });
      setEditingId(null);
      await onRefresh();
    } catch (err) {
      console.error('Erro ao atualizar categoria:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta categoria? Transações existentes não serão afetadas.')) return;
    try {
      await categoriesApi.delete(id);
      await onRefresh();
    } catch (err) {
      console.error('Erro ao excluir categoria:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(cat => {
          const Icon = Icons[cat.icon as IconName] || Icons.Tag;
          return (
            <Card key={cat.id} className="p-5 flex flex-col gap-4 group border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-semibold text-blue-800 dark:text-slate-200 block">{cat.name}</span>
                    {cat.budget && cat.budget > 0 && editingId !== cat.id && (
                      <span className="text-xs font-medium text-blue-500 dark:text-slate-400 mt-0.5 block">Meta: {formatCurrency(cat.budget)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                  <button onClick={() => { setEditingId(cat.id); setEditBudget(cat.budget?.toString() || ''); }} className="p-2 text-blue-400 hover:text-blue-900 dark:hover:text-slate-100 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <Icons.Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="p-2 text-blue-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors">
                    <Icons.Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {editingId === cat.id && (
                <div className="flex gap-2 mt-2 pt-4 border-t border-blue-100 dark:border-slate-700">
                  <Input
                    type="number"
                    placeholder="Meta (R$)"
                    value={editBudget}
                    onChange={e => setEditBudget(e.target.value)}
                    className="h-10 text-sm flex-1"
                  />
                  <Button onClick={() => handleUpdateBudget(cat.id)} className="px-4 py-2 h-10 text-sm font-medium">Salvar</Button>
                  <Button variant="secondary" onClick={() => setEditingId(null)} className="px-3 py-2 h-10">
                    <Icons.X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </Card>
          );
        })}

        {isAdding ? (
          <Card className="p-5 space-y-4 border-dashed border-2 border-blue-200 dark:border-slate-600 bg-blue-50/50 dark:bg-slate-800/50 shadow-none">
            <Input placeholder="Nome da categoria" value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} className="bg-white" />
            <Input type="number" placeholder="Meta de gastos (opcional)" value={newCat.budget} onChange={e => setNewCat({ ...newCat, budget: e.target.value })} className="bg-white" />
            <div className="flex gap-3">
              <div className="relative w-12 h-10 rounded-xl overflow-hidden border border-blue-200 shrink-0">
                <input type="color" className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer" value={newCat.color} onChange={e => setNewCat({ ...newCat, color: e.target.value })} />
              </div>
              <Button className="flex-1 h-10 font-medium" onClick={handleAdd}>Adicionar</Button>
              <Button variant="secondary" className="h-10 px-3" onClick={() => setIsAdding(false)}>
                <Icons.X className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-blue-200 dark:border-slate-600 text-blue-400 dark:text-slate-500 hover:border-blue-400 dark:hover:border-slate-400 hover:text-blue-600 dark:hover:text-slate-300 hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-all duration-300 min-h-[100px]"
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Icons.Plus className="w-5 h-5" />
            </div>
            <span className="font-medium text-sm">Nova Categoria</span>
          </button>
        )}
      </div>
    </div>
  );
}
