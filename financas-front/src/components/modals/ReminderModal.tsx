import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Icons } from '../Icons';
import { Button, Input, TextArea, RadioGroup, Select } from '../ui';
import { remindersApi } from '../../services/api';
import { Category, BankAccount } from '../../types';

export function ReminderModal({ onClose, categories, accounts, userId, onRefresh }: { onClose: () => void; categories: Category[]; accounts: BankAccount[]; userId: string; onRefresh: () => Promise<void> }) {
  const [form, setForm] = useState({
    title: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: categories[0]?.id || '',
    accountId: accounts.find(a => a.type !== 'credit')?.id || '',
    dueDate: new Date().toISOString().split('T')[0],
    frequency: 'monthly',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.category || !form.title) return;

    setLoading(true);
    try {
      await remindersApi.create({
        title: form.title,
        amount: parseFloat(form.amount),
        type: form.type,
        categoryId: form.category,
        accountId: form.accountId || undefined,
        dueDate: form.dueDate,
        frequency: form.frequency as any,
        notes: form.notes || undefined,
      });
      await onRefresh();
      onClose();
    } catch (err) {
      console.error('Erro ao criar lembrete:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-blue-900/40 dark:bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-blue-100 dark:border-slate-700"
      >
        <div className="p-6 border-b border-blue-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-xl font-bold text-blue-900 dark:text-slate-100 tracking-tight">Novo Lembrete</h3>
          <button onClick={onClose} className="p-2 text-blue-400 hover:text-blue-900 dark:hover:text-slate-100 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <RadioGroup
            label="Tipo de Lembrete"
            value={form.type}
            onChange={val => setForm({ ...form, type: val as any })}
            options={[
              { value: 'expense', label: 'Despesa' },
              { value: 'income', label: 'Receita' }
            ]}
          />

          <div className="space-y-4">
            <Input
              label="Título"
              placeholder="Ex: Aluguel, Salário..."
              required
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Valor"
                type="number"
                step="0.01"
                placeholder="0,00"
                required
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
              />

              <Select
                label="Categoria"
                required
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                options={categories.map(c => ({ value: c.id, label: c.name }))}
              />
            </div>

            <Select
              label="Conta Preferencial"
              value={form.accountId}
              onChange={e => setForm({ ...form, accountId: e.target.value })}
              options={[
                { value: '', label: 'Nenhuma' },
                ...accounts.map(a => ({ value: a.id, label: a.name }))
              ]}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Primeiro Vencimento"
                type="date"
                required
                value={form.dueDate}
                onChange={e => setForm({ ...form, dueDate: e.target.value })}
              />

              <Select
                label="Frequência"
                required
                value={form.frequency}
                onChange={e => setForm({ ...form, frequency: e.target.value })}
                options={[
                  { value: 'once', label: 'Única vez' },
                  { value: 'daily', label: 'Diária' },
                  { value: 'weekly', label: 'Semanal' },
                  { value: 'monthly', label: 'Mensal' },
                  { value: 'yearly', label: 'Anual' },
                ]}
              />
            </div>

            <TextArea
              label="Observações (Opcional)"
              placeholder="Ex: Parcela 1 de 12, Código do cliente..."
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Lembrete'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
