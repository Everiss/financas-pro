import React, { useState } from 'react';
import { cn, formatCurrency } from '../lib/utils';
import { Icons, IconName } from '../components/Icons';
import { Button, Card, Input, RadioGroup, Select } from '../components/ui';
import { banksApi, accountsApi, transactionsApi, remindersApi } from '../services/api';
import { Transaction, BankAccount, Bank, Reminder } from '../types';
import { PlanGate } from '../components/PlanGate';
import { BANK_COLORS, BANK_ICONS, EMPTY_ACC } from '../lib/constants';

export function AccountManager({ banks, accounts, transactions, reminders, onRefresh }: { banks: Bank[]; accounts: BankAccount[]; transactions: Transaction[]; reminders: Reminder[]; userId: string; onRefresh: () => Promise<void> }) {
  const [isAddingBank, setIsAddingBank] = useState(false);
  const [newBank, setNewBank] = useState({ name: '', color: '#3b82f6', icon: 'Landmark' as IconName });
  const [addingAccTo, setAddingAccTo] = useState<string | null>(null);
  const [newAcc, setNewAcc] = useState({ ...EMPTY_ACC });
  const [accError, setAccError] = useState('');
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set());

  // Edit state
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [editBankForm, setEditBankForm] = useState({ name: '', color: '#3b82f6', icon: 'Landmark' as IconName });
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [editAccForm, setEditAccForm] = useState({ ...EMPTY_ACC });
  const [editAccError, setEditAccError] = useState('');

  const typeLabels: Record<string, string> = {
    checking: 'Conta Corrente',
    savings: 'Poupança',
    investment: 'Investimentos',
    credit: 'Cartão de Crédito',
  };

  const handleAddBank = async () => {
    if (!newBank.name) return;
    try {
      await banksApi.create({ name: newBank.name, color: newBank.color, icon: newBank.icon });
      setIsAddingBank(false);
      setNewBank({ name: '', color: '#3b82f6', icon: 'Landmark' });
      await onRefresh();
    } catch (err) { console.error(err); }
  };

  const startEditBank = (bank: Bank) => {
    setEditingBankId(bank.id);
    setEditBankForm({ name: bank.name, color: bank.color, icon: bank.icon as IconName });
    setIsAddingBank(false);
  };

  const handleSaveBank = async (id: string) => {
    if (!editBankForm.name.trim()) return;
    try {
      await banksApi.update(id, { name: editBankForm.name.trim(), color: editBankForm.color, icon: editBankForm.icon });
      setEditingBankId(null);
      await onRefresh();
    } catch (err) { console.error(err); }
  };

  const handleDeleteBank = async (id: string) => {
    try {
      await banksApi.delete(id);
      await onRefresh();
    } catch (err) { console.error(err); }
  };

  const handleAddAccount = async (bankId: string) => {
    if (!newAcc.name.trim()) {
      setAccError('Informe o nome da conta ou cartão.');
      return;
    }
    setAccError('');
    try {
      const data: any = {
        name: newAcc.name.trim(),
        type: newAcc.type,
        balance: parseFloat(newAcc.balance) || 0,
        color: newAcc.color,
        icon: newAcc.type === 'investment' ? 'TrendingUp' : newAcc.type === 'credit' ? 'CreditCard' : newAcc.icon,
        bankId,
      };
      if (newAcc.type === 'credit') {
        if (newAcc.creditLimit) data.creditLimit = parseFloat(newAcc.creditLimit);
        if (newAcc.closingDay) data.closingDay = parseInt(newAcc.closingDay);
        if (newAcc.dueDay) data.dueDay = parseInt(newAcc.dueDay);
      }
      if (newAcc.type === 'investment') data.investmentType = newAcc.investmentType;
      await accountsApi.create(data);
      setAddingAccTo(null);
      setNewAcc({ ...EMPTY_ACC });
      await onRefresh();
    } catch (err: any) {
      setAccError(err?.message ?? 'Erro ao salvar. Tente novamente.');
    }
  };

  const startEditAcc = (acc: BankAccount) => {
    setEditingAccId(acc.id);
    setEditAccForm({
      name: acc.name,
      type: acc.type,
      balance: String(acc.balance ?? ''),
      color: acc.color,
      icon: acc.icon as IconName,
      creditLimit: acc.creditLimit != null ? String(acc.creditLimit) : '',
      closingDay: acc.closingDay != null ? String(acc.closingDay) : '',
      dueDay: acc.dueDay != null ? String(acc.dueDay) : '',
      investmentType: acc.investmentType ?? 'cdb',
    });
    setEditAccError('');
    setAddingAccTo(null);
  };

  const handleSaveAccount = async (id: string) => {
    if (!editAccForm.name.trim()) {
      setEditAccError('Informe o nome da conta ou cartão.');
      return;
    }
    setEditAccError('');
    try {
      const data: any = {
        name: editAccForm.name.trim(),
        type: editAccForm.type,
        balance: parseFloat(editAccForm.balance) || 0,
        color: editAccForm.color,
        icon: editAccForm.type === 'investment' ? 'TrendingUp' : editAccForm.type === 'credit' ? 'CreditCard' : editAccForm.icon,
      };
      if (editAccForm.type === 'credit') {
        data.creditLimit = editAccForm.creditLimit ? parseFloat(editAccForm.creditLimit) : null;
        data.closingDay = editAccForm.closingDay ? parseInt(editAccForm.closingDay) : null;
        data.dueDay = editAccForm.dueDay ? parseInt(editAccForm.dueDay) : null;
      }
      if (editAccForm.type === 'investment') data.investmentType = editAccForm.investmentType;
      await accountsApi.update(id, data);
      setEditingAccId(null);
      await onRefresh();
    } catch (err: any) {
      setEditAccError(err?.message ?? 'Erro ao salvar. Tente novamente.');
    }
  };

  const handleDeleteAccount = async (acc: BankAccount) => {
    const linkedTx = transactions.filter(t => t.accountId === acc.id);
    const linkedRem = reminders.filter(r => r.accountId === acc.id);

    const lines = [`Conta: ${acc.name}`];
    if (linkedTx.length > 0) lines.push(`${linkedTx.length} transação(ões) vinculada(s)`);
    if (linkedRem.length > 0) lines.push(`${linkedRem.length} lembrete(s) vinculado(s)`);
    lines.push('\nEssa ação não pode ser desfeita.');

    if (!confirm(lines.join('\n'))) return;

    try {
      await Promise.all([
        ...linkedTx.map(t => transactionsApi.delete(t.id)),
        ...linkedRem.map(r => remindersApi.delete(r.id)),
      ]);
      await accountsApi.delete(acc.id);
      await onRefresh();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-blue-900 dark:text-slate-100">Contas Bancárias</h2>
          <p className="text-blue-500 dark:text-slate-400 mt-1">Bancos, contas e cartões organizados</p>
        </div>
        <Button onClick={() => { setIsAddingBank(true); }} variant="secondary">
          <Icons.Plus className="w-4 h-4" /> Novo Banco
        </Button>
      </div>

      {/* Add bank form */}
      {isAddingBank && (
        <Card className="border-none shadow-lg bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-blue-900 dark:text-slate-100">Novo Banco / Instituição</h3>
            <button onClick={() => setIsAddingBank(false)} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800">
              <Icons.X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <Input label="Nome" placeholder="Ex: Nubank, Itaú, XP..." value={newBank.name} onChange={e => setNewBank({ ...newBank, name: e.target.value })} />
            <div className="space-y-2">
              <label className="text-sm font-medium text-blue-900/70 dark:text-slate-400">Ícone</label>
              <div className="flex flex-wrap gap-2">
                {BANK_ICONS.map(icon => {
                  const Ic = Icons[icon];
                  return Ic ? (
                    <button
                      key={icon}
                      onClick={() => setNewBank({ ...newBank, icon })}
                      className={cn('w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all', newBank.icon === icon ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'border-blue-100 dark:border-slate-700 text-blue-400 dark:text-slate-500 hover:border-blue-300 dark:hover:border-slate-500')}
                    >
                      <Ic className="w-5 h-5" />
                    </button>
                  ) : null;
                })}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-blue-900/70 dark:text-slate-400">Cor</label>
              <div className="flex flex-wrap gap-2">
                {BANK_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewBank({ ...newBank, color: c })}
                    className={cn('w-8 h-8 rounded-full border-4 transition-transform hover:scale-110', newBank.color === c ? 'border-blue-900 dark:border-white scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={handleAddBank}>
              <Icons.Plus className="w-4 h-4" /> Criar Banco
            </Button>
          </div>
        </Card>
      )}

      {/* Bank cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {banks.map(bank => {
          const bankAccounts = accounts.filter(a => a.bankId === bank.id);
          const BankIcon = Icons[bank.icon as IconName] || Icons.Landmark;
          const totalBalance = bankAccounts
            .filter(a => a.type !== 'credit')
            .reduce((s, a) => s + a.balance, 0);
          const isExpanded = expandedBanks.has(bank.id);
          const toggleExpand = () => setExpandedBanks(prev => {
            const next = new Set(prev);
            next.has(bank.id) ? next.delete(bank.id) : next.add(bank.id);
            return next;
          });

          return (
            <div key={bank.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-blue-50 dark:border-slate-800 overflow-hidden group flex flex-col">
              {/* Bank header — clickable to expand */}
              <button
                onClick={toggleExpand}
                className="w-full flex items-center justify-between p-4 hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm shrink-0" style={{ backgroundColor: `${bank.color}20`, color: bank.color }}>
                    <BankIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-900 dark:text-slate-100 text-sm">{bank.name}</h3>
                    <p className="text-xs text-blue-500 dark:text-slate-400 mt-0.5">
                      {bankAccounts.length} {bankAccounts.length === 1 ? 'conta' : 'contas'} · <span className="font-semibold text-emerald-600">{formatCurrency(totalBalance)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => editingBankId === bank.id ? setEditingBankId(null) : startEditBank(bank)}
                      className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                      title="Editar banco"
                    >
                      <Icons.Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBank(bank.id)}
                      className="p-1.5 text-blue-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                      title="Remover banco"
                    >
                      <Icons.Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Icons.ChevronDown className={cn('w-4 h-4 text-blue-400 dark:text-slate-500 transition-transform duration-200 ml-1', isExpanded && 'rotate-180')} />
                </div>
              </button>

              {/* Inline edit bank form */}
              {editingBankId === bank.id && (
                <div className="mx-4 mb-3 p-4 rounded-xl bg-blue-50/50 dark:bg-slate-800/50 border border-blue-100 dark:border-slate-700 space-y-4">
                  <h4 className="text-sm font-bold text-blue-900 dark:text-slate-100">Editar Banco</h4>
                  <Input label="Nome" value={editBankForm.name} onChange={e => setEditBankForm({ ...editBankForm, name: e.target.value })} />
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-blue-900/70 dark:text-slate-400">Ícone</label>
                    <div className="flex flex-wrap gap-2">
                      {BANK_ICONS.map(icon => {
                        const Ic = Icons[icon];
                        return Ic ? (
                          <button key={icon} onClick={() => setEditBankForm({ ...editBankForm, icon })} className={cn('w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all', editBankForm.icon === icon ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'border-blue-100 dark:border-slate-700 text-blue-400 dark:text-slate-500 hover:border-blue-300 dark:hover:border-slate-500')}>
                            <Ic className="w-4 h-4" />
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-blue-900/70 dark:text-slate-400">Cor</label>
                    <div className="flex flex-wrap gap-2">
                      {BANK_COLORS.map(c => (
                        <button key={c} onClick={() => setEditBankForm({ ...editBankForm, color: c })} className={cn('w-7 h-7 rounded-full border-4 transition-transform hover:scale-110', editBankForm.color === c ? 'border-blue-900 dark:border-white scale-110' : 'border-transparent')} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => setEditingBankId(null)}>Cancelar</Button>
                    <Button className="flex-1" onClick={() => handleSaveBank(bank.id)}><Icons.Check className="w-4 h-4" /> Salvar</Button>
                  </div>
                </div>
              )}

              {/* Collapsible accounts list */}
              {isExpanded && (
                <div className="border-t border-blue-50 dark:border-slate-800 flex-1">
                  <div className="divide-y divide-blue-50 dark:divide-slate-800">
                    {bankAccounts.map(acc => {
                      const Icon = Icons[acc.icon as IconName] || Icons.CreditCard;
                      return (
                        <div key={acc.id}>
                          <div className="flex items-center justify-between px-4 py-3 group/acc hover:bg-blue-50/30 dark:hover:bg-slate-800/30 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${bank.color}15`, color: bank.color }}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-blue-900 dark:text-slate-100 truncate">{acc.name}</p>
                                <p className="text-[10px] text-blue-400 dark:text-slate-500">{typeLabels[acc.type]}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <div className="text-right">
                                {acc.type === 'credit' ? (
                                  <>
                                    <p className="text-xs font-bold text-blue-800 dark:text-slate-100">{formatCurrency(Math.abs(acc.balance))}</p>
                                    {acc.creditLimit && <p className="text-[10px] text-blue-400 dark:text-slate-500">Lim: {formatCurrency(acc.creditLimit)}</p>}
                                    {(acc.closingDay || acc.dueDay) && (
                                      <p className="text-[10px] text-blue-400 dark:text-slate-500">
                                        {acc.closingDay && `Fecha ${acc.closingDay}`}{acc.closingDay && acc.dueDay && ' · '}{acc.dueDay && `Vence ${acc.dueDay}`}
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-xs font-bold text-blue-900 dark:text-slate-100">{formatCurrency(acc.balance)}</p>
                                )}
                              </div>
                              <div className="flex gap-0.5 opacity-0 group-hover/acc:opacity-100 transition-all">
                                <button onClick={() => editingAccId === acc.id ? setEditingAccId(null) : startEditAcc(acc)} className="p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-lg transition-all" title="Editar">
                                  <Icons.Edit2 className="w-3 h-3" />
                                </button>
                                <button onClick={() => handleDeleteAccount(acc)} className="p-1 text-blue-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all" title="Excluir">
                                  <Icons.Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Inline edit account form */}
                          {editingAccId === acc.id && (
                            <div className="px-4 pb-4 pt-2 bg-blue-50/30 dark:bg-slate-800/30 border-t border-blue-100 dark:border-slate-700 space-y-3">
                              <h4 className="text-sm font-bold text-blue-900 dark:text-slate-100">Editar {typeLabels[acc.type]}</h4>
                              <Input label="Nome" value={editAccForm.name} onChange={e => { setEditAccForm({ ...editAccForm, name: e.target.value }); setEditAccError(''); }} error={!editAccForm.name.trim() && editAccError ? editAccError : undefined} />
                              <RadioGroup label="Tipo" value={editAccForm.type} onChange={val => setEditAccForm({ ...editAccForm, type: val as BankAccount['type'] })} options={[{ value: 'checking', label: 'Corrente' }, { value: 'savings', label: 'Poupança' }, { value: 'investment', label: 'Invest.' }, { value: 'credit', label: 'Cartão' }]} />
                              <Input label={editAccForm.type === 'credit' ? 'Fatura atual' : 'Saldo'} inputMode="decimal" placeholder="0,00" value={editAccForm.balance} onChange={e => setEditAccForm({ ...editAccForm, balance: e.target.value.replace(',', '.') })} />
                              {editAccForm.type === 'investment' && (
                                <Select label="Tipo de Investimento" value={editAccForm.investmentType} onChange={e => setEditAccForm({ ...editAccForm, investmentType: e.target.value as BankAccount['investmentType'] })} options={[{ value: 'cdb', label: 'CDB / Renda Fixa' }, { value: 'stock', label: 'Ações' }, { value: 'fund', label: 'Fundos' }, { value: 'fii', label: 'FIIs' }, { value: 'other', label: 'Outros' }]} />
                              )}
                              {editAccForm.type === 'credit' && (
                                <div className="space-y-3 p-3 rounded-xl bg-white/60 dark:bg-slate-800 border border-blue-100 dark:border-slate-700">
                                  <Input label="Limite de crédito" inputMode="decimal" placeholder="0,00" value={editAccForm.creditLimit} onChange={e => setEditAccForm({ ...editAccForm, creditLimit: e.target.value.replace(',', '.') })} />
                                  <div className="grid grid-cols-2 gap-3">
                                    <Input label="Fechamento" type="number" placeholder="Dia" value={editAccForm.closingDay} onChange={e => setEditAccForm({ ...editAccForm, closingDay: e.target.value })} />
                                    <Input label="Vencimento" type="number" placeholder="Dia" value={editAccForm.dueDay} onChange={e => setEditAccForm({ ...editAccForm, dueDay: e.target.value })} />
                                  </div>
                                </div>
                              )}
                              {editAccError && editAccForm.name.trim() && <p className="text-xs text-red-500 font-medium flex items-center gap-1"><Icons.AlertCircle className="w-3.5 h-3.5" /> {editAccError}</p>}
                              <div className="flex gap-2">
                                <Button variant="secondary" className="flex-1" onClick={() => setEditingAccId(null)}>Cancelar</Button>
                                <Button className="flex-1" onClick={() => handleSaveAccount(acc.id)}><Icons.Check className="w-4 h-4" /> Salvar</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                {/* Add account form or button */}
                <div className="px-4 py-3 border-t border-blue-50 dark:border-slate-800">
                {addingAccTo === bank.id ? (
                  <div className="mt-4 pt-4 border-t border-blue-100/50 dark:border-slate-700/50 space-y-4">
                    <h4 className="text-sm font-bold text-blue-900 dark:text-slate-100">Nova conta / cartão</h4>
                    <Input label="Nome" placeholder="Ex: Conta Corrente, Roxinho..." value={newAcc.name} onChange={e => { setNewAcc({ ...newAcc, name: e.target.value }); setAccError(''); }} error={!newAcc.name.trim() && accError ? accError : undefined} />
                    <RadioGroup label="Tipo" value={newAcc.type} onChange={val => setNewAcc({ ...newAcc, type: val as BankAccount['type'] })} options={[{ value: 'checking', label: 'Corrente' }, { value: 'savings', label: 'Poupança' }, { value: 'investment', label: 'Invest.' }, { value: 'credit', label: 'Cartão' }]} />
                    <Input label={newAcc.type === 'credit' ? 'Fatura atual' : 'Saldo inicial'} inputMode="decimal" placeholder="0,00" value={newAcc.balance} onChange={e => setNewAcc({ ...newAcc, balance: e.target.value.replace(',', '.') })} />
                    {newAcc.type === 'investment' && (
                      <Select label="Tipo de Investimento" value={newAcc.investmentType} onChange={e => setNewAcc({ ...newAcc, investmentType: e.target.value as BankAccount['investmentType'] })} options={[{ value: 'cdb', label: 'CDB / Renda Fixa' }, { value: 'stock', label: 'Ações' }, { value: 'fund', label: 'Fundos' }, { value: 'fii', label: 'FIIs' }, { value: 'other', label: 'Outros' }]} />
                    )}
                    {newAcc.type === 'credit' && (
                      <div className="space-y-3 p-3 rounded-xl bg-blue-50/50 dark:bg-slate-800/50 border border-blue-100 dark:border-slate-700">
                        <Input label="Limite de crédito" inputMode="decimal" placeholder="0,00" value={newAcc.creditLimit} onChange={e => setNewAcc({ ...newAcc, creditLimit: e.target.value.replace(',', '.') })} />
                        <div className="grid grid-cols-2 gap-3">
                          <Input label="Fechamento" type="number" placeholder="Dia" value={newAcc.closingDay} onChange={e => setNewAcc({ ...newAcc, closingDay: e.target.value })} />
                          <Input label="Vencimento" type="number" placeholder="Dia" value={newAcc.dueDay} onChange={e => setNewAcc({ ...newAcc, dueDay: e.target.value })} />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="secondary" className="flex-1" onClick={() => { setAddingAccTo(null); setNewAcc({ ...EMPTY_ACC }); setAccError(''); }}>Cancelar</Button>
                      <Button className="flex-1" style={{ backgroundColor: bank.color }} onClick={() => handleAddAccount(bank.id)}><Icons.Plus className="w-4 h-4" /> Adicionar</Button>
                    </div>
                    {accError && newAcc.name.trim() && <p className="text-xs text-red-500 font-medium flex items-center gap-1"><Icons.AlertCircle className="w-3.5 h-3.5" /> {accError}</p>}
                  </div>
                ) : (
                  <PlanGate limit="accounts" current={accounts.length}>
                    <button
                      onClick={() => { setAddingAccTo(bank.id); setNewAcc({ ...EMPTY_ACC }); toggleExpand(); }}
                      className="w-full flex items-center gap-2 py-2 text-xs font-medium transition-colors"
                      style={{ color: bank.color }}
                    >
                      <Icons.Plus className="w-3.5 h-3.5" />
                      Adicionar conta ou cartão
                    </button>
                  </PlanGate>
                )}
                </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {banks.length === 0 && !isAddingBank && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
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
