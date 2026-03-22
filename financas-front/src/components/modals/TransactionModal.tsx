import React, { useState } from 'react';
import { cn, formatCurrency } from '../../lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { Icons } from '../Icons';
import { Button, Input, TextArea } from '../ui';
import { transactionsApi, aiApi, transfersApi, ReceiptExtraction, CreateTransactionPayload } from '../../services/api';
import { Transaction, Category, BankAccount } from '../../types';
import { PlanGate } from '../PlanGate';
import { SUBTYPE_LABELS, DEBT_TYPES } from '../../lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

type TxMode = 'expense' | 'income' | 'transfer' | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  checking: 'Corrente', savings: 'Poupança', investment: 'Investimento',
  credit: 'Cartão', loan: 'Empréstimo', financing: 'Financiamento',
};

/** Builds the rich option label for a product */
function productLabel(acc: BankAccount): string {
  const bankName = acc.bank?.name;
  const typeName = TYPE_LABELS[acc.type] ?? acc.type;
  const subtypeName = acc.subtype ? SUBTYPE_LABELS[acc.subtype] : null;

  let balancePart: string;
  if (acc.type === 'credit') {
    balancePart = `Fatura: ${formatCurrency(Math.abs(acc.balance))}`;
    if (acc.creditLimit) balancePart += ` / Lim: ${formatCurrency(acc.creditLimit)}`;
  } else if (DEBT_TYPES.includes(acc.type)) {
    balancePart = `Devedor: ${formatCurrency(acc.balance)}`;
  } else {
    balancePart = formatCurrency(acc.balance);
  }

  const nameParts = [bankName, acc.name, typeName, subtypeName].filter(Boolean);
  return `${nameParts.join(' · ')} — ${balancePart}`;
}

/** Accounts available per mode */
function accountsFor(mode: TxMode, accounts: BankAccount[]): BankAccount[] {
  if (!mode) return [];
  if (mode === 'expense') return accounts.filter(a => ['checking', 'savings', 'credit'].includes(a.type));
  if (mode === 'income')  return accounts.filter(a => ['checking', 'savings', 'investment'].includes(a.type));
  // transfer — all non-debt accounts
  return accounts.filter(a => !DEBT_TYPES.includes(a.type));
}

// ─── Mode selector card ───────────────────────────────────────────────────────

const MODE_OPTIONS: { value: TxMode; label: string; icon: keyof typeof Icons; color: string; bg: string }[] = [
  { value: 'expense',  label: 'Despesa',       icon: 'ArrowDownLeft',  color: 'text-rose-600 dark:text-rose-400',    bg: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'   },
  { value: 'income',   label: 'Receita',        icon: 'ArrowUpRight',   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
  { value: 'transfer', label: 'Transferência',  icon: 'ArrowUpRight',   color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'   },
];

// ─── ProductSelect ─────────────────────────────────────────────────────────────

function ProductSelect({
  label, value, onChange, options, required, hint,
}: {
  label: string; value: string; onChange: (id: string) => void;
  options: BankAccount[]; required?: boolean; hint?: string;
}) {
  // Group by bank
  const grouped: Record<string, BankAccount[]> = {};
  for (const acc of options) {
    const key = acc.bank?.name ?? 'Sem banco';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(acc);
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-blue-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-900 dark:text-slate-100 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 transition-colors"
      >
        <option value="">— Selecione o produto —</option>
        {Object.entries(grouped).map(([bankName, accs]) => (
          <optgroup key={bankName} label={bankName}>
            {accs.map(acc => (
              <option key={acc.id} value={acc.id}>
                {productLabel(acc)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {hint && <p className="text-xs text-blue-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

// ─── CategorySelect ───────────────────────────────────────────────────────────

function CategorySelect({
  value, onChange, categories,
}: {
  value: string; onChange: (id: string) => void; categories: Category[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">
        Categoria<span className="text-red-500 ml-0.5">*</span>
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-blue-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-900 dark:text-slate-100 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 transition-colors"
      >
        <option value="">— Selecione a categoria —</option>
        {categories.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}

// ─── CreditLimitWarning ───────────────────────────────────────────────────────

function CreditLimitWarning({ account, amount }: { account: BankAccount | undefined; amount: string }) {
  if (!account || account.type !== 'credit' || !account.creditLimit) return null;
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) return null;
  const available = account.creditLimit - Math.abs(account.balance);
  if (amt <= available) return null;
  return (
    <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5">
      <Icons.AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-700 dark:text-amber-400">
        <span className="font-semibold">Limite insuficiente.</span>{' '}
        Disponível: {formatCurrency(Math.max(0, available))} de {formatCurrency(account.creditLimit)}.
      </p>
    </div>
  );
}

// ─── TransactionModal ─────────────────────────────────────────────────────────

export function TransactionModal({
  onClose, categories, accounts, transactions, userId, onRefresh, editTransaction,
}: {
  onClose: () => void;
  categories: Category[];
  accounts: BankAccount[];
  transactions: Transaction[];
  userId: string;
  onRefresh: () => Promise<void>;
  editTransaction?: Transaction;
}) {
  const isEditing = !!editTransaction;

  // ── Mode (type) ─────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<TxMode>(() => {
    if (!editTransaction) return null;
    return editTransaction.isTransfer ? 'transfer' : editTransaction.type;
  });

  // ── Expense / Income form ────────────────────────────────────────────────────
  const [form, setForm] = useState(() => {
    if (editTransaction) {
      return {
        amount:        editTransaction.amount.toString(),
        category:      editTransaction.category ?? '',
        accountId:     editTransaction.accountId ?? '',
        date:          editTransaction.date.toDate().toISOString().split('T')[0],
        description:   editTransaction.description ?? '',
      };
    }
    return { amount: '', category: '', accountId: '', date: new Date().toISOString().split('T')[0], description: '' };
  });

  // ── Transfer form ────────────────────────────────────────────────────────────
  const [transfer, setTransfer] = useState({
    fromId: '', toId: '', amount: '', date: new Date().toISOString().split('T')[0], description: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Receipt ──────────────────────────────────────────────────────────────────
  const [receiptFile, setReceiptFile]       = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [extracting, setExtracting]         = useState(false);
  const [extraction, setExtraction]         = useState<ReceiptExtraction | null>(null);
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
      const matched = categories.find(c => c.name.toLowerCase() === result.categoryName.toLowerCase())
                   ?? categories.find(c => c.name.toLowerCase().includes(result.categoryName.toLowerCase()))
                   ?? categories[0];
      const valid = accountsFor(result.type as TxMode, accounts);
      setMode(result.type as TxMode);
      setForm(f => ({
        ...f,
        amount: result.amount.toFixed(2),
        date: result.date,
        description: result.establishment || result.description,
        category: matched?.id ?? f.category,
        accountId: valid[0]?.id ?? f.accountId,
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

  // ── Change mode — reset fields ───────────────────────────────────────────────
  const handleModeChange = (m: TxMode) => {
    setMode(m);
    setForm(f => ({ ...f, accountId: '', category: '' }));
    setTransfer(t => ({ ...t, fromId: '', toId: '' }));
    setError(null);
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'transfer') {
      const amt = parseFloat(transfer.amount);
      if (!transfer.fromId || !transfer.toId || isNaN(amt) || amt <= 0) {
        setError('Preencha origem, destino e valor.'); return;
      }
      if (transfer.fromId === transfer.toId) {
        setError('Origem e destino não podem ser iguais.'); return;
      }
      setLoading(true);
      try {
        const toAcc = accounts.find(a => a.id === transfer.toId);
        await transfersApi.create({
          fromAccountId: transfer.fromId,
          toAccountId: transfer.toId,
          amount: amt,
          date: transfer.date,
          description: transfer.description.trim() || undefined,
          isBillPayment: toAcc?.type === 'credit',
        });
        await onRefresh();
        onClose();
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao realizar transferência.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // expense / income
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0 || !form.category || !form.date || !form.accountId) {
      setError('Preencha todos os campos obrigatórios.'); return;
    }
    setLoading(true);
    try {
      const selectedAcc = accounts.find(a => a.id === form.accountId);
      const data: CreateTransactionPayload = {
        amount,
        type: mode as 'income' | 'expense',
        categoryId: form.category,
        date: form.date,
        description: form.description || undefined,
        accountId: form.accountId,
      };
      if (mode === 'expense') {
        data.paymentMethod = selectedAcc?.type === 'credit' ? 'credit' : 'debit';
      }
      if (isEditing && editTransaction) {
        await transactionsApi.update(editTransaction.id, data);
      } else {
        await transactionsApi.create(data);
      }
      await onRefresh();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao salvar transação.');
    } finally {
      setLoading(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const availableAccounts    = accountsFor(mode, accounts);
  const selectedAcc          = accounts.find(a => a.id === form.accountId);
  const transferFrom         = accounts.find(a => a.id === transfer.fromId);
  const transferToOptions    = accountsFor('transfer', accounts).filter(a => a.id !== transfer.fromId);
  const isBillPayment        = accounts.find(a => a.id === transfer.toId)?.type === 'credit';

  return (
    <div className="fixed inset-0 bg-blue-900/40 dark:bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-blue-100 dark:border-slate-700 flex flex-col max-h-[90vh]"
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="p-6 border-b border-blue-100 dark:border-slate-700 flex items-center justify-between shrink-0">
          <h3 className="text-xl font-bold text-blue-900 dark:text-slate-100 tracking-tight">
            {isEditing ? 'Editar Transação' : 'Nova Transação'}
          </h3>
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

        {/* ── Scrollable body ────────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} noValidate>
            <div className="p-6 space-y-6">

              {/* Receipt preview */}
              {receiptPreview && (
                <div className="relative rounded-2xl overflow-hidden border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20">
                  <div className="flex items-start gap-3 p-3">
                    <img src={receiptPreview} alt="Comprovante" className="w-20 h-20 object-cover rounded-xl shrink-0 border border-violet-200 dark:border-violet-700" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-1 flex items-center gap-1">
                        <Icons.Sparkles className="w-3 h-3" /> Comprovante carregado
                      </p>
                      <p className="text-xs text-violet-500 truncate mb-2">{receiptFile?.name}</p>
                      {extraction ? (
                        <div className="flex items-center gap-1.5">
                          <span className={cn('w-2 h-2 rounded-full', extraction.confidence === 'high' ? 'bg-emerald-500' : extraction.confidence === 'medium' ? 'bg-amber-500' : 'bg-red-500')} />
                          <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">
                            Dados extraídos ({extraction.confidence === 'high' ? 'alta' : extraction.confidence === 'medium' ? 'média' : 'baixa'} confiança) — revise abaixo
                          </span>
                        </div>
                      ) : (
                        <button type="button" onClick={handleExtract} disabled={extracting}
                          className="text-xs font-bold bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          {extracting
                            ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Interpretando...</>
                            : <><Icons.Sparkles className="w-3 h-3" />Extrair com IA</>
                          }
                        </button>
                      )}
                    </div>
                    <button type="button" onClick={clearReceipt} className="text-violet-400 hover:text-violet-600 p-1 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/40 shrink-0">
                      <Icons.X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 1: Type selector ──────────────────────────────────── */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">
                  Tipo de Transação<span className="text-red-500 ml-0.5">*</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {MODE_OPTIONS.map(opt => {
                    const Icon = Icons[opt.icon];
                    const active = mode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleModeChange(opt.value)}
                        className={cn(
                          'flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl border-2 font-semibold text-sm transition-all',
                          active ? opt.bg + ' border-current ' + opt.color : 'border-blue-100 dark:border-slate-700 text-blue-400 dark:text-slate-500 hover:border-blue-300 dark:hover:border-slate-600 bg-transparent',
                        )}
                      >
                        <Icon className={cn('w-5 h-5', active ? opt.color : '')} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Step 2: Form fields ────────────────────────────────────── */}
              <AnimatePresence mode="wait">
                {mode && (
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-4"
                  >
                    {/* ── Transfer fields ─────────────────────────────────── */}
                    {mode === 'transfer' && (
                      <>
                        <ProductSelect
                          label="De (origem)"
                          required
                          value={transfer.fromId}
                          onChange={id => setTransfer(t => ({ ...t, fromId: id, toId: t.toId === id ? '' : t.toId }))}
                          options={accountsFor('transfer', accounts)}
                        />
                        <ProductSelect
                          label={isBillPayment ? 'Para (pagamento de fatura)' : 'Para (destino)'}
                          required
                          value={transfer.toId}
                          onChange={id => setTransfer(t => ({ ...t, toId: id }))}
                          options={transferToOptions}
                          hint={isBillPayment ? 'Pagamento de fatura de cartão de crédito' : undefined}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="Valor"
                            type="number" step="0.01" placeholder="0,00" required
                            value={transfer.amount}
                            onChange={e => setTransfer(t => ({ ...t, amount: e.target.value }))}
                          />
                          <Input
                            label="Data"
                            type="date" required
                            value={transfer.date}
                            onChange={e => setTransfer(t => ({ ...t, date: e.target.value }))}
                          />
                        </div>
                        {transferFrom && (
                          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2">
                            <Icons.ArrowUpRight className="w-4 h-4 text-blue-500 shrink-0 mt-0.5 rotate-45" />
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              Saldo disponível em <span className="font-semibold">{transferFrom.name}</span>:{' '}
                              {formatCurrency(transferFrom.balance)}
                            </p>
                          </div>
                        )}
                        <TextArea
                          label="Descrição (opcional)"
                          placeholder="Ex: Pagamento fatura, reserva emergência..."
                          value={transfer.description}
                          onChange={e => setTransfer(t => ({ ...t, description: e.target.value }))}
                        />
                      </>
                    )}

                    {/* ── Expense / Income fields ──────────────────────────── */}
                    {(mode === 'expense' || mode === 'income') && (
                      <>
                        <ProductSelect
                          label={mode === 'income' ? 'Produto de destino' : 'Produto de pagamento'}
                          required
                          value={form.accountId}
                          onChange={id => setForm(f => ({ ...f, accountId: id }))}
                          options={availableAccounts}
                          hint={
                            mode === 'expense'
                              ? 'Contas correntes, poupanças e cartões de crédito'
                              : 'Contas correntes, poupanças e investimentos'
                          }
                        />

                        <CreditLimitWarning account={selectedAcc} amount={form.amount} />

                        <CategorySelect
                          value={form.category}
                          onChange={id => setForm(f => ({ ...f, category: id }))}
                          categories={categories}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="Valor"
                            type="number" step="0.01" placeholder="0,00" required
                            value={form.amount}
                            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                          />
                          <Input
                            label="Data"
                            type="date" required
                            value={form.date}
                            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                          />
                        </div>

                        <TextArea
                          label="Descrição (opcional)"
                          placeholder="Ex: Aluguel, Supermercado, Salário..."
                          value={form.description}
                          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        />
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5">
                  {error}
                </p>
              )}
            </div>

            {/* ── Footer ──────────────────────────────────────────────────── */}
            <div className="px-6 pb-6 flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={loading || !mode}>
                {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Confirmar'}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
