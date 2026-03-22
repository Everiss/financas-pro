import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { Icons, IconName } from '../components/Icons';
import { Button, Card, Input, RadioGroup, Select } from '../components/ui';
import { banksApi, accountsApi, transactionsApi, remindersApi } from '../services/api';
import { Transaction, BankAccount, Bank, Reminder } from '../types';
import { useConfirm } from '../contexts/ConfirmContext';
import { PlanGate } from '../components/PlanGate';
import { BANK_COLORS, BANK_ICONS, EMPTY_ACC, SUBTYPE_OPTIONS, SUBTYPE_LABELS, DEBT_TYPES, CURRENCIES } from '../lib/constants';

// ─── Shared helpers ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  checking:   'Corrente',
  savings:    'Poupança',
  investment: 'Investimento',
  credit:     'Cartão de Crédito',
  loan:       'Empréstimo',
  financing:  'Financiamento',
};

const TYPE_COLORS: Record<string, string> = {
  checking:   'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  savings:    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  investment: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  credit:     'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  loan:       'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
  financing:  'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
};

const DEBT_ICONS: Record<string, string> = {
  loan:      'HandCoins',
  financing: 'Receipt',
};

const INVESTMENT_OPTIONS = [
  { value: 'cdb',        label: 'CDB / Renda Fixa' },
  { value: 'stock',      label: 'Ações' },
  { value: 'fund',       label: 'Fundos' },
  { value: 'fii',        label: 'FIIs' },
  { value: 'tesouro',    label: 'Tesouro Direto' },
  { value: 'previdencia',label: 'Previdência' },
  { value: 'crypto',     label: 'Criptomoedas' },
  { value: 'other',      label: 'Outros' },
];

const TYPE_OPTIONS = [
  { value: 'checking',   label: 'Corrente'   },
  { value: 'savings',    label: 'Poupança'   },
  { value: 'investment', label: 'Invest.'    },
  { value: 'credit',     label: 'Cartão'     },
  { value: 'loan',       label: 'Emprést.'   },
  { value: 'financing',  label: 'Financ.'    },
];

// ─── AccountForm (add / edit) ─────────────────────────────────────────────────

type AccFormState = typeof EMPTY_ACC;

function AccountForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  submitColor,
  error,
}: {
  value: AccFormState;
  onChange: (f: AccFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  submitColor?: string;
  error?: string;
}) {
  const isDebt = DEBT_TYPES.includes(value.type);

  return (
    <div className="space-y-3">
      <Input
        label="Nome do Produto"
        placeholder={isDebt ? 'Ex: Financiamento Carro, CDC Itaú...' : 'Ex: Conta Corrente, Roxinho...'}
        value={value.name}
        onChange={e => onChange({ ...value, name: e.target.value })}
        error={error && !value.name.trim() ? error : undefined}
      />
      <RadioGroup
        label="Tipo de Produto"
        value={value.type}
        onChange={val => onChange({ ...value, type: val as BankAccount['type'], subtype: '' })}
        options={TYPE_OPTIONS}
      />
      {SUBTYPE_OPTIONS[value.type] && (
        <Select
          label="Modalidade"
          value={value.subtype}
          onChange={e => onChange({ ...value, subtype: e.target.value })}
          options={[{ value: '', label: '— Selecione (opcional) —' }, ...SUBTYPE_OPTIONS[value.type]]}
        />
      )}
      {/* Currency selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Moeda</label>
        <select
          value={value.currency}
          onChange={e => onChange({ ...value, currency: e.target.value })}
          className="w-full rounded-xl border border-blue-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-900 dark:text-slate-100 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.label}</option>
          ))}
        </select>
      </div>

      {/* Balance field — label changes by type */}
      {!isDebt && (
        <Input
          label={value.type === 'credit' ? 'Fatura atual' : `Saldo ${value.currency !== 'BRL' ? `(${value.currency})` : ''}`}
          inputMode="decimal"
          placeholder="0,00"
          value={value.balance}
          onChange={e => onChange({ ...value, balance: e.target.value.replace(',', '.') })}
        />
      )}
      {/* Investment subtype */}
      {value.type === 'investment' && (
        <Select
          label="Tipo de Investimento"
          value={value.investmentType}
          onChange={e => onChange({ ...value, investmentType: e.target.value as BankAccount['investmentType'] })}
          options={INVESTMENT_OPTIONS}
        />
      )}
      {/* Credit card config */}
      {value.type === 'credit' && (
        <div className="space-y-3 p-3 rounded-xl bg-amber-50/50 dark:bg-slate-800/50 border border-amber-100 dark:border-slate-700">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Configuração do Cartão</p>
          <Input
            label="Limite de crédito"
            inputMode="decimal"
            placeholder="0,00"
            value={value.creditLimit}
            onChange={e => onChange({ ...value, creditLimit: e.target.value.replace(',', '.') })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Fechamento"
              type="number"
              placeholder="Dia"
              value={value.closingDay}
              onChange={e => onChange({ ...value, closingDay: e.target.value })}
            />
            <Input
              label="Vencimento"
              type="number"
              placeholder="Dia"
              value={value.dueDay}
              onChange={e => onChange({ ...value, dueDay: e.target.value })}
            />
          </div>
        </div>
      )}
      {/* Loan / Financing config */}
      {isDebt && (
        <div className="space-y-3 p-3 rounded-xl bg-rose-50/50 dark:bg-slate-800/50 border border-rose-100 dark:border-slate-700">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
            {value.type === 'financing' ? 'Detalhes do Financiamento' : 'Detalhes do Empréstimo'}
          </p>
          <Input
            label="Saldo devedor atual"
            inputMode="decimal"
            placeholder="0,00"
            value={value.balance}
            onChange={e => onChange({ ...value, balance: e.target.value.replace(',', '.') })}
          />
          <Input
            label="Valor original"
            inputMode="decimal"
            placeholder="0,00"
            value={value.creditLimit}
            onChange={e => onChange({ ...value, creditLimit: e.target.value.replace(',', '.') })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Parcelas restantes"
              type="number"
              placeholder="Qtd"
              value={value.closingDay}
              onChange={e => onChange({ ...value, closingDay: e.target.value })}
            />
            <Input
              label="Dia do vencimento"
              type="number"
              placeholder="Dia"
              value={value.dueDay}
              onChange={e => onChange({ ...value, dueDay: e.target.value })}
            />
          </div>
        </div>
      )}
      {error && value.name.trim() && (
        <p className="text-xs text-red-500 font-medium flex items-center gap-1">
          <Icons.AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button
          className="flex-1"
          style={submitColor ? { backgroundColor: submitColor } : undefined}
          onClick={onSubmit}
        >
          <Icons.Check className="w-4 h-4" /> {submitLabel}
        </Button>
      </div>
    </div>
  );
}

// ─── BankCard ─────────────────────────────────────────────────────────────────

function BankCard({
  bank,
  accounts,
  transactions,
  reminders,
  totalAccounts,
  onRefresh,
}: {
  bank: Bank;
  accounts: BankAccount[];
  transactions: Transaction[];
  reminders: Reminder[];
  totalAccounts: number;
  onRefresh: () => Promise<void>;
  key?: string;
}) {
  const { confirm } = useConfirm();

  // Card-level state
  const [expanded,    setExpanded]    = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [bankForm,    setBankForm]    = useState({ name: bank.name, color: bank.color, icon: bank.icon as IconName });

  // Account-level state
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [editAccForm,  setEditAccForm]  = useState<AccFormState>({ ...EMPTY_ACC });
  const [editAccError, setEditAccError] = useState('');
  const [addingAcc,    setAddingAcc]    = useState(false);
  const [newAcc,       setNewAcc]       = useState<AccFormState>({ ...EMPTY_ACC });
  const [newAccError,  setNewAccError]  = useState('');

  const BankIcon = Icons[bank.icon as IconName] || Icons.Landmark;
  const brlAccounts = accounts.filter(a => (a.currency ?? 'BRL') === 'BRL');
  const totalBalance  = brlAccounts.filter(a => a.type !== 'credit' && !DEBT_TYPES.includes(a.type)).reduce((s, a) => s + a.balance, 0);
  const creditBalance = brlAccounts.filter(a => a.type === 'credit').reduce((s, a) => s + Math.abs(a.balance), 0);
  const debtBalance   = brlAccounts.filter(a => DEBT_TYPES.includes(a.type)).reduce((s, a) => s + a.balance, 0);
  // Foreign currency summary: group by currency
  const fxAccounts = accounts.filter(a => (a.currency ?? 'BRL') !== 'BRL');
  const fxSummary: Record<string, number> = {};
  for (const a of fxAccounts) {
    const c = a.currency!;
    fxSummary[c] = (fxSummary[c] ?? 0) + (DEBT_TYPES.includes(a.type) ? -a.balance : a.type === 'credit' ? -Math.abs(a.balance) : a.balance);
  }

  // ── Bank actions ────────────────────────────────────────────────────────────

  const handleSaveBank = async () => {
    if (!bankForm.name.trim()) return;
    await banksApi.update(bank.id, { name: bankForm.name.trim(), color: bankForm.color, icon: bankForm.icon });
    setEditingBank(false);
    await onRefresh();
  };

  const handleDeleteBank = async () => {
    const bankAccIds = accounts.map(a => a.id);
    const linkedTx  = transactions.filter(t => t.accountId && bankAccIds.includes(t.accountId));
    const linkedRem = reminders.filter(r => r.accountId && bankAccIds.includes(r.accountId));

    const items: string[] = [
      `${accounts.length} produto(s) vinculado(s)`,
      ...(linkedTx.length  > 0 ? [`${linkedTx.length} transação(ões) vinculada(s)`]  : []),
      ...(linkedRem.length > 0 ? [`${linkedRem.length} lembrete(s) vinculado(s)`] : []),
    ];

    const ok = await confirm({
      title: `Excluir banco "${bank.name}"?`,
      description: 'Todos os dados abaixo serão permanentemente removidos:',
      items,
      variant: 'danger',
      confirmLabel: 'Excluir tudo',
    });
    if (!ok) return;
    await banksApi.delete(bank.id);
    await onRefresh();
  };

  // ── Account actions ─────────────────────────────────────────────────────────

  const startEditAcc = (acc: BankAccount) => {
    setEditingAccId(acc.id);
    setEditAccForm({
      name: acc.name, type: acc.type,
      balance: String(acc.balance ?? ''),
      color: acc.color, icon: acc.icon as IconName,
      creditLimit: acc.creditLimit != null ? String(acc.creditLimit) : '',
      closingDay:  acc.closingDay  != null ? String(acc.closingDay)  : '',
      dueDay:      acc.dueDay      != null ? String(acc.dueDay)      : '',
      investmentType: acc.investmentType ?? 'cdb',
      subtype: acc.subtype ?? '',
      currency: acc.currency ?? 'BRL',
    });
    setEditAccError('');
    setAddingAcc(false);
  };

  const handleSaveAccount = async (id: string) => {
    if (!editAccForm.name.trim()) { setEditAccError('Informe o nome do produto.'); return; }
    setEditAccError('');
    const isDebt = DEBT_TYPES.includes(editAccForm.type);
    const data: any = {
      name: editAccForm.name.trim(),
      type: editAccForm.type,
      balance: parseFloat(editAccForm.balance) || 0,
      color: editAccForm.color,
      icon: editAccForm.type === 'investment' ? 'TrendingUp'
          : editAccForm.type === 'credit' ? 'CreditCard'
          : isDebt ? DEBT_ICONS[editAccForm.type]
          : editAccForm.icon,
      subtype: editAccForm.subtype || null,
      currency: editAccForm.currency || 'BRL',
    };
    if (editAccForm.type === 'credit' || isDebt) {
      data.creditLimit = editAccForm.creditLimit ? parseFloat(editAccForm.creditLimit) : null;
      data.closingDay  = editAccForm.closingDay  ? parseInt(editAccForm.closingDay)    : null;
      data.dueDay      = editAccForm.dueDay      ? parseInt(editAccForm.dueDay)        : null;
    }
    if (!isDebt && editAccForm.type !== 'credit') {
      data.creditLimit = null; data.closingDay = null; data.dueDay = null;
    }
    if (editAccForm.type === 'investment') data.investmentType = editAccForm.investmentType;
    try {
      await accountsApi.update(id, data);
      setEditingAccId(null);
      await onRefresh();
    } catch (err: any) { setEditAccError(err?.message ?? 'Erro ao salvar.'); }
  };

  const handleAddAccount = async () => {
    if (!newAcc.name.trim()) { setNewAccError('Informe o nome do produto.'); return; }
    setNewAccError('');
    const isDebt = DEBT_TYPES.includes(newAcc.type);
    const data: any = {
      name: newAcc.name.trim(),
      type: newAcc.type,
      balance: parseFloat(newAcc.balance) || 0,
      color: bank.color,
      icon: newAcc.type === 'investment' ? 'TrendingUp'
          : newAcc.type === 'credit' ? 'CreditCard'
          : isDebt ? DEBT_ICONS[newAcc.type]
          : 'Wallet',
      bankId: bank.id,
      subtype: newAcc.subtype || undefined,
      currency: newAcc.currency || 'BRL',
    };
    if (newAcc.type === 'credit' || isDebt) {
      if (newAcc.creditLimit) data.creditLimit = parseFloat(newAcc.creditLimit);
      if (newAcc.closingDay)  data.closingDay  = parseInt(newAcc.closingDay);
      if (newAcc.dueDay)      data.dueDay      = parseInt(newAcc.dueDay);
    }
    if (newAcc.type === 'investment') data.investmentType = newAcc.investmentType;
    try {
      await accountsApi.create(data);
      setAddingAcc(false);
      setNewAcc({ ...EMPTY_ACC });
      await onRefresh();
    } catch (err: any) { setNewAccError(err?.message ?? 'Erro ao salvar.'); }
  };

  const handleDeleteAccount = async (acc: BankAccount) => {
    const linkedTx  = transactions.filter(t => t.accountId === acc.id);
    const linkedRem = reminders.filter(r => r.accountId === acc.id);
    const items: string[] = [
      ...(linkedTx.length  > 0 ? [`${linkedTx.length} transação(ões) vinculada(s)`]  : []),
      ...(linkedRem.length > 0 ? [`${linkedRem.length} lembrete(s) vinculado(s)`] : []),
    ];
    const ok = await confirm({
      title: `Excluir produto "${acc.name}"?`,
      description: items.length > 0 ? 'Os seguintes dados também serão removidos:' : 'Esta ação não pode ser desfeita.',
      items,
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    await Promise.all([
      ...linkedTx.map(t  => transactionsApi.delete(t.id)),
      ...linkedRem.map(r => remindersApi.delete(r.id)),
    ]);
    await accountsApi.delete(acc.id);
    await onRefresh();
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-50 dark:border-slate-800 shadow-sm overflow-hidden">

      {/* ── Bank header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 p-5">
        {/* Color accent + icon */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0"
          style={{ backgroundColor: `${bank.color}20`, color: bank.color }}
        >
          <BankIcon className="w-6 h-6" />
        </div>

        {/* Name + summary */}
        <button
          className="flex-1 text-left min-w-0"
          onClick={() => { setExpanded(v => !v); setEditingBank(false); }}
        >
          <p className="font-bold text-blue-900 dark:text-slate-100 text-base truncate">{bank.name}</p>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-blue-400 dark:text-slate-500">
              {accounts.length} {accounts.length === 1 ? 'produto' : 'produtos'}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalBalance)}
            </span>
            {creditBalance > 0 && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Fatura: {formatCurrency(creditBalance)}
              </span>
            )}
            {debtBalance > 0 && (
              <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                Dívida: {formatCurrency(debtBalance)}
              </span>
            )}
            {Object.entries(fxSummary).map(([cur, val]) => {
              const meta = CURRENCIES.find(c => c.code === cur);
              return (
                <span key={cur} className="text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                  {meta?.flag} {formatCurrency(val, cur)}
                </span>
              );
            })}
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { setEditingBank(v => !v); setExpanded(true); }}
            className={cn(
              'p-2 rounded-xl transition-colors',
              editingBank
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                : 'text-blue-400 dark:text-slate-500 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-600',
            )}
            title="Editar banco"
          >
            <Icons.Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleDeleteBank}
            className="p-2 rounded-xl text-blue-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            title="Excluir banco"
          >
            <Icons.Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setExpanded(v => !v); setEditingBank(false); }}
            className="p-2 rounded-xl text-blue-400 dark:text-slate-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors ml-1"
          >
            <Icons.ChevronDown className={cn('w-4 h-4 transition-transform duration-200', expanded && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* ── Edit bank form ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editingBank && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-blue-100 dark:border-slate-700"
          >
            <div className="p-5 space-y-4 bg-blue-50/40 dark:bg-slate-800/40">
              <p className="text-sm font-bold text-blue-900 dark:text-slate-100">Editar Banco</p>
              <Input
                label="Nome"
                value={bankForm.name}
                onChange={e => setBankForm({ ...bankForm, name: e.target.value })}
              />
              <div className="space-y-2">
                <label className="text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Ícone</label>
                <div className="flex flex-wrap gap-2">
                  {BANK_ICONS.map(icon => {
                    const Ic = Icons[icon];
                    return Ic ? (
                      <button
                        key={icon}
                        onClick={() => setBankForm({ ...bankForm, icon })}
                        className={cn(
                          'w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all',
                          bankForm.icon === icon
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600'
                            : 'border-blue-100 dark:border-slate-700 text-blue-400 hover:border-blue-300',
                        )}
                      >
                        <Ic className="w-4 h-4" />
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {BANK_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setBankForm({ ...bankForm, color: c })}
                      className={cn('w-8 h-8 rounded-full border-4 transition-transform hover:scale-110', bankForm.color === c ? 'border-blue-900 dark:border-white scale-110' : 'border-transparent')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setEditingBank(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleSaveBank}><Icons.Check className="w-4 h-4" /> Salvar</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Accounts list ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-blue-50 dark:border-slate-800">
              {accounts.length === 0 && !addingAcc && (
                <p className="px-5 py-4 text-xs text-blue-400 dark:text-slate-500 italic">
                  Nenhum produto cadastrado nesta instituição.
                </p>
              )}

              {accounts.map(acc => {
                const Icon    = Icons[acc.icon as IconName] || Icons.Wallet;
                const isEditing = editingAccId === acc.id;
                const subtypeLabel = acc.subtype ? (SUBTYPE_LABELS[acc.subtype] ?? TYPE_LABELS[acc.type]) : TYPE_LABELS[acc.type];

                return (
                  <div key={acc.id} className="border-b border-blue-50 dark:border-slate-800 last:border-b-0">
                    {/* Account row */}
                    <div className={cn(
                      'flex items-center gap-3 px-5 py-3.5 transition-colors',
                      isEditing ? 'bg-blue-50/50 dark:bg-slate-800/50' : 'hover:bg-blue-50/30 dark:hover:bg-slate-800/20',
                    )}>
                      {/* Icon */}
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${bank.color}15`, color: bank.color }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Name + tags */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-blue-900 dark:text-slate-100 truncate">{acc.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', TYPE_COLORS[acc.type])}>
                            {TYPE_LABELS[acc.type]}
                          </span>
                          {acc.subtype && (
                            <span className="text-[10px] text-blue-400 dark:text-slate-500 font-medium">
                              {subtypeLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Balance + details */}
                      {(() => {
                        const cur = acc.currency ?? 'BRL';
                        const fmt = (v: number) => formatCurrency(v, cur);
                        const isFx = cur !== 'BRL';
                        const fxMeta = isFx ? CURRENCIES.find(c => c.code === cur) : null;
                        return (
                          <div className="text-right shrink-0 mr-2">
                            {isFx && (
                              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 mb-0.5">
                                {fxMeta?.flag} {cur}
                              </span>
                            )}
                            {acc.type === 'credit' ? (
                              <>
                                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{fmt(Math.abs(acc.balance))}</p>
                                {acc.creditLimit && <p className="text-[10px] text-blue-400 dark:text-slate-500">Lim {fmt(acc.creditLimit)}</p>}
                                {(acc.closingDay || acc.dueDay) && (
                                  <p className="text-[10px] text-blue-400 dark:text-slate-500">
                                    {acc.closingDay && `Fecha ${acc.closingDay}`}
                                    {acc.closingDay && acc.dueDay && ' · '}
                                    {acc.dueDay && `Vence ${acc.dueDay}`}
                                  </p>
                                )}
                              </>
                            ) : DEBT_TYPES.includes(acc.type) ? (
                              <>
                                <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{fmt(acc.balance)}</p>
                                {acc.creditLimit && <p className="text-[10px] text-blue-400 dark:text-slate-500">Orig. {fmt(acc.creditLimit)}</p>}
                                {(acc.closingDay || acc.dueDay) && (
                                  <p className="text-[10px] text-blue-400 dark:text-slate-500">
                                    {acc.closingDay && `${acc.closingDay}x rest.`}
                                    {acc.closingDay && acc.dueDay && ' · '}
                                    {acc.dueDay && `Vence ${acc.dueDay}`}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-sm font-bold text-blue-900 dark:text-slate-100">{fmt(acc.balance)}</p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => isEditing ? setEditingAccId(null) : startEditAcc(acc)}
                          className={cn(
                            'p-1.5 rounded-xl transition-colors',
                            isEditing
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                              : 'text-blue-300 dark:text-slate-600 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-slate-700',
                          )}
                          title="Editar produto"
                        >
                          <Icons.Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc)}
                          className="p-1.5 rounded-xl text-blue-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Excluir produto"
                        >
                          <Icons.Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Inline edit form */}
                    <AnimatePresence>
                      {isEditing && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-3 bg-blue-50/30 dark:bg-slate-800/30 border-t border-blue-100 dark:border-slate-700">
                            <p className="text-xs font-bold text-blue-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                              Editando produto · {acc.name}
                            </p>
                            <AccountForm
                              value={editAccForm}
                              onChange={f => { setEditAccForm(f); setEditAccError(''); }}
                              onSubmit={() => handleSaveAccount(acc.id)}
                              onCancel={() => setEditingAccId(null)}
                              submitLabel="Salvar"
                              error={editAccError}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Add account */}
              <div className="px-5 py-4 bg-blue-50/20 dark:bg-slate-800/20">
                <AnimatePresence mode="wait">
                  {addingAcc ? (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <p className="text-xs font-bold text-blue-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        Novo produto em {bank.name}
                      </p>
                      <AccountForm
                        value={newAcc}
                        onChange={f => { setNewAcc(f); setNewAccError(''); }}
                        onSubmit={handleAddAccount}
                        onCancel={() => { setAddingAcc(false); setNewAcc({ ...EMPTY_ACC }); setNewAccError(''); }}
                        submitLabel="Adicionar"
                        submitColor={bank.color}
                        error={newAccError}
                      />
                    </motion.div>
                  ) : (
                    <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <PlanGate limit="accounts" current={totalAccounts}>
                        <button
                          onClick={() => { setAddingAcc(true); setEditingAccId(null); setNewAcc({ ...EMPTY_ACC }); }}
                          className="flex items-center gap-2 text-sm font-semibold transition-colors py-0.5"
                          style={{ color: bank.color }}
                        >
                          <Icons.Plus className="w-4 h-4" />
                          Adicionar produto
                        </button>
                      </PlanGate>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── AccountManager ───────────────────────────────────────────────────────────

export function AccountManager({
  banks, accounts, transactions, reminders, onRefresh,
}: {
  banks: Bank[];
  accounts: BankAccount[];
  transactions: Transaction[];
  reminders: Reminder[];
  userId: string;
  onRefresh: () => Promise<void>;
}) {
  const [isAddingBank, setIsAddingBank] = useState(false);
  const [newBank, setNewBank] = useState({ name: '', color: '#3b82f6', icon: 'Landmark' as IconName });
  const [bankError, setBankError] = useState('');

  const handleAddBank = async () => {
    if (!newBank.name.trim()) { setBankError('Informe o nome do banco.'); return; }
    setBankError('');
    try {
      await banksApi.create({ name: newBank.name.trim(), color: newBank.color, icon: newBank.icon });
      setIsAddingBank(false);
      setNewBank({ name: '', color: '#3b82f6', icon: 'Landmark' });
      await onRefresh();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-5">
      {/* Page toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-blue-400 dark:text-slate-500 font-medium">
            {banks.length} {banks.length === 1 ? 'instituição' : 'instituições'} · {accounts.length} {accounts.length === 1 ? 'produto' : 'produtos'}
          </p>
        </div>
        <Button onClick={() => setIsAddingBank(v => !v)} variant="secondary">
          <Icons.Plus className="w-4 h-4" /> Novo Banco
        </Button>
      </div>

      {/* Add bank form */}
      <AnimatePresence>
        {isAddingBank && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-none shadow-lg bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between mb-5">
                <p className="font-bold text-blue-900 dark:text-slate-100">Novo Banco / Instituição</p>
                <button onClick={() => setIsAddingBank(false)} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800">
                  <Icons.X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <Input
                  label="Nome"
                  placeholder="Ex: Nubank, Itaú, XP..."
                  value={newBank.name}
                  onChange={e => { setNewBank({ ...newBank, name: e.target.value }); setBankError(''); }}
                  error={bankError || undefined}
                />
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Ícone</label>
                  <div className="flex flex-wrap gap-2">
                    {BANK_ICONS.map(icon => {
                      const Ic = Icons[icon];
                      return Ic ? (
                        <button
                          key={icon}
                          onClick={() => setNewBank({ ...newBank, icon })}
                          className={cn('w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all', newBank.icon === icon ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'border-blue-100 dark:border-slate-700 text-blue-400 hover:border-blue-300')}
                        >
                          <Ic className="w-5 h-5" />
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Cor</label>
                  <div className="flex flex-wrap gap-2">
                    {BANK_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewBank({ ...newBank, color: c })}
                        className={cn('w-9 h-9 rounded-full border-4 transition-transform hover:scale-110', newBank.color === c ? 'border-blue-900 dark:border-white scale-110' : 'border-transparent')}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                {/* Preview */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50/50 dark:bg-slate-800/50 border border-blue-100 dark:border-slate-700">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${newBank.color}20`, color: newBank.color }}>
                    {Icons[newBank.icon] && React.createElement(Icons[newBank.icon], { className: 'w-4 h-4' })}
                  </div>
                  <p className="text-sm font-semibold text-blue-900 dark:text-slate-100">{newBank.name || 'Nome do banco'}</p>
                </div>
                <Button className="w-full" onClick={handleAddBank}>
                  <Icons.Plus className="w-4 h-4" /> Criar Banco
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bank cards list */}
      <div className="space-y-3">
        {banks.map(bank => (
          <BankCard
            key={bank.id}
            bank={bank}
            accounts={accounts.filter(a => a.bankId === bank.id)}
            transactions={transactions}
            reminders={reminders}
            totalAccounts={accounts.length}
            onRefresh={onRefresh}
          />
        ))}
      </div>

      {/* Empty state */}
      {banks.length === 0 && !isAddingBank && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-slate-800 flex items-center justify-center">
            <Icons.Landmark className="w-8 h-8 text-blue-400 dark:text-slate-500" />
          </div>
          <div>
            <p className="font-semibold text-blue-900 dark:text-slate-100">Nenhum banco cadastrado</p>
            <p className="text-sm text-blue-400 dark:text-slate-500 mt-1">Adicione um banco para organizar suas contas e cartões</p>
          </div>
          <Button onClick={() => setIsAddingBank(true)}>
            <Icons.Plus className="w-4 h-4" /> Adicionar Banco
          </Button>
        </div>
      )}
    </div>
  );
}
