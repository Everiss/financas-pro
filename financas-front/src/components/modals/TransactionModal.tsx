import React, { useEffect, useRef, useState } from 'react';
import { cn, formatCurrency } from '../../lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { Icons } from '../Icons';
import { Button, Input, TextArea } from '../ui';
import { transactionsApi, aiApi, transfersApi, ReceiptExtraction, CreateTransactionPayload } from '../../services/api';
import { Transaction, Category, BankAccount } from '../../types';
import { PlanGate } from '../PlanGate';
import { SUBTYPE_LABELS, DEBT_TYPES, CURRENCIES } from '../../lib/constants';

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
  const cur = acc.currency ?? 'BRL';
  const fmt = (v: number) => formatCurrency(v, cur);
  const fxMeta = cur !== 'BRL' ? CURRENCIES.find(c => c.code === cur) : null;
  const curLabel = fxMeta ? ` ${fxMeta.flag}${cur}` : '';

  let balancePart: string;
  if (acc.type === 'credit') {
    balancePart = `Fatura: ${fmt(Math.abs(acc.balance))}`;
    if (acc.creditLimit) balancePart += ` / Lim: ${fmt(acc.creditLimit)}`;
  } else if (DEBT_TYPES.includes(acc.type)) {
    balancePart = `Devedor: ${fmt(acc.balance)}`;
  } else {
    balancePart = fmt(acc.balance);
  }

  const nameParts = [bankName, acc.name, typeName, subtypeName].filter(Boolean);
  return `${nameParts.join(' · ')}${curLabel} — ${balancePart}`;
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

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  checking:   'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  savings:    'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  investment: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  credit:     'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  loan:       'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  financing:  'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
};

function ProductCard({ acc, compact = false }: { acc: BankAccount; compact?: boolean }) {
  const cur = acc.currency ?? 'BRL';
  const fxMeta = cur !== 'BRL' ? CURRENCIES.find(c => c.code === cur) : null;
  const isDebt = DEBT_TYPES.includes(acc.type);
  const isCredit = acc.type === 'credit';
  const balance = isDebt ? acc.balance : isCredit ? Math.abs(acc.balance) : acc.balance;
  const typeLabel = TYPE_LABELS[acc.type] ?? acc.type;
  const subtypeLabel = acc.subtype ? SUBTYPE_LABELS[acc.subtype] : null;
  const typeColor = ACCOUNT_TYPE_COLORS[acc.type] ?? 'bg-slate-100 text-slate-700';
  const balColor = isDebt ? 'text-rose-600 dark:text-rose-400' : isCredit ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className={cn('flex items-center gap-2.5 w-full', compact ? '' : '')}>
      {/* Bank color dot */}
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: acc.bank?.color ?? '#3b82f6' }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-blue-900 dark:text-slate-100 text-sm truncate">{acc.name}</span>
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0', typeColor)}>{typeLabel}</span>
          {subtypeLabel && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">{subtypeLabel}</span>
          )}
        </div>
        {!compact && acc.bank?.name && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{acc.bank.name}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        {fxMeta && (
          <div className="text-[10px] text-sky-500 dark:text-sky-400 font-semibold">{fxMeta.flag} {cur}</div>
        )}
        <div className={cn('text-xs font-bold', balColor)}>
          {isDebt ? 'Dev: ' : isCredit ? 'Fat: ' : ''}{formatCurrency(balance, cur)}
        </div>
      </div>
    </div>
  );
}

function ProductSelect({
  label, value, onChange, options, required, hint,
}: {
  label: string; value: string; onChange: (id: string) => void;
  options: BankAccount[]; required?: boolean; hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find(a => a.id === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search when opened
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  // Filter + group
  const q = search.toLowerCase();
  const filtered = options.filter(a => {
    if (!q) return true;
    const bankName = a.bank?.name?.toLowerCase() ?? '';
    const name = a.name.toLowerCase();
    const type = (TYPE_LABELS[a.type] ?? a.type).toLowerCase();
    return bankName.includes(q) || name.includes(q) || type.includes(q);
  });
  const grouped: Record<string, BankAccount[]> = {};
  for (const acc of filtered) {
    const key = acc.bank?.name ?? 'Sem banco';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(acc);
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className={cn(
          'w-full flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all',
          open
            ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800 bg-white dark:bg-slate-800'
            : 'border-blue-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-slate-500',
        )}
      >
        {selected ? (
          <div className="flex-1 min-w-0"><ProductCard acc={selected} compact /></div>
        ) : (
          <span className="flex-1 text-sm text-slate-400 dark:text-slate-500">— Selecione o produto —</span>
        )}
        <Icons.ChevronDown className={cn('w-4 h-4 text-blue-400 shrink-0 transition-transform', open ? 'rotate-180' : '')} />
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
            transition={{ duration: 0.13 }}
            style={{ transformOrigin: 'top' }}
            className="z-10 w-full rounded-xl border border-blue-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl overflow-hidden"
          >
            {/* Search */}
            <div className="p-2 border-b border-blue-100 dark:border-slate-700">
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-slate-700 rounded-lg px-2.5 py-1.5">
                <Icons.Search className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="flex-1 bg-transparent text-sm text-blue-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                    <Icons.X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="overflow-y-auto max-h-56">
              {Object.keys(grouped).length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4">Nenhum produto encontrado</p>
              ) : (
                Object.entries(grouped).map(([bankName, accs]) => (
                  <div key={bankName}>
                    {/* Bank header */}
                    <div className="px-3 py-1.5 flex items-center gap-2 bg-blue-50/60 dark:bg-slate-700/50 sticky top-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 dark:text-slate-400">{bankName}</span>
                      <div className="flex-1 h-px bg-blue-100 dark:bg-slate-600" />
                    </div>
                    {/* Product rows */}
                    {accs.map(acc => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => { onChange(acc.id); setOpen(false); setSearch(''); }}
                        className={cn(
                          'w-full px-3 py-2.5 flex items-center text-left transition-colors hover:bg-blue-50 dark:hover:bg-slate-700/60',
                          acc.id === value ? 'bg-blue-50 dark:bg-slate-700/40' : '',
                        )}
                      >
                        <ProductCard acc={acc} />
                        {acc.id === value && (
                          <Icons.Check className="w-4 h-4 text-blue-500 shrink-0 ml-1" />
                        )}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

  // ── Installments ─────────────────────────────────────────────────────────────
  const [installments, setInstallments] = useState({ enabled: false, count: 2 });

  // ── Scheduling (isPending) ────────────────────────────────────────────────────
  const [isPending, setIsPending] = useState(() => {
    if (editTransaction) return editTransaction.isPending ?? false;
    return false;
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
    setInstallments({ enabled: false, count: 2 });
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
      const paymentMethod = mode === 'expense' ? (selectedAcc?.type === 'credit' ? 'credit' : 'debit') : undefined;

      // Installments path
      if (installments.enabled && installments.count >= 2) {
        await transactionsApi.createInstallments({
          amount,
          installments: installments.count,
          accountId: form.accountId,
          categoryId: form.category,
          description: form.description || 'Compra parcelada',
          date: form.date,
          type: mode as 'income' | 'expense',
          paymentMethod,
        });
      } else {
        const data: CreateTransactionPayload = {
          amount,
          type: mode as 'income' | 'expense',
          categoryId: form.category,
          date: form.date,
          description: form.description || undefined,
          accountId: form.accountId,
          paymentMethod,
          isPending,
        };
        if (isEditing && editTransaction) {
          await transactionsApi.update(editTransaction.id, data);
        } else {
          await transactionsApi.create(data);
        }
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
                          onChange={id => {
                            const acc = accounts.find(a => a.id === id);
                            if (acc?.type !== 'credit') setInstallments({ enabled: false, count: 2 });
                            setForm(f => ({ ...f, accountId: id }));
                          }}
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

                        {/* ── Installments — só para despesa em cartão de crédito ── */}
                        {!isEditing && mode === 'expense' && selectedAcc?.type === 'credit' && (
                          <div className="space-y-3 pt-1 border-t border-blue-100 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => setInstallments(s => ({ ...s, enabled: !s.enabled, count: s.count || 2 }))}
                              className={cn(
                                'w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all',
                                installments.enabled
                                  ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300'
                                  : 'border-blue-100 dark:border-slate-700 text-blue-400 dark:text-slate-500 hover:border-blue-300',
                              )}
                            >
                              <span className="flex items-center gap-2">
                                <Icons.CreditCard className="w-4 h-4" />
                                Parcelar compra
                              </span>
                              <span className={cn(
                                'text-xs px-2 py-0.5 rounded-full font-bold',
                                installments.enabled
                                  ? 'bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300'
                                  : 'bg-blue-100 dark:bg-slate-700 text-blue-400 dark:text-slate-500',
                              )}>
                                {installments.enabled ? `${installments.count}x` : 'Desativado'}
                              </span>
                            </button>

                            <AnimatePresence>
                              {installments.enabled && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="overflow-hidden"
                                >
                                  <div className="space-y-3 p-4 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800">
                                    <div className="flex items-center gap-3">
                                      <label className="text-xs font-semibold text-violet-700 dark:text-violet-400 whitespace-nowrap">Nº de parcelas</label>
                                      <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => setInstallments(s => ({ ...s, count: Math.max(2, s.count - 1) }))}
                                          className="w-7 h-7 rounded-lg bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300 font-bold hover:bg-violet-300 dark:hover:bg-violet-700 transition-colors flex items-center justify-center">−</button>
                                        <span className="text-lg font-bold text-violet-700 dark:text-violet-300 w-8 text-center">{installments.count}</span>
                                        <button type="button" onClick={() => setInstallments(s => ({ ...s, count: Math.min(48, s.count + 1) }))}
                                          className="w-7 h-7 rounded-lg bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300 font-bold hover:bg-violet-300 dark:hover:bg-violet-700 transition-colors flex items-center justify-center">+</button>
                                      </div>
                                      <span className="text-xs text-violet-500 dark:text-violet-400">parcelas mensais</span>
                                    </div>
                                    {form.amount && !isNaN(parseFloat(form.amount)) && parseFloat(form.amount) > 0 && (
                                      <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-white/70 dark:bg-slate-800/70 rounded-lg p-2">
                                          <p className="text-[10px] text-violet-500 dark:text-violet-400 font-medium">Total</p>
                                          <p className="text-sm font-bold text-violet-700 dark:text-violet-300">{formatCurrency(parseFloat(form.amount))}</p>
                                        </div>
                                        <div className="bg-white/70 dark:bg-slate-800/70 rounded-lg p-2">
                                          <p className="text-[10px] text-violet-500 dark:text-violet-400 font-medium">Por parcela</p>
                                          <p className="text-sm font-bold text-violet-700 dark:text-violet-300">{formatCurrency(Math.round((parseFloat(form.amount) / installments.count) * 100) / 100)}</p>
                                        </div>
                                        <div className="bg-white/70 dark:bg-slate-800/70 rounded-lg p-2">
                                          <p className="text-[10px] text-violet-500 dark:text-violet-400 font-medium">Último venc.</p>
                                          <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
                                            {(() => { const d = new Date(form.date); d.setMonth(d.getMonth() + installments.count - 1); return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }); })()}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    <p className="text-[11px] text-violet-500 dark:text-violet-400">
                                      Serão criados {installments.count} lançamentos pendentes mensais a partir de {new Date(form.date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}.
                                    </p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}

                        {/* ── Scheduling (isPending) ────────────────── */}
                        {!isEditing && !installments.enabled && (
                          <button
                            type="button"
                            onClick={() => setIsPending(v => !v)}
                            className={cn(
                              'w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all',
                              isPending
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                                : 'border-blue-100 dark:border-slate-700 text-blue-400 dark:text-slate-500 hover:border-blue-300',
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <Icons.Clock className="w-4 h-4" />
                              Lançamento futuro / agendado
                            </span>
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-bold',
                              isPending
                                ? 'bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300'
                                : 'bg-blue-100 dark:bg-slate-700 text-blue-400 dark:text-slate-500',
                            )}>
                              {isPending ? 'Pendente' : 'Efetivado'}
                            </span>
                          </button>
                        )}
                        {isPending && !installments.enabled && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                            Lançamento agendado — não afeta saldo até ser confirmado.
                          </p>
                        )}
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
