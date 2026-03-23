import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Icons } from '../Icons';
import { NotificationCenter } from '../NotificationCenter';
import { PlanBadge } from '../PlanGate';
import { Transaction, BankAccount, Category, UserProfile } from '../../types';
import { User } from '../../firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'transactions' | 'fatura' | 'investments' | 'analytics' | 'categories' | 'reminders' | 'accounts' | 'calendar' | 'goals' | 'audit' | 'openfinance' | 'planos' | 'settings';

interface TopBarProps {
  user: User;
  profile: UserProfile | null;
  darkMode: boolean;
  onDarkModeToggle: () => void;
  onLogout: () => void;
  onNavigate: (tab: Tab) => void;
  onClearData: () => void;
  clearing: boolean;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  transactions: Transaction[];
  accounts: BankAccount[];
  categories: Category[];
}

// ─── Search ───────────────────────────────────────────────────────────────────

type SearchResult =
  | { kind: 'transaction'; id: string; label: string; sub: string; tab: Tab }
  | { kind: 'account';     id: string; label: string; sub: string; tab: Tab }
  | { kind: 'category';    id: string; label: string; sub: string; tab: Tab };

function useGlobalSearch(
  query: string,
  transactions: Transaction[],
  accounts: BankAccount[],
  categories: Category[],
): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();

  const results: SearchResult[] = [];

  for (const t of transactions) {
    if (
      t.description?.toLowerCase().includes(q) ||
      String(t.amount).includes(q)
    ) {
      results.push({
        kind: 'transaction',
        id: t.id,
        label: t.description || `R$ ${t.amount}`,
        sub: `${t.type === 'income' ? 'Receita' : 'Despesa'} — ${t.date.toDate().toLocaleDateString('pt-BR')}`,
        tab: 'transactions',
      });
    }
    if (results.length >= 12) break;
  }

  for (const a of accounts) {
    if (a.name.toLowerCase().includes(q) || a.bank?.name?.toLowerCase().includes(q)) {
      results.push({
        kind: 'account',
        id: a.id,
        label: a.name,
        sub: `${a.bank?.name ?? ''} · ${a.type}`,
        tab: 'accounts',
      });
    }
    if (results.length >= 18) break;
  }

  for (const c of categories) {
    if (c.name.toLowerCase().includes(q)) {
      results.push({
        kind: 'category',
        id: c.id,
        label: c.name,
        sub: 'Categoria',
        tab: 'categories',
      });
    }
    if (results.length >= 22) break;
  }

  return results.slice(0, 10);
}

const KIND_ICON = {
  transaction: 'List',
  account: 'Landmark',
  category: 'Tag',
} as const;

const KIND_COLOR = {
  transaction: 'text-blue-500',
  account:     'text-violet-500',
  category:    'text-emerald-500',
} as const;

// ─── Language selector ────────────────────────────────────────────────────────

const LANGS = [
  { code: 'pt-BR', flag: '🇧🇷', label: 'Português' },
  { code: 'en-US', flag: '🇺🇸', label: 'English' },
  { code: 'es-ES', flag: '🇪🇸', label: 'Español' },
];

function LanguageSelector() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem('lang') ?? 'pt-BR');
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGS.find(l => l.code === lang) ?? LANGS[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Idioma"
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-blue-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <Icons.ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-blue-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-[110] overflow-hidden py-1">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); localStorage.setItem('lang', l.code); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                l.code === lang
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'text-blue-800 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800',
              )}
            >
              <span className="text-base">{l.flag}</span>
              {l.label}
              {l.code === lang && <Icons.Check className="w-3.5 h-3.5 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── User dropdown ────────────────────────────────────────────────────────────

function UserMenu({
  user, profile, onLogout, onNavigate, onClearData, clearing,
}: Pick<TopBarProps, 'user' | 'profile' | 'onLogout' | 'onNavigate' | 'onClearData' | 'clearing'>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const go = (tab: Tab) => { onNavigate(tab); setOpen(false); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl transition-all',
          open
            ? 'bg-blue-50 dark:bg-slate-800 ring-2 ring-blue-200 dark:ring-slate-600'
            : 'hover:bg-blue-50 dark:hover:bg-slate-800',
        )}
      >
        <img
          src={user.photoURL || ''}
          alt={user.displayName ?? ''}
          className="w-8 h-8 rounded-full border-2 border-blue-200 dark:border-slate-600 object-cover"
        />
        <div className="hidden sm:block text-left">
          <p className="text-xs font-semibold text-blue-900 dark:text-slate-100 leading-tight max-w-[96px] truncate">
            {user.displayName?.split(' ')[0]}
          </p>
          <PlanBadge />
        </div>
        <Icons.ChevronDown className={cn('w-3.5 h-3.5 text-blue-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 rounded-2xl border border-blue-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl z-[110] overflow-hidden">
          {/* User info header */}
          <div className="px-4 py-3.5 border-b border-blue-50 dark:border-slate-800 flex items-center gap-3">
            <img
              src={user.photoURL || ''}
              alt=""
              className="w-11 h-11 rounded-full border-2 border-blue-200 dark:border-slate-600 object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="font-semibold text-sm text-blue-900 dark:text-slate-100 truncate">{user.displayName}</p>
              <p className="text-xs text-blue-400 dark:text-slate-500 truncate">{user.email}</p>
              <div className="mt-0.5"><PlanBadge /></div>
            </div>
          </div>

          {/* Nav items */}
          <div className="py-1">
            <MenuItem icon="LayoutDashboard" label="Dashboard" onClick={() => go('dashboard')} />
            <MenuItem icon="Settings" label="Configurações" onClick={() => go('settings')} />
            <MenuItem icon="Sparkles" label="Planos & Assinatura" onClick={() => go('planos')} />
          </div>

          <div className="border-t border-blue-50 dark:border-slate-800 py-1">
            <button
              onClick={() => { onLogout(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Icons.LogOut className="w-4 h-4" />
              Sair da conta
            </button>
            <button
              disabled={clearing}
              onClick={() => { onClearData(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-red-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
            >
              <Icons.Trash2 className="w-3.5 h-3.5" />
              {clearing ? 'Limpando...' : 'Limpar todos os dados'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: keyof typeof Icons; label: string; onClick: () => void }) {
  const Icon = Icons[icon];
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-blue-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
    >
      <Icon className="w-4 h-4 text-blue-400 dark:text-slate-500" />
      {label}
    </button>
  );
}

// ─── SearchBar ────────────────────────────────────────────────────────────────

function SearchBar({
  transactions, accounts, categories, onNavigate,
}: Pick<TopBarProps, 'transactions' | 'accounts' | 'categories' | 'onNavigate'>) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useGlobalSearch(query, transactions, accounts, categories);
  const showPanel = focused && query.trim().length > 0;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setFocused(false);
        setQuery('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative flex-1 max-w-sm" ref={ref}>
      <div className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2 transition-all',
        focused
          ? 'border-blue-400 dark:border-blue-500 bg-white dark:bg-slate-800 ring-2 ring-blue-100 dark:ring-blue-900/50 shadow-sm'
          : 'border-blue-100 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 hover:border-blue-200 dark:hover:border-slate-600',
      )}>
        <Icons.Search className="w-4 h-4 text-blue-300 dark:text-slate-500 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Buscar transações, produtos, categorias..."
          className="flex-1 bg-transparent text-sm text-blue-900 dark:text-slate-100 placeholder-blue-300 dark:placeholder-slate-500 focus:outline-none min-w-0"
        />
        {query ? (
          <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="text-blue-300 dark:text-slate-500 hover:text-blue-500 dark:hover:text-slate-300">
            <Icons.X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono text-blue-200 dark:text-slate-600 bg-blue-50 dark:bg-slate-700 border border-blue-100 dark:border-slate-600 rounded px-1 py-0.5 shrink-0">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Results panel */}
      {showPanel && (
        <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-blue-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl z-[110] overflow-hidden">
          {results.length === 0 ? (
            <p className="text-center text-sm text-blue-400 dark:text-slate-500 py-5">Nenhum resultado para "{query}"</p>
          ) : (
            <div className="max-h-72 overflow-y-auto py-1.5">
              {results.map(r => {
                const Icon = Icons[KIND_ICON[r.kind]];
                return (
                  <button
                    key={r.kind + r.id}
                    onClick={() => { onNavigate(r.tab); setFocused(false); setQuery(''); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors text-left"
                  >
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-slate-800 shrink-0', KIND_COLOR[r.kind])}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-slate-100 truncate">{r.label}</p>
                      <p className="text-xs text-blue-400 dark:text-slate-500 truncate">{r.sub}</p>
                    </div>
                    <Icons.ArrowUpRight className="w-3.5 h-3.5 text-blue-300 dark:text-slate-600 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

export function TopBar({
  user, profile, darkMode, onDarkModeToggle, onLogout, onNavigate, onClearData, clearing,
  sidebarCollapsed, onToggleSidebar,
  transactions, accounts, categories,
}: TopBarProps) {
  return (
    <header
      className={`fixed top-0 right-0 z-50 h-14 flex items-center gap-3 px-4 md:px-6
                 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl
                 border-b border-blue-100/60 dark:border-slate-700/60
                 shadow-sm transition-all duration-300 left-0
                 ${sidebarCollapsed ? 'md:left-16' : 'md:left-64'}`}
    >
      {/* Sidebar toggle (mobile hamburger / desktop chevron) */}
      <button
        onClick={onToggleSidebar}
        className="md:hidden p-2 rounded-xl text-blue-400 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors shrink-0"
        title="Menu"
      >
        <Icons.Menu className="w-5 h-5" />
      </button>

      {/* Logo (mobile only) */}
      <div className="flex items-center gap-2 md:hidden shrink-0">
        <div className="w-7 h-7 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-600/30">
          <Icons.Wallet className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-bold text-base tracking-tight text-blue-900 dark:text-slate-100">Finanças Pro</span>
      </div>

      {/* Search — hidden on mobile, shown md+ */}
      <div className="hidden md:flex flex-1">
        <SearchBar
          transactions={transactions}
          accounts={accounts}
          categories={categories}
          onNavigate={onNavigate}
        />
      </div>

      {/* Spacer on mobile */}
      <div className="flex-1 md:hidden" />

      {/* Right actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Search icon (mobile) */}
        <MobileSearch transactions={transactions} accounts={accounts} categories={categories} onNavigate={onNavigate} />

        {/* Notifications */}
        <NotificationCenter onNavigate={(tab) => onNavigate(tab as Tab)} />

        {/* Language */}
        <LanguageSelector />

        {/* Dark mode */}
        <button
          onClick={onDarkModeToggle}
          title={darkMode ? 'Modo claro' : 'Modo escuro'}
          className="p-2 rounded-xl text-blue-400 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
        >
          {darkMode ? <Icons.Sun className="w-4.5 h-4.5 w-[18px] h-[18px]" /> : <Icons.Moon className="w-[18px] h-[18px]" />}
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-blue-100 dark:bg-slate-700 mx-0.5" />

        {/* User menu */}
        <UserMenu
          user={user}
          profile={profile}
          onLogout={onLogout}
          onNavigate={onNavigate}
          onClearData={onClearData}
          clearing={clearing}
        />
      </div>
    </header>
  );
}

// ─── Mobile search (icon button → overlay) ───────────────────────────────────

function MobileSearch({
  transactions, accounts, categories, onNavigate,
}: Pick<TopBarProps, 'transactions' | 'accounts' | 'categories' | 'onNavigate'>) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const results = useGlobalSearch(query, transactions, accounts, categories);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-2 rounded-xl text-blue-400 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
        title="Buscar"
      >
        <Icons.Search className="w-[18px] h-[18px]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex flex-col items-stretch p-3 pt-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-blue-100 dark:border-slate-700">
              <Icons.Search className="w-4 h-4 text-blue-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar..."
                className="flex-1 bg-transparent text-sm text-blue-900 dark:text-slate-100 placeholder-blue-300 dark:placeholder-slate-500 focus:outline-none"
              />
              <button onClick={() => { setOpen(false); setQuery(''); }} className="text-blue-400 hover:text-blue-600 p-1">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            {query.trim() && (
              <div className="max-h-72 overflow-y-auto py-1.5">
                {results.length === 0 ? (
                  <p className="text-center text-sm text-blue-400 dark:text-slate-500 py-5">Nenhum resultado</p>
                ) : results.map(r => {
                  const Icon = Icons[KIND_ICON[r.kind]];
                  return (
                    <button
                      key={r.kind + r.id}
                      onClick={() => { onNavigate(r.tab); setOpen(false); setQuery(''); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors text-left"
                    >
                      <Icon className={cn('w-4 h-4 shrink-0', KIND_COLOR[r.kind])} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-blue-900 dark:text-slate-100 truncate">{r.label}</p>
                        <p className="text-xs text-blue-400 dark:text-slate-500 truncate">{r.sub}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {!query.trim() && (
              <p className="text-center text-xs text-blue-300 dark:text-slate-600 py-5">Digite para buscar</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
