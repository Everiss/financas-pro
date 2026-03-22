import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { Icons } from '../components/Icons';
import { openFinanceApi, PluggyAccount, PluggyTransaction, PluggyItem } from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import { PluggyConnect } from 'react-pluggy-connect';

// Conectores sandbox pré-definidos da Pluggy
const SANDBOX_CONNECTORS = [
  { id: 0, name: 'Pluggy Bank (Sandbox)', fields: [{ name: 'user', label: 'Usuário', placeholder: 'user-ok' }, { name: 'password', label: 'Senha', placeholder: 'password-ok', type: 'password' }] },
  { id: 1, name: 'Pluggy Bank 2 (Sandbox)', fields: [{ name: 'user', label: 'Usuário', placeholder: 'user-ok' }, { name: 'password', label: 'Senha', placeholder: 'password-ok', type: 'password' }] },
];

export function OpenFinanceView() {
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [showWidget, setShowWidget] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualConnectorId, setManualConnectorId] = useState(0);
  const [manualFields, setManualFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectedItems, setConnectedItems] = useState<{ itemId: string; item?: PluggyItem; accounts: PluggyAccount[] }[]>(() => {
    try { return JSON.parse(localStorage.getItem('pluggy_items') || '[]'); } catch { return []; }
  });
  const [selectedAccount, setSelectedAccount] = useState<{ account: PluggyAccount; transactions: PluggyTransaction[] } | null>(null);
  const [txLoading, setTxLoading] = useState(false);

  const saveItems = (items: typeof connectedItems) => {
    setConnectedItems(items);
    localStorage.setItem('pluggy_items', JSON.stringify(items));
  };

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const { connectToken: token } = await openFinanceApi.getConnectToken();
      setConnectToken(token);
      setShowWidget(true);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao iniciar conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const connector = SANDBOX_CONNECTORS.find(c => c.id === manualConnectorId)!;
      const params: Record<string, string> = {};
      connector.fields.forEach(f => { params[f.name] = manualFields[f.name] || ''; });
      const item = await openFinanceApi.createItem(manualConnectorId, params);
      setShowManual(false);
      setManualFields({});
      // Aguarda sincronização
      const finalItem = await openFinanceApi.waitForItem(item.id) as PluggyItem;
      await handleSuccess(item.id, finalItem);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao conectar.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = async (itemId: string, preloadedItem?: PluggyItem) => {
    setShowWidget(false);
    setConnectToken(null);
    try {
      const [item, accounts] = await Promise.all([
        preloadedItem ? Promise.resolve(preloadedItem) : openFinanceApi.getItem(itemId),
        openFinanceApi.getAccounts(itemId),
      ]);
      saveItems([...connectedItems.filter(i => i.itemId !== itemId), { itemId, item, accounts }]);
    } catch {
      saveItems([...connectedItems, { itemId, accounts: [] }]);
    }
  };

  const handleViewTransactions = async (account: PluggyAccount) => {
    setTxLoading(true);
    setSelectedAccount(null);
    try {
      const transactions = await openFinanceApi.getTransactions(account.id);
      setSelectedAccount({ account, transactions });
    } catch (e: any) {
      setError(e.message ?? 'Erro ao buscar transações.');
    } finally {
      setTxLoading(false);
    }
  };

  const handleRemove = (itemId: string) => {
    saveItems(connectedItems.filter(i => i.itemId !== itemId));
    if (selectedAccount?.account.itemId === itemId) setSelectedAccount(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 to-blue-700 rounded-3xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Icons.Zap className="w-5 h-5 text-blue-300" />
            <span className="text-blue-300 text-xs font-bold uppercase tracking-widest">Powered by Pluggy</span>
          </div>
          <h3 className="text-xl font-bold">Open Finance Brasil</h3>
          <p className="text-blue-300 text-sm mt-1">Conecte suas contas bancárias reais com segurança e consentimento.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setShowManual(true); setError(''); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-3 bg-white/20 text-white font-semibold rounded-2xl hover:bg-white/30 transition-colors shrink-0 disabled:opacity-60 text-sm"
          >
            <Icons.Settings className="w-4 h-4" />
            Sandbox manual
          </button>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-3 bg-white text-blue-900 font-bold rounded-2xl hover:bg-blue-50 transition-colors shrink-0 disabled:opacity-60"
          >
            {loading ? <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-900 rounded-full animate-spin" /> : <Icons.Plus className="w-4 h-4" />}
            Conectar banco
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm">
          <Icons.AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Formulário de conexão manual (sandbox) */}
      <AnimatePresence>
        {showManual && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowManual(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 w-full max-w-sm space-y-5"
              onClick={e => e.stopPropagation()}
            >
              <div>
                <h3 className="font-bold text-blue-900 dark:text-slate-100 text-base">Conexão Manual (Sandbox)</h3>
                <p className="text-xs text-blue-500 dark:text-slate-400 mt-1">Use as credenciais de teste da Pluggy.</p>
              </div>

              {/* Seletor de conector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-blue-900/70 dark:text-slate-400">Conector</label>
                <select
                  value={manualConnectorId}
                  onChange={e => { setManualConnectorId(Number(e.target.value)); setManualFields({}); }}
                  className="w-full text-sm px-3 py-2.5 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {SANDBOX_CONNECTORS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Campos dinâmicos do conector */}
              {SANDBOX_CONNECTORS.find(c => c.id === manualConnectorId)?.fields.map(field => (
                <div key={field.name} className="space-y-1.5">
                  <label className="text-xs font-semibold text-blue-900/70 dark:text-slate-400">{field.label}</label>
                  <input
                    type={field.type ?? 'text'}
                    placeholder={field.placeholder}
                    value={manualFields[field.name] ?? ''}
                    onChange={e => setManualFields(prev => ({ ...prev, [field.name]: e.target.value }))}
                    className="w-full text-sm px-3 py-2.5 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              ))}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowManual(false)} className="flex-1 py-2.5 rounded-2xl border border-blue-200 dark:border-slate-700 text-sm font-semibold text-blue-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleManualConnect}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-2xl bg-blue-900 dark:bg-blue-600 text-white text-sm font-bold hover:bg-blue-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? <div className="w-4 h-4 border-2 border-blue-300 border-t-white rounded-full animate-spin" /> : null}
                  Conectar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pluggy Connect Widget (SDK oficial) */}
      {showWidget && connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={true}
          onSuccess={({ item }) => handleSuccess(item.id)}
          onClose={() => { setShowWidget(false); setConnectToken(null); }}
          onError={(err) => { setError(err.message ?? 'Erro na conexão.'); setShowWidget(false); setConnectToken(null); }}
        />
      )}

      {/* Connected banks */}
      {connectedItems.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-16 h-16 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icons.Landmark className="w-7 h-7 text-blue-300 dark:text-slate-500" />
          </div>
          <p className="text-sm font-semibold text-blue-900 dark:text-slate-200 mb-1">Nenhum banco conectado</p>
          <p className="text-xs text-blue-400 dark:text-slate-500">Clique em "Conectar banco" para sincronizar suas contas reais.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {connectedItems.map(({ itemId, item, accounts }) => (
            <div key={itemId} className="bg-white dark:bg-slate-900 rounded-3xl border border-blue-100 dark:border-slate-700 overflow-hidden">
              {/* Bank header */}
              <div className="flex items-center justify-between px-5 py-4 bg-blue-50/40 dark:bg-slate-800/40 border-b border-blue-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  {item?.connector?.logoImageUrl ? (
                    <img src={item.connector.logoImageUrl} alt={item.connector.name} className="w-9 h-9 rounded-xl object-contain bg-white p-1" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-slate-700 flex items-center justify-center">
                      <Icons.Landmark className="w-5 h-5 text-blue-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-blue-900 dark:text-slate-100 text-sm">{item?.connector?.name ?? 'Banco conectado'}</p>
                    <p className="text-[10px] text-blue-400 dark:text-slate-500 font-mono">{itemId.slice(-12)}</p>
                  </div>
                </div>
                <button onClick={() => handleRemove(itemId)} className="p-2 text-blue-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all">
                  <Icons.Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Accounts list */}
              <div className="divide-y divide-blue-50 dark:divide-slate-700/50">
                {accounts.length === 0 && (
                  <p className="text-xs text-blue-400 dark:text-slate-500 px-5 py-4">Nenhuma conta encontrada.</p>
                )}
                {accounts.map(acc => (
                  <div key={acc.id} className="flex items-center justify-between px-5 py-3 hover:bg-blue-50/30 dark:hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-slate-700 flex items-center justify-center">
                        {acc.type === 'CREDIT' ? <Icons.CreditCard className="w-4 h-4 text-blue-500" /> : <Icons.Wallet className="w-4 h-4 text-blue-500" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-blue-900 dark:text-slate-100">{acc.name}</p>
                        <p className="text-[10px] text-blue-400 dark:text-slate-500">{acc.subtype ?? acc.type} · {acc.number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-900 dark:text-slate-100">
                          {acc.currencyCode} {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleViewTransactions(acc)}
                        className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        Ver extrato
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction panel */}
      {txLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {selectedAccount && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 rounded-3xl border border-blue-100 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-blue-50/40 dark:bg-slate-800/40 border-b border-blue-100 dark:border-slate-700">
            <div>
              <p className="font-bold text-blue-900 dark:text-slate-100 text-sm">{selectedAccount.account.name} — Extrato</p>
              <p className="text-[10px] text-blue-400 dark:text-slate-500">{selectedAccount.transactions.length} transações</p>
            </div>
            <button onClick={() => setSelectedAccount(null)} className="p-2 rounded-xl text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-800 transition-colors">
              <Icons.X className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-blue-50 dark:divide-slate-700/50 max-h-96 overflow-y-auto">
            {selectedAccount.transactions.length === 0 && (
              <p className="text-xs text-blue-400 dark:text-slate-500 px-5 py-6 text-center">Nenhuma transação encontrada.</p>
            )}
            {selectedAccount.transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                    tx.type === 'CREDIT' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                  )}>
                    {tx.type === 'CREDIT' ? <Icons.ArrowDownLeft className="w-4 h-4" /> : <Icons.ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-blue-900 dark:text-slate-100 truncate">{tx.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-blue-400 dark:text-slate-500">{new Date(tx.date).toLocaleDateString('pt-BR')}</span>
                      {tx.category && <span className="text-[10px] font-medium text-blue-500 dark:text-slate-400">{tx.category}</span>}
                    </div>
                  </div>
                </div>
                <p className={cn('font-bold text-sm shrink-0 ml-3', tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600')}>
                  {tx.type === 'CREDIT' ? '+' : '−'} {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
