import React, { useState } from 'react';
import { cn, formatCurrency } from '../../lib/utils';
import { motion } from 'motion/react';
import { Icons } from '../Icons';
import { Button, Input, Select, TextArea } from '../ui';
import { transfersApi } from '../../services/api';
import { BankAccount } from '../../types';

export function TransferenciaModal({
  accounts,
  onClose,
  onRefresh,
  prefillToId,
  prefillAmount,
}: {
  accounts: BankAccount[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  prefillToId?: string;
  prefillAmount?: number;
}) {
  const nonCreditAccounts = accounts.filter(a => a.type !== 'credit');
  const allAccounts = accounts;

  const [fromId, setFromId] = useState(nonCreditAccounts[0]?.id ?? '');
  const [toId, setToId] = useState(prefillToId ?? nonCreditAccounts[1]?.id ?? allAccounts[1]?.id ?? '');
  const [amount, setAmount] = useState(prefillAmount ? String(prefillAmount) : '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toAcc = accounts.find(a => a.id === toId);
  const fromAcc = accounts.find(a => a.id === fromId);
  const isBillPayment = toAcc?.type === 'credit';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!fromId || !toId || isNaN(amt) || amt <= 0) return;
    if (fromId === toId) { setError('Conta de origem e destino não podem ser iguais.'); return; }

    setLoading(true);
    setError(null);
    try {
      await transfersApi.create({
        fromAccountId: fromId,
        toAccountId: toId,
        amount: amt,
        date,
        description: description.trim() || undefined,
        isBillPayment,
      });
      await onRefresh();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao realizar transferência.');
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
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-blue-100 dark:border-slate-700"
      >
        <div className="p-6 border-b border-blue-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-blue-900 dark:text-slate-100 tracking-tight">
              {isBillPayment ? 'Pagar Fatura' : 'Transferência'}
            </h3>
            <p className="text-xs text-blue-400 dark:text-slate-500 mt-0.5">
              {isBillPayment
                ? `Pagamento para o cartão ${toAcc?.name ?? ''}`
                : 'Movimentação entre suas contas'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-blue-400 hover:text-blue-900 dark:hover:text-slate-100 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          {/* Seta visual de fluxo */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Select
                label="De (Origem)"
                required
                value={fromId}
                onChange={e => setFromId(e.target.value)}
                options={nonCreditAccounts.map(a => ({
                  value: a.id,
                  label: `${a.name} (${formatCurrency(a.balance)})`,
                }))}
              />
            </div>
            <div className="mt-6 shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-slate-800 flex items-center justify-center">
                <Icons.ArrowUpRight className="w-4 h-4 text-blue-500 dark:text-slate-400 rotate-45" />
              </div>
            </div>
            <div className="flex-1">
              <Select
                label="Para (Destino)"
                required
                value={toId}
                onChange={e => setToId(e.target.value)}
                options={allAccounts
                  .filter(a => a.id !== fromId)
                  .map(a => ({
                    value: a.id,
                    label: a.type === 'credit'
                      ? `${a.name} 💳 (Fatura: ${formatCurrency(Math.abs(a.balance))})`
                      : `${a.name} (${formatCurrency(a.balance)})`,
                  }))}
              />
            </div>
          </div>

          {/* Aviso de pagamento de fatura */}
          {isBillPayment && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <Icons.AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                Pagamento de fatura — o saldo do cartão será reduzido e o da conta origem debitado.
              </p>
            </div>
          )}

          <Input
            label="Valor"
            type="number"
            step="0.01"
            placeholder="0,00"
            required
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />

          <Input
            label="Data"
            type="date"
            required
            value={date}
            onChange={e => setDate(e.target.value)}
          />

          <TextArea
            label="Descrição (opcional)"
            placeholder={isBillPayment ? 'Ex: Pagamento fatura Março' : 'Ex: Reserva de emergência'}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={loading || !fromId || !toId}>
              {loading ? 'Processando...' : isBillPayment ? 'Pagar Fatura' : 'Transferir'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
