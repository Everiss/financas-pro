import React, { useState } from 'react';
import { cn, formatCurrency } from '../../lib/utils';
import { motion } from 'motion/react';
import { Icons } from '../Icons';
import { Button, Input, Select } from '../ui';
import { transactionsApi } from '../../services/api';
import { BankAccount } from '../../types';

export function TransferenciaModal({ accounts, prefillToId, prefillAmount, onClose, onRefresh }: {
  accounts: BankAccount[];
  prefillToId?: string;
  prefillAmount?: number;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const prefillAcc = prefillToId ? accounts.find(a => a.id === prefillToId) : undefined;
  const isBillPayment = prefillAcc?.type === 'credit';

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState(prefillToId || '');
  const [amount, setAmount] = useState(prefillAmount ? String(prefillAmount) : '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const nonCreditAccounts = accounts.filter(a => a.type !== 'credit');
  const toOptions = isBillPayment
    ? accounts.filter(a => a.type === 'credit')
    : accounts;

  const handleSubmit = async () => {
    const amt = parseFloat(amount.replace(',', '.'));
    if (!fromId) { setError('Selecione a conta de origem.'); return; }
    if (!toId) { setError('Selecione a conta de destino.'); return; }
    if (fromId === toId) { setError('Origem e destino não podem ser iguais.'); return; }
    if (!amt || amt <= 0) { setError('Informe um valor válido.'); return; }
    setError('');
    setLoading(true);
    try {
      const fromAcc = accounts.find(a => a.id === fromId);
      const toAcc = accounts.find(a => a.id === toId);
      const isBill = toAcc?.type === 'credit';
      const desc = description.trim() || (isBill ? `Pagamento fatura — ${toAcc?.name}` : `Transferência: ${fromAcc?.name} → ${toAcc?.name}`);

      await Promise.all([
        transactionsApi.create({ type: 'expense', amount: amt, accountId: fromId, date, description: desc, paymentMethod: 'debit', isTransfer: !isBill }),
        transactionsApi.create({ type: 'income',  amount: amt, accountId: toId,   date, description: isBill ? `Pagamento fatura recebido` : desc, isTransfer: !isBill }),
      ]);

      await onRefresh();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao realizar transferência.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className={cn('px-6 pt-6 pb-4', isBillPayment ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-blue-50/50 dark:bg-slate-800/50')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center', isBillPayment ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600')}>
                {isBillPayment ? <Icons.CreditCard className="w-5 h-5" /> : <Icons.ArrowUpRight className="w-5 h-5 rotate-45" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-blue-900 dark:text-slate-100">
                  {isBillPayment ? `Pagar Fatura — ${prefillAcc?.name}` : 'Transferência entre Contas'}
                </h2>
                <p className="text-xs text-blue-500 dark:text-slate-400 font-medium">
                  {isBillPayment ? 'Débito na conta de origem + crédito no cartão' : 'Débito na origem e crédito no destino'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-800 transition-colors">
              <Icons.X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* From */}
          <Select
            label="Conta de origem (débito)"
            value={fromId}
            onChange={e => setFromId(e.target.value)}
            options={[
              { value: '', label: 'Selecione...' },
              ...nonCreditAccounts.map(a => ({ value: a.id, label: a.name })),
            ]}
          />

          {/* To */}
          {!isBillPayment && (
            <Select
              label="Conta de destino (crédito)"
              value={toId}
              onChange={e => setToId(e.target.value)}
              options={[
                { value: '', label: 'Selecione...' },
                ...toOptions.filter(a => a.id !== fromId).map(a => ({ value: a.id, label: `${a.name}${a.type === 'credit' ? ' (Cartão)' : ''}` })),
              ]}
            />
          )}

          {/* Amount */}
          <Input
            label="Valor"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={e => setAmount(e.target.value.replace(',', '.'))}
          />

          {/* Date */}
          <Input
            label="Data"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />

          {/* Description */}
          <Input
            label="Descrição (opcional)"
            placeholder={isBillPayment ? `Pagamento fatura — ${prefillAcc?.name}` : 'Ex: Transferência para poupança'}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          {error && (
            <p className="text-xs text-red-500 font-medium flex items-center gap-1">
              <Icons.AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}

          {/* Summary */}
          {fromId && toId && parseFloat(amount) > 0 && (
            <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-slate-800/50 border border-blue-100 dark:border-slate-700 text-xs font-medium text-blue-700 dark:text-slate-300 space-y-1">
              <p>Débito em <span className="font-bold">{accounts.find(a => a.id === fromId)?.name}</span>: <span className="text-red-600 font-bold">−{formatCurrency(parseFloat(amount) || 0)}</span></p>
              <p>Crédito em <span className="font-bold">{accounts.find(a => a.id === toId)?.name}</span>: <span className="text-emerald-600 font-bold">+{formatCurrency(parseFloat(amount) || 0)}</span></p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              className={cn('flex-2', isBillPayment ? 'bg-emerald-600 hover:bg-emerald-700' : '')}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? '...' : isBillPayment ? 'Pagar Fatura' : 'Confirmar Transferência'}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
