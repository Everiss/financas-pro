import React, { useState } from 'react';
import { cn, formatCurrency } from '../../lib/utils';
import { motion } from 'motion/react';
import { Icons } from '../Icons';
import { Button, Input, TextArea, RadioGroup, Select } from '../ui';
import { transactionsApi, aiApi, ReceiptExtraction, CreateTransactionPayload } from '../../services/api';
import { Transaction, Category, BankAccount } from '../../types';
import { PlanGate } from '../PlanGate';

export function TransactionModal({ onClose, categories, accounts, transactions, userId, onRefresh }: { onClose: () => void; categories: Category[]; accounts: BankAccount[]; transactions: Transaction[]; userId: string; onRefresh: () => Promise<void> }) {
  const [form, setForm] = useState({
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: categories[0]?.id || '',
    accountId: accounts.find(a => a.type !== 'credit')?.id || '',
    paymentMethod: 'debit' as 'debit' | 'credit',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });
  const [loading, setLoading] = useState(false);

  // --- Upload de comprovante ---
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<ReceiptExtraction | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
    setExtraction(null);
  };

  const handleExtract = async () => {
    if (!receiptFile) return;
    setExtracting(true);
    try {
      const result = await aiApi.extractReceipt(receiptFile);
      setExtraction(result);
      // Preenche o formulário com os dados extraídos
      const matchedCategory = categories.find(c =>
        c.name.toLowerCase() === result.categoryName.toLowerCase()
      ) || categories.find(c =>
        c.name.toLowerCase().includes(result.categoryName.toLowerCase())
      ) || categories[0];

      const validAccounts = result.type === 'expense'
        ? (result.paymentMethod === 'credit' ? accounts.filter(a => a.type === 'credit') : accounts.filter(a => a.type !== 'credit'))
        : accounts;

      setForm(f => ({
        ...f,
        amount: result.amount.toFixed(2),
        type: result.type,
        date: result.date,
        description: result.establishment || result.description,
        categoryId: matchedCategory?.id || f.category,
        category: matchedCategory?.id || f.category,
        paymentMethod: result.paymentMethod || 'debit',
        accountId: validAccounts[0]?.id || f.accountId,
      }));
    } catch (err: any) {
      alert(err.message || 'Erro ao extrair comprovante.');
    } finally {
      setExtracting(false);
    }
  };

  const clearReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setExtraction(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getAccountBalance = (acc: BankAccount) => acc.balance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.category || !form.accountId) return;

    setLoading(true);
    try {
      const data: CreateTransactionPayload = {
        amount: parseFloat(form.amount),
        type: form.type,
        categoryId: form.category,
        date: form.date,
        description: form.description || undefined,
        accountId: form.accountId,
      };
      if (form.type === 'expense') {
        data.paymentMethod = form.paymentMethod;
      }
      await transactionsApi.create(data);
      await onRefresh();
      onClose();
    } catch (err) {
      console.error('Erro ao criar transação:', err);
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
          <h3 className="text-xl font-bold text-blue-900 dark:text-slate-100 tracking-tight">Nova Transação</h3>
          <div className="flex items-center gap-2">
            <PlanGate feature="ai">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Enviar comprovante"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors border border-violet-200 dark:border-violet-800"
              >
                <Icons.Sparkles className="w-3.5 h-3.5" />
                IA: Ler comprovante
              </button>
            </PlanGate>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleReceiptChange} />
            <button onClick={onClose} className="p-2 text-blue-400 hover:text-blue-900 dark:hover:text-slate-100 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-full transition-colors">
              <Icons.X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview do comprovante */}
        {receiptPreview && (
          <div className="px-6 pt-4">
            <div className="relative rounded-2xl overflow-hidden border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20">
              <div className="flex items-start gap-3 p-3">
                <img src={receiptPreview} alt="Comprovante" className="w-20 h-20 object-cover rounded-xl shrink-0 border border-violet-200 dark:border-violet-700" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-1 flex items-center gap-1">
                    <Icons.Sparkles className="w-3 h-3" /> Comprovante carregado
                  </p>
                  <p className="text-xs text-violet-500 dark:text-violet-500 truncate mb-2">{receiptFile?.name}</p>
                  {extraction ? (
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${extraction.confidence === 'high' ? 'bg-emerald-500' : extraction.confidence === 'medium' ? 'bg-amber-500' : 'bg-red-500'}`} />
                      <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">
                        Dados extraídos ({extraction.confidence === 'high' ? 'alta' : extraction.confidence === 'medium' ? 'média' : 'baixa'} confiança) — revise o formulário
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleExtract}
                      disabled={extracting}
                      className="text-xs font-bold bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      {extracting ? (
                        <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Interpretando...</>
                      ) : (
                        <><Icons.Sparkles className="w-3 h-3" />Extrair com IA</>
                      )}
                    </button>
                  )}
                </div>
                <button type="button" onClick={clearReceipt} className="text-violet-400 hover:text-violet-600 p-1 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors shrink-0">
                  <Icons.X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <RadioGroup
            label="Tipo de Transação"
            value={form.type}
            onChange={val => {
              const type = val as 'income' | 'expense';
              const validAccounts = accounts.filter(a => a.type !== 'credit');
              setForm({ ...form, type, paymentMethod: 'debit', accountId: validAccounts[0]?.id || '' });
            }}
            options={[
              { value: 'expense', label: 'Despesa' },
              { value: 'income', label: 'Receita' }
            ]}
          />

          <div className="space-y-4">
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

            {form.type === 'expense' && (
              <RadioGroup
                label="Forma de Pagamento"
                value={form.paymentMethod}
                onChange={val => {
                  const method = val as 'debit' | 'credit';
                  const validAccounts = accounts.filter(a => method === 'credit' ? a.type === 'credit' : a.type !== 'credit');
                  setForm({ ...form, paymentMethod: method, accountId: validAccounts[0]?.id || '' });
                }}
                options={[
                  { value: 'debit', label: 'Débito / Dinheiro / Pix' },
                  { value: 'credit', label: 'Cartão de Crédito' }
                ]}
              />
            )}

            {form.type === 'expense' && form.paymentMethod === 'credit' ? (
              <div className="space-y-2">
                <Select
                  label="Selecione o Cartão"
                  required
                  value={form.accountId}
                  onChange={e => setForm({ ...form, accountId: e.target.value })}
                  options={accounts
                    .filter(a => a.type === 'credit')
                    .map(a => ({ value: a.id, label: `${a.name} (Fatura: ${formatCurrency(Math.abs(getAccountBalance(a)))})` }))
                  }
                />
                {accounts.filter(a => a.type === 'credit').length === 0 && (
                  <p className="text-xs text-red-500 font-medium">Você não possui cartões de crédito cadastrados.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Select
                  label="Conta Bancária / Origem"
                  required
                  value={form.accountId}
                  onChange={e => setForm({ ...form, accountId: e.target.value })}
                  options={accounts
                    .filter(a => a.type !== 'credit')
                    .map(a => ({ value: a.id, label: `${a.name} (Saldo: ${formatCurrency(getAccountBalance(a))})` }))
                  }
                />
                {accounts.filter(a => a.type !== 'credit').length === 0 && (
                  <p className="text-xs text-amber-600 font-medium">Você não possui contas bancárias cadastradas.</p>
                )}
              </div>
            )}

            <Input
              label="Data"
              type="date"
              required
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
            />

            <TextArea
              label="Descrição (opcional)"
              placeholder="Ex: Aluguel, Supermercado..."
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={loading || !form.accountId}>
              {loading ? 'Salvando...' : 'Confirmar Transação'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
