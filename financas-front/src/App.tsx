import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { PluggyConnect } from 'react-pluggy-connect';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from './firebase';
import {
  transactionsApi, categoriesApi, accountsApi, banksApi, goalsApi, remindersApi, usersApi, auditApi, openFinanceApi, subscriptionApi,
  TransactionResponse, CategoryResponse, AccountResponse, BankResponse, GoalResponse, ReminderResponse,
  AiGoalsStrategy, CreateTransactionPayload, AuditLogResponse, PluggyAccount, PluggyTransaction, PluggyItem, SubscriptionStatus
} from './services/api';
import { Transaction, Category, UserProfile, Reminder, BankAccount, Bank, Goal } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Icons, IconName } from './components/Icons';
import { cn, formatCurrency, formatDate } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';

import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getFinancialInsights, getGoalInsights } from './services/aiService';

// --- API → Frontend type adapters ---

function fakeTimestamp(dateStr: string | null | undefined) {
  return {
    toDate: () => (dateStr ? new Date(dateStr) : new Date()),
    seconds: dateStr ? Math.floor(new Date(dateStr).getTime() / 1000) : 0,
  };
}

function toTransaction(r: TransactionResponse): Transaction {
  return {
    id: r.id,
    amount: Number(r.amount),
    type: r.type,
    category: r.categoryId || (r.category as any)?.id || '',
    date: fakeTimestamp(r.date) as any,
    description: r.description,
    accountId: r.accountId,
    paymentMethod: r.paymentMethod,
    userId: r.userId,
  };
}

function toCategory(r: CategoryResponse): Category {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    budget: r.budget != null ? Number(r.budget) : undefined,
    userId: r.userId || '',
  };
}

function toBank(r: BankResponse): Bank {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    icon: r.icon,
    userId: r.userId,
  };
}

function toAccount(r: AccountResponse): BankAccount {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    investmentType: r.investmentType,
    balance: Number(r.balance),
    creditLimit: r.creditLimit != null ? Number(r.creditLimit) : undefined,
    closingDay: r.closingDay,
    dueDay: r.dueDay,
    color: r.color,
    icon: r.icon,
    userId: r.userId,
    bankId: r.bankId,
  };
}

function toGoal(r: GoalResponse): Goal {
  return {
    id: r.id,
    name: r.name,
    targetAmount: Number(r.targetAmount),
    currentAmount: Number(r.currentAmount),
    deadline: r.deadline ? (fakeTimestamp(r.deadline) as any) : null,
    category: r.category as Goal['category'],
    color: r.color,
    icon: r.icon,
    userId: r.userId,
  };
}

function toReminder(r: ReminderResponse): Reminder {
  return {
    id: r.id,
    title: r.title,
    amount: Number(r.amount),
    type: r.type,
    category: r.categoryId || (r.category as any)?.id || '',
    accountId: r.accountId,
    dueDate: fakeTimestamp(r.dueDate) as any,
    frequency: r.frequency,
    notes: r.notes,
    userId: r.userId,
  };
}

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/10',
    secondary: 'bg-white dark:bg-slate-800 text-blue-900 dark:text-slate-100 border border-blue-100 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 shadow-sm',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
    ghost: 'bg-transparent text-blue-600 dark:text-blue-400 hover:bg-blue-50/80 dark:hover:bg-slate-800',
  };

  return (
    <button 
      className={cn(
        'px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, title, subtitle, action }: { children: React.ReactNode; className?: string; title?: string; subtitle?: string; action?: React.ReactNode; key?: string }) => (
  <div className={cn('bg-white dark:bg-slate-900 rounded-2xl border border-blue-100/50 dark:border-slate-700/50 shadow-sm', className)}>
    {(title || subtitle || action) && (
      <div className="px-6 py-5 flex items-center justify-between border-b border-blue-50 dark:border-slate-700/50">
        <div>
          {title && <h3 className="text-base font-semibold text-blue-900 dark:text-slate-100">{title}</h3>}
          {subtitle && <p className="text-sm text-blue-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const Input = ({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="text-sm font-medium text-blue-900/70 dark:text-slate-400">{label}</label>}
    <input
      className={cn(
        'w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/30 outline-none transition-all duration-200 text-sm text-blue-900 dark:text-slate-100 placeholder:text-blue-300 dark:placeholder:text-slate-500',
        error && 'border-red-500 focus:ring-red-500/10 focus:border-red-500',
        props.className
      )}
      {...props}
    />
    {error && <p className="text-xs font-medium text-red-500">{error}</p>}
  </div>
);

const TextArea = ({ label, error, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="text-sm font-medium text-blue-900/70 dark:text-slate-400">{label}</label>}
    <textarea
      className={cn(
        'w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/30 outline-none transition-all duration-200 text-sm text-blue-900 dark:text-slate-100 placeholder:text-blue-300 dark:placeholder:text-slate-500 resize-none min-h-[100px]',
        error && 'border-red-500 focus:ring-red-500/10 focus:border-red-500',
        props.className
      )}
      {...props}
    />
    {error && <p className="text-xs font-medium text-red-500">{error}</p>}
  </div>
);

const Checkbox = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="flex items-center gap-3 cursor-pointer group">
    <div className="relative flex items-center justify-center">
      <input 
        type="checkbox" 
        className="peer sr-only" 
        {...props}
      />
      <div className="w-5 h-5 border-2 border-blue-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all duration-200 group-hover:border-blue-400" />
      <Icons.Check className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200 pointer-events-none" />
    </div>
    <span className="text-sm font-medium text-blue-900/70 dark:text-slate-400 group-hover:text-blue-900 dark:group-hover:text-slate-100 transition-colors">{label}</span>
  </label>
);

const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (val: boolean) => void; label?: string }) => (
  <label className="flex items-center gap-3 cursor-pointer group">
    <div 
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-10 h-5 rounded-full transition-all duration-300',
        checked ? 'bg-blue-600' : 'bg-blue-100 dark:bg-slate-700'
      )}
    >
      <div 
        className={cn(
          'absolute top-1 left-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </div>
    {label && <span className="text-sm font-medium text-blue-900/70 dark:text-slate-400 group-hover:text-blue-900 dark:group-hover:text-slate-100 transition-colors">{label}</span>}
  </label>
);

const RadioGroup = ({ label, options, value, onChange }: { label?: string; options: { value: string; label: string }[]; value: string; onChange: (val: string) => void }) => (
  <div className="space-y-2 w-full">
    {label && <label className="text-sm font-medium text-blue-900/70 dark:text-slate-400">{label}</label>}
    <div className="flex flex-wrap gap-3">
      {options.map(opt => (
        <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
          <div className="relative flex items-center justify-center">
            <input 
              type="radio" 
              name={label}
              className="peer sr-only" 
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <div className="w-5 h-5 border-2 border-blue-200 dark:border-slate-600 rounded-full bg-white dark:bg-slate-800 peer-checked:border-blue-600 transition-all duration-200 group-hover:border-blue-400" />
            <div className="absolute w-2.5 h-2.5 bg-blue-600 rounded-full opacity-0 peer-checked:opacity-100 transition-opacity duration-200 pointer-events-none" />
          </div>
          <span className="text-sm font-medium text-blue-900/70 dark:text-slate-400 group-hover:text-blue-900 dark:group-hover:text-slate-100 transition-colors">{opt.label}</span>
        </label>
      ))}
    </div>
  </div>
);

const Select = ({ label, options, error, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: { value: string; label: string }[]; error?: string }) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="text-sm font-medium text-blue-900/70 dark:text-slate-400">{label}</label>}
    <div className="relative">
      <select 
        className={cn(
          'w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/30 outline-none transition-all duration-200 text-sm text-blue-900 dark:text-slate-100 appearance-none',
          error && 'border-red-500 focus:ring-red-500/10 focus:border-red-500',
          props.className
        )}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <Icons.ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 pointer-events-none" />
    </div>
    {error && <p className="text-xs font-medium text-red-500">{error}</p>}
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'categories' | 'reminders' | 'accounts' | 'calendar' | 'goals' | 'audit' | 'openfinance' | 'planos'>('dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [transferenciaModal, setTransferenciaModal] = useState<{ open: boolean; prefillToId?: string; prefillAmount?: number }>({ open: false });
  const [dashboardMonth, setDashboardMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored !== null ? stored === 'dark' : prefersDark;
    // Aplica a classe sincronamente antes do primeiro render
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return isDark;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const fetchAllData = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const [txs, cats, bks, accs, gls, rems] = await Promise.all([
        transactionsApi.getAll(),
        categoriesApi.getAll(),
        banksApi.getAll(),
        accountsApi.getAll(),
        goalsApi.getAll(),
        remindersApi.getAll(),
      ]);
      setTransactions(txs.map(toTransaction));
      setCategories(cats.map(toCategory));
      setBanks(bks.map(toBank));
      setAccounts(accs.map(toAccount));
      setGoals(gls.map(toGoal));
      setReminders(rems.map(toReminder));
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false); // UI atualiza imediatamente — sem aguardar o backend

      if (u) {
        // Carrega perfil e dados em background sem bloquear o redirect
        usersApi.getMe()
          .then(userProfile => {
            setProfile({
              uid: u.uid,
              displayName: userProfile.displayName,
              email: userProfile.email,
              photoURL: userProfile.photoURL,
              currency: userProfile.currency,
            });
          })
          .catch(err => console.error('Erro ao carregar perfil:', err));

        fetchAllData();
      } else {
        setTransactions([]);
        setCategories([]);
        setAccounts([]);
        setGoals([]);
        setReminders([]);
      }
    });
    return unsubscribe;
  }, [fetchAllData]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  const handleLogout = () => signOut(auth);

  // --- Timeout de inatividade ---
  const INACTIVITY_MS = 30 * 60 * 1000; // 30 min
  const WARN_COUNTDOWN = 60; // segundos de aviso antes do logout
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARN_COUNTDOWN);
  const inactivityTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
  }, []);

  const resetInactivity = useCallback(() => {
    if (!user) return;
    setInactivityWarning(false);
    clearTimers();
    inactivityTimer.current = setTimeout(() => {
      setInactivityWarning(true);
      setCountdown(WARN_COUNTDOWN);
      let remaining = WARN_COUNTDOWN;
      countdownTimer.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(countdownTimer.current!);
          signOut(auth);
        }
      }, 1000);
    }, INACTIVITY_MS);
  }, [user, clearTimers]);

  useEffect(() => {
    if (!user) { clearTimers(); return; }
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetInactivity));
    resetInactivity();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivity));
      clearTimers();
    };
  }, [user, resetInactivity, clearTimers]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50/30 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-blue-200 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50/30 dark:bg-slate-950 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-4">
            <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-blue-600/20">
              <Icons.Wallet className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-5xl font-bold text-blue-900 dark:text-slate-100 tracking-tighter">Finanças Pro</h1>
            <p className="text-blue-500 dark:text-slate-400 text-lg font-medium">Gerencie seu dinheiro com inteligência e simplicidade.</p>
          </div>
          
          <Button onClick={handleLogin} className="w-full py-4 text-lg shadow-xl shadow-blue-600/10">
            <Icons.User className="w-5 h-5" />
            Entrar com Google
          </Button>

          <p className="text-xs text-blue-400 font-medium">
            Ao entrar, você concorda com nossos termos de uso e política de privacidade.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div
        className="min-h-screen bg-blue-50/30 dark:bg-slate-950 text-blue-900 dark:text-slate-100 font-sans"
        style={{ backgroundColor: darkMode ? '#020617' : '#f0f7ff', color: darkMode ? '#f1f5f9' : '#0f172a' }}
      >
        {/* Modal de inatividade */}
        <AnimatePresence>
          {inactivityWarning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl max-w-sm w-full mx-4 text-center"
              >
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icons.Clock className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-blue-900 dark:text-slate-100 mb-2">Sessão inativa</h3>
                <p className="text-blue-500 dark:text-slate-400 text-sm mb-6">
                  Você será desconectado por inatividade em <span className="font-bold text-amber-500 text-lg">{countdown}s</span>
                </p>
                <div className="w-full bg-blue-100 dark:bg-slate-700 rounded-full h-1.5 mb-6 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                    style={{ width: `${(countdown / WARN_COUNTDOWN) * 100}%` }}
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" onClick={handleLogout}>Sair agora</Button>
                  <Button variant="primary" className="flex-1" onClick={resetInactivity}>Continuar</Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Sidebar / Nav */}
        <nav
          className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-0 md:w-64 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t md:border-t-0 md:border-r border-blue-100/50 dark:border-slate-700/50 z-50"
          style={{ backgroundColor: darkMode ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)' }}
        >
          <div className="h-full flex flex-col p-4">
            <div className="hidden md:flex items-center gap-3 mb-8 px-2 mt-4">
              <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                <Icons.Wallet className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-blue-900 dark:text-slate-100">Finanças Pro</span>
            </div>

            <div className="flex md:flex-col items-center md:items-stretch justify-around md:justify-start gap-2 flex-1">
              <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon="LayoutDashboard" label="Dashboard" />
              <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon="List" label="Transações" />
              <NavButton active={activeTab === 'investments'} onClick={() => setActiveTab('investments')} icon="TrendingUp" label="Investimentos" />
              <NavButton active={activeTab === 'categories'} onClick={() => setActiveTab('categories')} icon="Tag" label="Categorias" />
              <NavButton active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon="Calendar" label="Calendário" />
              <NavButton active={activeTab === 'reminders'} onClick={() => setActiveTab('reminders')} icon="List" label="Lembretes" />
              <NavButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon="Landmark" label="Contas" />
              <NavButton active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} icon="Target" label="Metas" />
              <NavButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon="List" label="Histórico" />
              <NavButton active={activeTab === 'openfinance'} onClick={() => setActiveTab('openfinance')} icon="Zap" label="Open Finance" />
              <NavButton active={activeTab === 'planos'} onClick={() => setActiveTab('planos')} icon="Sparkles" label="Planos" />
            </div>

            <div className="hidden md:block pt-4 border-t border-blue-100 dark:border-slate-700 mt-auto">
              <div className="flex items-center gap-3 px-2 mb-4">
                <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border border-blue-200 dark:border-slate-600" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate dark:text-slate-100">{user.displayName}</p>
                  <p className="text-xs text-blue-500 dark:text-slate-400 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-xl text-blue-400 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                  title={darkMode ? 'Modo claro' : 'Modo escuro'}
                >
                  {darkMode ? <Icons.Sun className="w-4 h-4" /> : <Icons.Moon className="w-4 h-4" />}
                </button>
              </div>
              <Button variant="ghost" className="w-full justify-start text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={handleLogout}>
                <Icons.LogOut className="w-4 h-4" />
                Sair
              </Button>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="pb-24 md:pb-8 md:pl-64 min-h-screen">
          <div className="p-4 md:p-8">
            <header className="flex items-start sm:items-center justify-between mb-10 mt-4 md:mt-0 gap-4 flex-col sm:flex-row">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-blue-900 dark:text-slate-100">
                  {activeTab === 'dashboard' && 'Dashboard'}
                  {activeTab === 'transactions' && 'Minhas Transações'}
                  {activeTab === 'investments' && 'Meus Investimentos'}
                  {activeTab === 'categories' && 'Categorias'}
                  {activeTab === 'calendar' && 'Calendário Financeiro'}
                  {activeTab === 'reminders' && 'Lembretes'}
                  {activeTab === 'accounts' && 'Minhas Contas'}
                  {activeTab === 'goals' && 'Minhas Metas'}
                  {activeTab === 'audit' && 'Histórico de Operações'}
                  {activeTab === 'openfinance' && 'Open Finance'}
                  {activeTab === 'planos' && 'Planos & Assinatura'}
                </h2>
                <p className="text-blue-500 dark:text-slate-400 font-medium mt-1">
                  {activeTab === 'dashboard' && `Bem-vindo de volta, ${user.displayName?.split(' ')[0]}!`}
                  {activeTab === 'transactions' && 'Histórico completo de movimentações.'}
                  {activeTab === 'investments' && 'Acompanhe o crescimento do seu patrimônio.'}
                  {activeTab === 'categories' && 'Organize seus gastos por categorias.'}
                  {activeTab === 'calendar' && 'Visualize seus vencimentos e períodos críticos.'}
                  {activeTab === 'reminders' && 'Gerencie pagamentos recorrentes e futuros.'}
                  {activeTab === 'accounts' && 'Gerencie suas contas bancárias e cartões.'}
                  {activeTab === 'goals' && 'Planeje e acompanhe seus sonhos financeiros.'}
                  {activeTab === 'audit' && 'Rastreabilidade de todas as operações realizadas.'}
                  {activeTab === 'openfinance' && 'Conecte suas contas bancárias reais via Open Finance Brasil.'}
                  {activeTab === 'planos' && 'Escolha o plano ideal para você.'}
                </p>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="md:hidden flex items-center justify-center w-10 h-10 rounded-full border border-blue-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors text-blue-500 dark:text-slate-400"
                  title={darkMode ? 'Modo claro' : 'Modo escuro'}
                >
                  {darkMode ? <Icons.Sun className="w-4 h-4" /> : <Icons.Moon className="w-4 h-4" />}
                </button>
                <button onClick={handleLogout} className="md:hidden flex items-center justify-center w-10 h-10 rounded-full border border-blue-200 dark:border-slate-700 overflow-hidden hover:opacity-80 transition-opacity" title="Sair">
                  <img src={user.photoURL || ''} className="w-full h-full object-cover" alt="Sair" />
                </button>
                <Button variant="secondary" onClick={() => setTransferenciaModal({ open: true })} className="shadow-sm hidden sm:flex">
                  <Icons.ArrowUpRight className="w-4 h-4 rotate-45" />
                  Transferência
                </Button>
                <Button onClick={() => setIsAddModalOpen(true)} className="shadow-lg shadow-blue-900/10">
                  <Icons.Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Nova Transação</span>
                </Button>
              </div>
            </header>

            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  {/* Month selector */}
                  <div className="flex items-center justify-between bg-white/70 dark:bg-slate-900/70 rounded-2xl px-5 py-3 border border-blue-100/50 dark:border-slate-700/50 shadow-sm">
                    <h3 className="font-semibold text-blue-900 dark:text-slate-100 capitalize">
                      {format(dashboardMonth, 'MMMM yyyy', { locale: ptBR })}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDashboardMonth(prev => subMonths(prev, 1))}
                        className="p-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800 text-blue-400 dark:text-slate-500 transition-colors"
                      >
                        <Icons.ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); setDashboardMonth(d); }}
                        className="px-3 py-1 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        Hoje
                      </button>
                      <button
                        onClick={() => setDashboardMonth(prev => addMonths(prev, 1))}
                        className="p-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800 text-blue-400 dark:text-slate-500 transition-colors"
                      >
                        <Icons.ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {/* Bloco 1 — Patrimônio geral */}
                  <PatrimonioCard accounts={accounts} transactions={transactions} />

                  {/* Bloco 2 — Fluxo do mês selecionado */}
                  <FluxoMes transactions={transactions} month={dashboardMonth} />

                  {/* Bloco 3 — Insights IA */}
                  <AIInsights transactions={transactions} />

                  {/* Bloco 4 — Estratégia de compra */}
                  <CreditStrategy accounts={accounts} />

                  {/* Bloco 5 — Cartões | Orçamento */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <CreditCardUsage accounts={accounts} transactions={transactions} onPayBill={(toId, amount) => setTransferenciaModal({ open: true, prefillToId: toId, prefillAmount: amount })} />
                    <BudgetProgress transactions={transactions} categories={categories} month={dashboardMonth} />
                  </div>

                  {/* Bloco 6 — Metas */}
                  <GoalsSummary goals={goals} onSeeAll={() => setActiveTab('goals')} />

                  {/* Bloco 7 — Gráficos */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <FluxoCaixaChart transactions={transactions} darkMode={darkMode} />
                    <GastosCategoriaChart transactions={transactions} categories={categories} month={dashboardMonth} darkMode={darkMode} />
                  </div>

                  {/* Bloco 8 — Lembretes + Recentes */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <UpcomingReminders reminders={reminders} categories={categories} accounts={accounts} userId={user.uid} onRefresh={fetchAllData} />
                    <RecentTransactions transactions={transactions} categories={categories} accounts={accounts} month={dashboardMonth} onSeeAll={() => setActiveTab('transactions')} />
                  </div>
                </motion.div>
              )}

              {activeTab === 'transactions' && (
                <motion.div key="transactions" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <TransactionManager transactions={transactions} categories={categories} accounts={accounts} onRefresh={fetchAllData} />
                </motion.div>
              )}

              {activeTab === 'investments' && (
                <motion.div key="investments" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <InvestmentsView accounts={accounts} transactions={transactions} />
                </motion.div>
              )}

              {activeTab === 'categories' && (
                <motion.div key="categories" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <CategoryManager categories={categories} userId={user.uid} onRefresh={fetchAllData} />
                </motion.div>
              )}

              {activeTab === 'reminders' && (
                <motion.div key="reminders" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <ReminderManager reminders={reminders} categories={categories} accounts={accounts} userId={user.uid} onRefresh={fetchAllData} />
                </motion.div>
              )}

              {activeTab === 'accounts' && (
                <motion.div key="accounts" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <AccountManager banks={banks} accounts={accounts} transactions={transactions} userId={user.uid} onRefresh={fetchAllData} />
                </motion.div>
              )}

              {activeTab === 'calendar' && (
                <motion.div key="calendar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <CalendarView reminders={reminders} transactions={transactions} categories={categories} accounts={accounts} />
                </motion.div>
              )}

              {activeTab === 'goals' && (
                <motion.div key="goals" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <GoalsView goals={goals} userId={user.uid} transactions={transactions} accounts={accounts} categories={categories} onRefresh={fetchAllData} />
                </motion.div>
              )}

              {activeTab === 'audit' && (
                <motion.div key="audit" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <AuditLogView />
                </motion.div>
              )}

              {activeTab === 'openfinance' && (
                <motion.div key="openfinance" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <OpenFinanceView />
                </motion.div>
              )}

              {activeTab === 'planos' && (
                <motion.div key="planos" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <PlanosView />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Modals */}
        <AnimatePresence>
          {isAddModalOpen && (
            <TransactionModal
              onClose={() => setIsAddModalOpen(false)}
              categories={categories}
              accounts={accounts}
              transactions={transactions}
              userId={user.uid}
              onRefresh={fetchAllData}
            />
          )}
          {transferenciaModal.open && (
            <TransferenciaModal
              accounts={accounts}
              prefillToId={transferenciaModal.prefillToId}
              prefillAmount={transferenciaModal.prefillAmount}
              onClose={() => setTransferenciaModal({ open: false })}
              onRefresh={fetchAllData}
            />
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-Components ---

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: IconName; label: string }) {
  const Icon = Icons[icon];
  return (
    <button 
      onClick={onClick}
      className={cn(
        'flex flex-col md:flex-row items-center gap-1 md:gap-3 px-4 py-2 md:py-3.5 rounded-2xl transition-all duration-300',
        active ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-blue-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-slate-200'
      )}
    >
      <Icon className={cn("w-5 h-5 transition-transform duration-300", active ? "text-white scale-110" : "text-blue-300")} />
      <span className="text-[10px] md:text-sm font-semibold">{label}</span>
    </button>
  );
}

function DashboardStats({ transactions, accounts, month }: { transactions: Transaction[]; accounts: BankAccount[]; month: Date }) {
  const stats = useMemo(() => {
    const filterByMonth = (txs: Transaction[], m: Date) =>
      txs.filter(t => {
        const d = t.date.toDate();
        return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
      });

    const prevMonth = subMonths(month, 1);
    const monthTxs = filterByMonth(transactions, month);
    const prevTxs = filterByMonth(transactions, prevMonth);

    const income = monthTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = monthTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const prevIncome = prevTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const prevExpense = prevTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

    const calcTrend = (curr: number, prev: number) =>
      prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);

    const balance = accounts.reduce((acc, a) => a.type === 'credit' ? acc - a.balance : acc + a.balance, 0);
    const invested = accounts
      .filter(a => a.type === 'investment')
      .reduce((sum, a) => sum + a.balance, 0);

    return {
      income, expense, balance, invested,
      incomeTrend: calcTrend(income, prevIncome),
      expenseTrend: calcTrend(expense, prevExpense),
    };
  }, [transactions, accounts, month]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Saldo Total" amount={stats.balance} icon="Wallet" color="blue" />
      <StatCard title="Investimentos" amount={stats.invested} icon="TrendingUp" color="blue" />
      <StatCard title="Receitas" amount={stats.income} icon="ArrowUpRight" color="emerald" trend={stats.incomeTrend} />
      <StatCard title="Despesas" amount={stats.expense} icon="ArrowDownLeft" color="red" trend={stats.expenseTrend} />
    </div>
  );
}

function CreditStrategy({ accounts }: { accounts: BankAccount[] }) {
  const creditCards = accounts.filter(a => a.type === 'credit' && a.closingDay);
  
  const bestCard = useMemo(() => {
    if (creditCards.length === 0) return null;
    
    const today = new Date().getDate();
    
    return creditCards.reduce((best, current) => {
      if (!best) return current;
      
      const getDaysSinceClosing = (closingDay: number) => {
        if (today > closingDay) return today - closingDay;
        return today + (31 - closingDay); // Using 31 for safety
      };
      
      const bestDays = getDaysSinceClosing(best.closingDay!);
      const currentDays = getDaysSinceClosing(current.closingDay!);
      
      return currentDays < bestDays ? current : best;
    }, null as BankAccount | null);
  }, [creditCards]);

  if (!bestCard) return null;

  return (
    <Card className="border-none shadow-sm bg-indigo-50/50 backdrop-blur-sm border border-indigo-100/50 p-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
          <Icons.TrendingUp className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest">Estratégia de Compra</h3>
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">RECOMENDADO</span>
          </div>
          <p className="text-blue-700 text-sm mt-1">
            Melhor cartão para usar hoje: <span className="font-bold text-indigo-800">{bestCard.name}</span>
          </p>
          <p className="text-[10px] text-blue-500 font-medium mt-1">
            O fechamento foi dia {bestCard.closingDay}, garantindo o maior prazo para pagamento da próxima fatura.
          </p>
        </div>
      </div>
    </Card>
  );
}

function AIInsights({ transactions }: { transactions: Transaction[] }) {
  const [insights, setInsights] = useState<{ insights: any[]; summary: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    const data = await getFinancialInsights();
    if (data) setInsights(data);
    setLoading(false);
  };

  useEffect(() => {
    if (transactions.length > 0 && !insights) {
      fetchInsights();
    }
  }, [transactions, insights]);

  if (!insights && !loading) return null;

  return (
    <Card className="border-none shadow-sm bg-gradient-to-br from-blue-900 to-blue-800 text-white overflow-hidden relative">
      <div className="absolute top-0 right-0 p-8 opacity-10">
        <Icons.Sparkles className="w-32 h-32" />
      </div>
      
      <div className="relative z-10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <Icons.Sparkles className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h3 className="font-bold text-lg tracking-tight">Insights da IA</h3>
              <p className="text-blue-300/60 text-xs font-medium uppercase tracking-wider">Análise Financeira Inteligente</p>
            </div>
          </div>
          <button 
            onClick={fetchInsights} 
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <Icons.TrendingUp className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-white/5 rounded w-3/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-24 bg-white/5 rounded-2xl"></div>
              <div className="h-24 bg-white/5 rounded-2xl"></div>
              <div className="h-24 bg-white/5 rounded-2xl"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-blue-100 text-sm leading-relaxed font-medium">
              "{insights?.summary}"
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights?.insights.map((insight, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    {insight.type === 'warning' && <Icons.AlertCircle className="w-4 h-4 text-amber-300" />}
                    {insight.type === 'success' && <Icons.TrendingUp className="w-4 h-4 text-emerald-300" />}
                    {insight.type === 'info' && <Icons.Sparkles className="w-4 h-4 text-blue-300" />}
                    <h4 className="font-bold text-sm text-white">{insight.title}</h4>
                  </div>
                  <p className="text-xs text-blue-200/70 leading-relaxed">
                    {insight.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function StatCard({ title, amount, icon, color, trend }: { title: string; amount: number; icon: IconName; color: 'blue' | 'emerald' | 'red'; trend?: number | null }) {
  const Icon = Icons[icon];
  const colors = {
    blue: 'text-blue-600 bg-blue-50/50',
    emerald: 'text-emerald-600 bg-emerald-50/50',
    red: 'text-red-600 bg-red-50/50',
  };

  return (
    <Card className="relative overflow-hidden group border-none shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm hover:shadow-md transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-blue-900/60 dark:text-slate-400">{title}</p>
        <div className={cn('p-2.5 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3', colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <h4 className="text-3xl font-bold tracking-tight text-blue-900 dark:text-slate-100">{formatCurrency(amount)}</h4>
        {trend !== null && trend !== undefined && (
          <div className={cn('flex items-center gap-1 mt-1.5 text-xs font-semibold', trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {trend >= 0 ? <Icons.ArrowUpRight className="w-3.5 h-3.5" /> : <Icons.ArrowDownLeft className="w-3.5 h-3.5" />}
            <span>{Math.abs(trend)}% vs mês anterior</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function PatrimonioCard({ accounts, transactions }: { accounts: BankAccount[]; transactions: Transaction[] }) {
  const stats = useMemo(() => {
    const contasCorrentes = accounts
      .filter(a => a.type === 'checking' || a.type === 'savings')
      .reduce((s, a) => s + a.balance, 0);

    const investimentos = accounts
      .filter(a => a.type === 'investment')
      .reduce((s, a) => s + a.balance, 0);

    const faturas = accounts
      .filter(a => a.type === 'credit')
      .reduce((s, a) => s + Math.max(0, a.balance), 0);

    const limiteTotal = accounts
      .filter(a => a.type === 'credit' && (a.creditLimit ?? 0) > 0)
      .reduce((s, a) => s + (a.creditLimit ?? 0), 0);

    const limiteDisponivel = Math.max(0, limiteTotal - faturas);
    const usoPercent = limiteTotal > 0 ? (faturas / limiteTotal) * 100 : 0;

    return { contasCorrentes, investimentos, faturas, limiteTotal, limiteDisponivel, usoPercent, patrimonio: contasCorrentes + investimentos - faturas };
  }, [accounts, transactions]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 text-white shadow-xl shadow-blue-900/20 p-6">
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
        <Icons.Wallet className="w-56 h-56" />
      </div>
      <div className="relative z-10">
        <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-1">Patrimônio Líquido</p>
        <h2 className={cn('text-5xl font-bold tracking-tight mb-1', stats.patrimonio >= 0 ? 'text-white' : 'text-red-300')}>
          {formatCurrency(stats.patrimonio)}
        </h2>
        <p className="text-blue-300/60 text-xs font-medium mb-6">Contas + Investimentos − Faturas abertas</p>

        {/* Tiles: Contas, Investimentos, Cartões */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Contas e Poupança */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/15 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Icons.Wallet className="w-4 h-4 text-blue-300 shrink-0" />
              <span className="text-[10px] font-bold text-blue-200/70 uppercase tracking-wider">Contas e Poupança</span>
            </div>
            <p className="text-lg font-bold text-white">{formatCurrency(stats.contasCorrentes)}</p>
          </div>

          {/* Investimentos */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/15 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Icons.TrendingUp className="w-4 h-4 text-blue-300 shrink-0" />
              <span className="text-[10px] font-bold text-blue-200/70 uppercase tracking-wider">Investimentos</span>
            </div>
            <p className="text-lg font-bold text-white">{formatCurrency(stats.investimentos)}</p>
          </div>

          {/* Cartões de Crédito — tile especial com barra */}
          {stats.limiteTotal > 0 && (
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/15 transition-colors col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <Icons.CreditCard className="w-4 h-4 text-blue-300 shrink-0" />
                <span className="text-[10px] font-bold text-blue-200/70 uppercase tracking-wider">Cartões de Crédito</span>
              </div>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className={cn('text-lg font-bold leading-none', stats.faturas > 0 ? 'text-red-300' : 'text-white')}>
                    {formatCurrency(stats.faturas)}
                    <span className="text-[10px] font-semibold text-blue-200/50 ml-1">utilizado</span>
                  </p>
                  <p className="text-[11px] text-blue-200/60 font-medium mt-0.5">
                    de {formatCurrency(stats.limiteTotal)} no limite
                  </p>
                </div>
                <span className={cn('text-xs font-bold', stats.usoPercent > 80 ? 'text-red-300' : stats.usoPercent > 50 ? 'text-amber-300' : 'text-emerald-300')}>
                  {stats.usoPercent.toFixed(0)}%
                </span>
              </div>
              {/* Barra de uso */}
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', stats.usoPercent > 80 ? 'bg-red-400' : stats.usoPercent > 50 ? 'bg-amber-400' : 'bg-emerald-400')}
                  style={{ width: `${Math.min(stats.usoPercent, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-blue-200/50 font-medium mt-1.5">
                Disponível: <span className="text-emerald-300 font-bold">{formatCurrency(stats.limiteDisponivel)}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FluxoMes({ transactions, month }: { transactions: Transaction[]; month: Date }) {
  const stats = useMemo(() => {
    const filterByMonth = (txs: Transaction[], m: Date) =>
      txs.filter(t => {
        const d = t.date.toDate();
        return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
      });
    const prevMonth = subMonths(month, 1);
    const monthTxs = filterByMonth(transactions, month);
    const prevTxs = filterByMonth(transactions, prevMonth);
    const income = monthTxs.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
    const expense = monthTxs.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    const prevIncome = prevTxs.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
    const prevExpense = prevTxs.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    const calcTrend = (curr: number, prev: number) => prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);
    return { income, expense, resultado: income - expense, incomeTrend: calcTrend(income, prevIncome), expenseTrend: calcTrend(expense, prevExpense) };
  }, [transactions, month]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard title="Receitas" amount={stats.income} icon="ArrowUpRight" color="emerald" trend={stats.incomeTrend} />
      <StatCard title="Despesas" amount={stats.expense} icon="ArrowDownLeft" color="red" trend={stats.expenseTrend} />
      <Card className="relative overflow-hidden border-none shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-blue-900/60 dark:text-slate-400">Resultado do Mês</p>
          <div className={cn('p-2.5 rounded-2xl', stats.resultado >= 0 ? 'text-emerald-600 bg-emerald-50/50' : 'text-red-600 bg-red-50/50')}>
            {stats.resultado >= 0 ? <Icons.ArrowUpRight className="w-5 h-5" /> : <Icons.ArrowDownLeft className="w-5 h-5" />}
          </div>
        </div>
        <h4 className={cn('text-3xl font-bold tracking-tight', stats.resultado >= 0 ? 'text-emerald-600' : 'text-red-600')}>
          {stats.resultado >= 0 ? '+' : ''}{formatCurrency(stats.resultado)}
        </h4>
        <p className="text-xs font-medium text-blue-400 dark:text-slate-500 mt-1.5">
          {stats.resultado >= 0 ? 'Saldo positivo no mês' : 'Déficit no mês'}
        </p>
      </Card>
    </div>
  );
}

function BudgetProgress({ transactions, categories, month }: { transactions: Transaction[]; categories: Category[]; month: Date }) {
  const expensesThisMonth = transactions.filter(t => {
    const d = t.date.toDate();
    return t.type === 'expense' && d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
  });

  const categoriesWithBudget = categories.filter(c => c.budget && c.budget > 0);

  if (categoriesWithBudget.length === 0) return null;

  return (
    <Card title="Metas de Gastos (Este Mês)" subtitle="Acompanhe seu orçamento por categoria" className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="space-y-6">
        {categoriesWithBudget.map(cat => {
          const spent = expensesThisMonth.filter(t => t.category === cat.id).reduce((acc, t) => acc + t.amount, 0);
          const budget = cat.budget!;
          const percentage = Math.min((spent / budget) * 100, 100);
          const isOverBudget = spent > budget;
          const isNearBudget = percentage >= 80 && !isOverBudget;

          return (
            <div key={cat.id} className="space-y-3">
              <div className="flex justify-between text-sm items-end">
                <span className="font-medium flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </span>
                <span className="text-blue-500 dark:text-slate-400 text-xs font-medium">
                  <span className={cn("text-sm", isOverBudget ? 'text-red-600 font-bold' : 'text-blue-900 dark:text-slate-100')}>
                    {formatCurrency(spent)}
                  </span>
                  <span className="mx-1">/</span>
                  {formatCurrency(budget)}
                </span>
              </div>
              <div className="h-2 bg-blue-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    isOverBudget ? "bg-red-500" : isNearBudget ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function CreditCardUsage({ accounts, transactions, onPayBill }: { accounts: BankAccount[]; transactions: Transaction[]; onPayBill?: (toId: string, amount: number) => void }) {
  const creditCards = useMemo(() => {
    return accounts
      .filter(a => a.type === 'credit' && a.creditLimit && a.creditLimit > 0)
      .map(acc => {
        const used = Math.max(0, acc.balance);
        const available = Math.max(0, acc.creditLimit! - used);
        const percentage = Math.min((used / acc.creditLimit!) * 100, 100);
        return { id: acc.id, name: acc.name, used, available, limit: acc.creditLimit!, percentage, color: acc.color };
      });
  }, [accounts, transactions]);

  if (creditCards.length === 0) return null;

  return (
    <Card title="Cartões de Crédito" subtitle="Limite utilizado vs disponível" className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="space-y-6">
        {creditCards.map(card => (
          <div key={card.id} className="space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-blue-900 dark:text-slate-100 text-sm">{card.name}</h4>
                <p className="text-[10px] text-blue-500 dark:text-slate-400 font-medium uppercase tracking-wider">Limite: {formatCurrency(card.limit)}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className={cn("text-sm font-bold", card.percentage > 90 ? "text-red-600" : "text-blue-900 dark:text-slate-100")}>
                    {formatCurrency(card.used)}
                  </span>
                  <span className="text-blue-400 dark:text-slate-500 text-xs mx-1">utilizado</span>
                </div>
                {onPayBill && card.used > 0 && (
                  <button
                    onClick={() => onPayBill(card.id, card.used)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors whitespace-nowrap"
                  >
                    Pagar Fatura
                  </button>
                )}
              </div>
            </div>

            <div className="relative h-3 bg-blue-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${card.percentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={cn("absolute h-full rounded-full", card.percentage > 90 ? "bg-red-500" : card.percentage > 70 ? "bg-amber-500" : "bg-emerald-500")}
                style={{ backgroundColor: card.percentage <= 70 ? card.color : undefined }}
              />
            </div>

            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-blue-400">{card.percentage.toFixed(1)}% utilizado</span>
              <span className="text-emerald-600">Disponível: {formatCurrency(card.available)}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FluxoCaixaChart({ transactions, darkMode }: { transactions: Transaction[]; darkMode: boolean }) {
  const gridColor = darkMode ? '#1e293b' : '#e4e4e7';
  const tickColor = darkMode ? '#64748b' : '#a1a1aa';
  const tooltipStyle = { borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)', padding: '12px 16px', fontWeight: 500, backgroundColor: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#f1f5f9' : '#0f172a' };
  const cursorFill = darkMode ? '#0f172a' : '#f4f4f5';

  const barData = useMemo(() => {
    const data: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date);
      const m = date.getMonth();
      const y = date.getFullYear();
      const monthTxs = transactions.filter(t => {
        const d = t.date.toDate();
        return d.getMonth() === m && d.getFullYear() === y;
      });
      data.push({
        name: monthLabel,
        receitas: monthTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
        despesas: monthTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0),
      });
    }
    return data;
  }, [transactions]);

  return (
    <Card title="Fluxo de Caixa" subtitle="Receitas vs Despesas — últimos 6 meses" className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="h-[300px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: tickColor, fontWeight: 500 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: tickColor, fontWeight: 500 }} />
            <Tooltip cursor={{ fill: cursorFill }} contentStyle={tooltipStyle} formatter={(value: number) => formatCurrency(value)} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '16px', color: tickColor }} formatter={(v) => v === 'receitas' ? 'Receitas' : 'Despesas'} />
            <Bar dataKey="receitas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
            <Bar dataKey="despesas" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function GastosCategoriaChart({ transactions, categories, month, darkMode }: { transactions: Transaction[]; categories: Category[]; month: Date; darkMode: boolean }) {
  const tooltipStyle = { borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)', padding: '12px 16px', fontWeight: 500, backgroundColor: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#f1f5f9' : '#0f172a' };

  const pieData = useMemo(() => {
    const expenses = transactions.filter(t => {
      const d = t.date.toDate();
      return t.type === 'expense' && d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
    });
    const grouped = expenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped).map(([catId, amount]) => {
      const cat = categories.find(c => c.id === catId);
      return { name: cat?.name || 'Outros', value: amount, color: cat?.color || '#71717a' };
    }).sort((a, b) => b.value - a.value);
  }, [transactions, categories, month]);

  const total = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <Card title="Gastos por Categoria" subtitle={`Distribuição das despesas — ${format(month, 'MMM yyyy', { locale: ptBR })}`} className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      {pieData.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm text-blue-400 dark:text-slate-500 font-medium">Sem despesas neste mês.</p>
        </div>
      ) : (
        <>
          <div className="h-[240px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={6} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-xs font-medium text-blue-700 dark:text-slate-300 flex-1 truncate">{item.name}</span>
                <span className="text-xs font-bold text-blue-500 dark:text-slate-400">{total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%</span>
                <span className="text-xs font-bold text-blue-900 dark:text-slate-100 w-20 text-right">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function RecentTransactions({ transactions, categories, accounts, month, onSeeAll }: { transactions: Transaction[]; categories: Category[]; accounts: BankAccount[]; month: Date; onSeeAll: () => void }) {
  const monthTxs = useMemo(() =>
    transactions
      .filter(t => {
        const d = t.date.toDate();
        return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
      })
      .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime())
      .slice(0, 8),
    [transactions, month]
  );

  return (
    <Card title="Transações Recentes" subtitle={format(month, 'MMM yyyy', { locale: ptBR })} className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" action={<Button variant="ghost" className="text-xs font-medium" onClick={onSeeAll}>Ver Tudo</Button>}>
      <div className="space-y-2">
        {monthTxs.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.AlertCircle className="w-6 h-6 text-blue-300 dark:text-slate-500" />
            </div>
            <p className="text-blue-500 dark:text-slate-400 font-medium">Nenhuma transação neste mês.</p>
          </div>
        ) : (
          monthTxs.map(t => (
            <TransactionItem key={t.id} transaction={t} category={categories.find(c => c.id === t.category)} account={accounts.find(a => a.id === t.accountId)} showDate />
          ))
        )}
      </div>
    </Card>
  );
}

function TransactionItem({ transaction, category, account, showDate = false }: { transaction: Transaction; category?: Category; account?: BankAccount; showDate?: boolean; key?: string }) {
  const Icon = category ? Icons[category.icon as IconName] : Icons.MoreHorizontal;
  
  return (
    <div className="flex items-center gap-4 group p-3.5 rounded-2xl bg-white dark:bg-slate-800/50 hover:bg-blue-50/80 dark:hover:bg-slate-800 border border-blue-100 dark:border-slate-700 shadow-sm transition-all duration-300">
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105', transaction.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600')}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-blue-800 dark:text-slate-200 truncate">{transaction.description || category?.name || 'Sem descrição'}</p>
        <div className="flex items-center gap-2 text-xs font-medium text-blue-500 dark:text-slate-400 mt-1">
          <span className="bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-md text-blue-600 dark:text-blue-400">{category?.name || 'Outros'}</span>
          {account && (
            <>
              <span className="w-1 h-1 bg-blue-300 dark:bg-slate-600 rounded-full" />
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                {transaction.paymentMethod === 'credit' ? <Icons.CreditCard className="w-3 h-3" /> : <Icons.Landmark className="w-3 h-3" />}
                {account.name}
              </span>
            </>
          )}
          {showDate && (
            <>
              <span className="w-1 h-1 bg-blue-300 rounded-full" />
              <span>{formatDate(transaction.date.toDate())}</span>
            </>
          )}
        </div>
      </div>
      <div className={cn('font-bold text-right text-lg tracking-tight', transaction.type === 'income' ? 'text-emerald-600' : 'text-blue-900 dark:text-slate-100')}>
        {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
      </div>
    </div>
  );
}

function TransactionManager({ transactions, categories, accounts, onRefresh }: { transactions: Transaction[]; categories: Category[]; accounts: BankAccount[]; onRefresh: () => Promise<void> }) {
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      const matchesFilter = filter === 'all' || t.type === filter;
      const matchesSearch = t.description?.toLowerCase().includes(search.toLowerCase()) || 
                           categories.find(c => c.id === t.category)?.name.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [transactions, categories, filter, search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;
    try {
      await transactionsApi.delete(id);
      await onRefresh();
    } catch (err) {
      console.error('Erro ao excluir transação:', err);
    }
  };

  const handleExport = () => {
    const rows = filtered.map(t => ({
      Data: formatDate(t.date.toDate()),
      Descrição: t.description || '-',
      Tipo: t.type === 'income' ? 'Receita' : 'Despesa',
      Categoria: categories.find(c => c.id === t.category)?.name || 'Outros',
      Conta: accounts.find(a => a.id === t.accountId)?.name || '-',
      'Forma de Pagamento': t.paymentMethod === 'credit' ? 'Crédito' : t.paymentMethod === 'debit' ? 'Débito' : '-',
      Valor: t.type === 'income' ? t.amount : -t.amount,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transações');
    XLSX.writeFile(wb, `transacoes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
          <Input
            placeholder="Buscar transações..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={filter === 'all' ? 'primary' : 'secondary'} onClick={() => setFilter('all')} className="px-3 py-2 text-xs">Tudo</Button>
          <Button variant={filter === 'income' ? 'primary' : 'secondary'} onClick={() => setFilter('income')} className="px-3 py-2 text-xs">Receitas</Button>
          <Button variant={filter === 'expense' ? 'primary' : 'secondary'} onClick={() => setFilter('expense')} className="px-3 py-2 text-xs">Despesas</Button>
          <Button variant="secondary" onClick={handleExport} className="px-3 py-2 text-xs flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
            <Icons.Download className="w-3.5 h-3.5" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-blue-100 dark:border-slate-700 bg-blue-50/50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Categoria / Conta</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider text-right">Valor</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100/50 dark:divide-slate-700/50">
              {filtered.map(t => {
                const account = accounts.find(a => a.id === t.accountId);
                return (
                  <tr key={t.id} className="hover:bg-blue-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 text-sm font-medium text-blue-500 dark:text-slate-400 whitespace-nowrap">{formatDate(t.date.toDate())}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-blue-800 dark:text-slate-200">{t.description || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-fit">
                          {categories.find(c => c.id === t.category)?.name || 'Outros'}
                        </span>
                        {account && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 dark:text-slate-400">
                            {t.paymentMethod === 'credit' ? <Icons.CreditCard className="w-3 h-3" /> : <Icons.Landmark className="w-3 h-3" />}
                            {account.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={cn('px-6 py-4 text-sm font-bold text-right whitespace-nowrap tracking-tight', t.type === 'income' ? 'text-emerald-600' : 'text-blue-900 dark:text-slate-100')}>
                      {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(t.id)} className="p-2 text-blue-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                        <Icons.Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-24 text-center">
            <div className="w-16 h-16 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.Search className="w-6 h-6 text-blue-300 dark:text-slate-500" />
            </div>
            <p className="text-blue-500 dark:text-slate-400 font-medium">Nenhuma transação encontrada.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function CategoryManager({ categories, userId, onRefresh }: { categories: Category[]; userId: string; onRefresh: () => Promise<void> }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', icon: 'Tag', color: '#000000', budget: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBudget, setEditBudget] = useState('');

  const handleAdd = async () => {
    if (!newCat.name) return;
    try {
      const catData: any = { name: newCat.name, icon: newCat.icon, color: newCat.color };
      if (newCat.budget && parseFloat(newCat.budget) > 0) {
        catData.budget = parseFloat(newCat.budget);
      }
      await categoriesApi.create(catData);
      setNewCat({ name: '', icon: 'Tag', color: '#000000', budget: '' });
      setIsAdding(false);
      await onRefresh();
    } catch (err) {
      console.error('Erro ao criar categoria:', err);
    }
  };

  const handleUpdateBudget = async (id: string) => {
    try {
      const val = parseFloat(editBudget);
      await categoriesApi.update(id, { budget: isNaN(val) || val <= 0 ? 0 : val });
      setEditingId(null);
      await onRefresh();
    } catch (err) {
      console.error('Erro ao atualizar categoria:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta categoria? Transações existentes não serão afetadas.')) return;
    try {
      await categoriesApi.delete(id);
      await onRefresh();
    } catch (err) {
      console.error('Erro ao excluir categoria:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(cat => {
          const Icon = Icons[cat.icon as IconName] || Icons.Tag;
          return (
            <Card key={cat.id} className="p-5 flex flex-col gap-4 group border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-semibold text-blue-800 dark:text-slate-200 block">{cat.name}</span>
                    {cat.budget && cat.budget > 0 && editingId !== cat.id && (
                      <span className="text-xs font-medium text-blue-500 dark:text-slate-400 mt-0.5 block">Meta: {formatCurrency(cat.budget)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                  <button onClick={() => { setEditingId(cat.id); setEditBudget(cat.budget?.toString() || ''); }} className="p-2 text-blue-400 hover:text-blue-900 dark:hover:text-slate-100 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <Icons.Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="p-2 text-blue-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors">
                    <Icons.Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {editingId === cat.id && (
                <div className="flex gap-2 mt-2 pt-4 border-t border-blue-100 dark:border-slate-700">
                  <Input 
                    type="number" 
                    placeholder="Meta (R$)" 
                    value={editBudget} 
                    onChange={e => setEditBudget(e.target.value)} 
                    className="h-10 text-sm flex-1"
                  />
                  <Button onClick={() => handleUpdateBudget(cat.id)} className="px-4 py-2 h-10 text-sm font-medium">Salvar</Button>
                  <Button variant="secondary" onClick={() => setEditingId(null)} className="px-3 py-2 h-10">
                    <Icons.X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
        
        {isAdding ? (
          <Card className="p-5 space-y-4 border-dashed border-2 border-blue-200 dark:border-slate-600 bg-blue-50/50 dark:bg-slate-800/50 shadow-none">
            <Input placeholder="Nome da categoria" value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} className="bg-white" />
            <Input type="number" placeholder="Meta de gastos (opcional)" value={newCat.budget} onChange={e => setNewCat({ ...newCat, budget: e.target.value })} className="bg-white" />
            <div className="flex gap-3">
              <div className="relative w-12 h-10 rounded-xl overflow-hidden border border-blue-200 shrink-0">
                <input type="color" className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer" value={newCat.color} onChange={e => setNewCat({ ...newCat, color: e.target.value })} />
              </div>
              <Button className="flex-1 h-10 font-medium" onClick={handleAdd}>Adicionar</Button>
              <Button variant="secondary" className="h-10 px-3" onClick={() => setIsAdding(false)}>
                <Icons.X className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ) : (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-blue-200 dark:border-slate-600 text-blue-400 dark:text-slate-500 hover:border-blue-400 dark:hover:border-slate-400 hover:text-blue-600 dark:hover:text-slate-300 hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-all duration-300 min-h-[100px]"
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Icons.Plus className="w-5 h-5" />
            </div>
            <span className="font-medium text-sm">Nova Categoria</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Open Finance View ──────────────────────────────────────────────────────

// Conectores sandbox pré-definidos da Pluggy
const SANDBOX_CONNECTORS = [
  { id: 0, name: 'Pluggy Bank (Sandbox)', fields: [{ name: 'user', label: 'Usuário', placeholder: 'user-ok' }, { name: 'password', label: 'Senha', placeholder: 'password-ok', type: 'password' }] },
  { id: 1, name: 'Pluggy Bank 2 (Sandbox)', fields: [{ name: 'user', label: 'Usuário', placeholder: 'user-ok' }, { name: 'password', label: 'Senha', placeholder: 'password-ok', type: 'password' }] },
];

function OpenFinanceView() {
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

// ─── Audit Log View ─────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Criação',
  UPDATE: 'Atualização',
  DELETE: 'Exclusão',
};

const ENTITY_LABELS: Record<string, string> = {
  TRANSACTION: 'Transação',
  ACCOUNT: 'Conta',
  BANK: 'Banco',
  GOAL: 'Meta',
  REMINDER: 'Lembrete',
  CATEGORY: 'Categoria',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  UPDATE: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  DELETE: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

const ENTITY_ICONS: Record<string, IconName> = {
  TRANSACTION: 'ArrowUpRight',
  ACCOUNT: 'Wallet',
  BANK: 'Landmark',
  GOAL: 'Target',
  REMINDER: 'Calendar',
  CATEGORY: 'Tag',
};

function AuditLogView() {
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    auditApi.getAll({ limit: 200 })
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => logs.filter(l =>
    (!filterEntity || l.entity === filterEntity) &&
    (!filterAction || l.action === filterAction)
  ), [logs, filterEntity, filterAction]);

  const grouped = useMemo(() => {
    const groups: Record<string, AuditLogResponse[]> = {};
    filtered.forEach(log => {
      const date = new Date(log.createdAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      (groups[date] = groups[date] || []).push(log);
    });
    return Object.entries(groups);
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterEntity}
          onChange={e => setFilterEntity(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Todas entidades</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Todas ações</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-xs text-blue-400 dark:text-slate-500 self-center font-medium">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="py-16 text-center">
          <div className="w-14 h-14 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
            <Icons.List className="w-6 h-6 text-blue-300 dark:text-slate-500" />
          </div>
          <p className="text-sm text-blue-400 dark:text-slate-500 font-medium">Nenhuma operação registrada ainda.</p>
        </div>
      )}

      {/* Timeline grouped by day */}
      <div className="space-y-8">
        {grouped.map(([date, dayLogs]) => (
          <div key={date}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-blue-100 dark:bg-slate-700" />
              <span className="text-xs font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest capitalize whitespace-nowrap">{date}</span>
              <div className="h-px flex-1 bg-blue-100 dark:bg-slate-700" />
            </div>

            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-blue-100 dark:bg-slate-700" />

              <div className="space-y-3">
                {dayLogs.map(log => {
                  const EntityIcon = Icons[ENTITY_ICONS[log.entity] ?? 'List'];
                  const isExpanded = expandedId === log.id;
                  let parsedPayload: Record<string, unknown> | null = null;
                  try { parsedPayload = log.payload ? JSON.parse(log.payload) : null; } catch {}

                  return (
                    <div key={log.id} className="flex gap-4">
                      {/* Timeline dot */}
                      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white dark:border-slate-900',
                        log.action === 'CREATE' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600' :
                        log.action === 'UPDATE' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' :
                        'bg-red-100 dark:bg-red-900/40 text-red-600'
                      )}>
                        <EntityIcon className="w-4 h-4" />
                      </div>

                      {/* Card */}
                      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 overflow-hidden mb-1">
                        <div
                          className={cn('flex items-center justify-between px-4 py-3', parsedPayload && 'cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800/50')}
                          onClick={() => parsedPayload && setExpandedId(isExpanded ? null : log.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', ACTION_COLORS[log.action])}>
                              {ACTION_LABELS[log.action]}
                            </span>
                            <span className="text-sm font-semibold text-blue-900 dark:text-slate-100 truncate">
                              {ENTITY_LABELS[log.entity]}
                            </span>
                            {log.entityId && (
                              <span className="text-[10px] text-blue-400 dark:text-slate-500 font-mono truncate hidden sm:block">
                                #{log.entityId.slice(-8)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-blue-400 dark:text-slate-500 font-medium">
                              {new Date(log.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {parsedPayload && (
                              <Icons.ChevronDown className={cn('w-3.5 h-3.5 text-blue-400 transition-transform', isExpanded && 'rotate-180')} />
                            )}
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && parsedPayload && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-1 border-t border-blue-50 dark:border-slate-700/50 space-y-1.5">
                                <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-2">Dados enviados</p>
                                {Object.entries(parsedPayload).map(([k, v]) => (
                                  <div key={k} className="flex items-start gap-2 text-xs">
                                    <span className="font-semibold text-blue-500 dark:text-slate-400 min-w-[100px] shrink-0">{k}</span>
                                    <span className="text-blue-800 dark:text-slate-200 break-all">{String(v)}</span>
                                  </div>
                                ))}
                                {log.ip && (
                                  <div className="flex items-center gap-2 text-xs pt-1 border-t border-blue-50 dark:border-slate-700/50 mt-2">
                                    <span className="font-semibold text-blue-400 dark:text-slate-500">IP</span>
                                    <span className="text-blue-500 dark:text-slate-400 font-mono">{log.ip}</span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Calendar View ──────────────────────────────────────────────────────────

function CalendarView({ reminders, transactions, categories, accounts }: { reminders: Reminder[]; transactions: Transaction[]; categories: Category[]; accounts: BankAccount[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filter, setFilter] = useState<'all' | 'expense' | 'income' | 'reminder' | 'card'>('all');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Credit cards with closing/due days
  const creditCards = useMemo(
    () => accounts.filter(a => a.type === 'credit' && (a.closingDay || a.dueDay)),
    [accounts]
  );

  const getCardEvents = (day: Date) => {
    if (!isSameMonth(day, monthStart)) return [];
    const d = parseInt(format(day, 'd'));
    const events: { cardName: string; color: string; kind: 'closing' | 'due' }[] = [];
    creditCards.forEach(acc => {
      if (acc.closingDay === d) events.push({ cardName: acc.name, color: acc.color, kind: 'closing' });
      if (acc.dueDay === d) events.push({ cardName: acc.name, color: acc.color, kind: 'due' });
    });
    return events;
  };

  const getDayData = (day: Date) => {
    const dayReminders = reminders.filter(r => isSameDay(r.dueDate.toDate(), day));
    const dayTransactions = transactions.filter(t => isSameDay(t.date.toDate(), day));
    const cardEvents = getCardEvents(day);

    let filteredReminders = dayReminders;
    let filteredTransactions = dayTransactions;
    let filteredCardEvents = cardEvents;

    if (filter === 'expense') {
      filteredReminders = dayReminders.filter(r => r.type === 'expense');
      filteredTransactions = dayTransactions.filter(t => t.type === 'expense');
      filteredCardEvents = [];
    } else if (filter === 'income') {
      filteredReminders = dayReminders.filter(r => r.type === 'income');
      filteredTransactions = dayTransactions.filter(t => t.type === 'income');
      filteredCardEvents = [];
    } else if (filter === 'reminder') {
      filteredTransactions = [];
      filteredCardEvents = [];
    } else if (filter === 'card') {
      filteredReminders = [];
      filteredTransactions = [];
    }

    const totalExpense = [...filteredReminders.filter(r => r.type === 'expense'), ...filteredTransactions.filter(t => t.type === 'expense')]
      .reduce((sum, item) => sum + item.amount, 0);
    const totalIncome = [...filteredReminders.filter(r => r.type === 'income'), ...filteredTransactions.filter(t => t.type === 'income')]
      .reduce((sum, item) => sum + item.amount, 0);

    return { reminders: filteredReminders, transactions: filteredTransactions, cardEvents: filteredCardEvents, totalExpense, totalIncome, isCritical: totalExpense > 500 };
  };

  // Build a list of upcoming card events this month for the summary panel
  const upcomingCardEvents = useMemo(() => {
    const today = new Date();
    return days
      .filter(d => isSameMonth(d, monthStart))
      .flatMap(d => getCardEvents(d).map(ev => ({ ...ev, date: d })))
      .filter(ev => ev.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [days, creditCards, monthStart]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-blue-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Icons.ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-xl font-bold text-blue-900 dark:text-slate-100 capitalize min-w-[150px] text-center">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-blue-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Icons.ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex p-1 bg-blue-100 dark:bg-slate-800 rounded-2xl w-full sm:w-auto overflow-x-auto">
          {(['all', 'expense', 'income', 'reminder', 'card'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all', filter === f ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-slate-100 shadow-sm' : 'text-blue-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-slate-200')}
            >
              {f === 'all' && 'Tudo'}
              {f === 'expense' && 'Despesas'}
              {f === 'income' && 'Receitas'}
              {f === 'reminder' && 'Lembretes'}
              {f === 'card' && '💳 Cartões'}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      {creditCards.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-orange-400" />
            <span className="text-xs font-medium text-blue-500 dark:text-slate-400">Fechamento da fatura</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span className="text-xs font-medium text-blue-500 dark:text-slate-400">Vencimento da fatura</span>
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-blue-200/60 dark:border-slate-700/60 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-blue-100 dark:border-slate-700 bg-blue-50/50 dark:bg-slate-800/50">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="py-3 text-center text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const data = getDayData(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const hasClosing = data.cardEvents.some(e => e.kind === 'closing');
            const hasDue = data.cardEvents.some(e => e.kind === 'due');
            const hasEvents = data.cardEvents.length > 0 || data.reminders.length > 0 || data.transactions.length > 0;
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;

            return (
              <div
                key={day.toString()}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={cn(
                  "min-h-[100px] sm:min-h-[120px] p-2 border-r border-b border-blue-100 dark:border-slate-700/50 last:border-r-0 transition-all relative",
                  !isCurrentMonth && "bg-blue-50/30 dark:bg-slate-800/30",
                  isToday(day) && "bg-blue-900/[0.02] dark:bg-blue-500/5",
                  hasDue && isCurrentMonth && "ring-1 ring-inset ring-red-200 dark:ring-red-900/40",
                  hasClosing && isCurrentMonth && !hasDue && "ring-1 ring-inset ring-orange-200 dark:ring-orange-900/40",
                  isSelected && "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-400 dark:ring-blue-500",
                  hasEvents && isCurrentMonth && "cursor-pointer hover:bg-blue-50/60 dark:hover:bg-slate-800/60",
                  !hasEvents && "cursor-default"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                    isSelected ? "bg-blue-600 text-white" :
                    isToday(day) ? "bg-blue-900 dark:bg-blue-500 text-white" :
                    isCurrentMonth ? "text-blue-900 dark:text-slate-200" : "text-blue-300 dark:text-slate-600"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {data.isCritical && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                </div>

                <div className="space-y-0.5">
                  {data.cardEvents.map((ev, idx) => (
                    <div key={idx} className={cn('text-[8px] font-bold px-1 py-0.5 rounded truncate flex items-center gap-0.5', ev.kind === 'closing' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300')}>
                      <Icons.CreditCard className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{ev.cardName}</span>
                    </div>
                  ))}
                  {data.totalIncome > 0 && (
                    <div className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-md truncate">
                      + {formatCurrency(data.totalIncome)}
                    </div>
                  )}
                  {data.totalExpense > 0 && (
                    <div className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md truncate", data.isCritical ? "bg-red-50 text-red-600" : "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400")}>
                      - {formatCurrency(data.totalExpense)}
                    </div>
                  )}
                  {data.reminders.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {data.reminders.map(r => (
                        <div key={r.id} className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day detail modal */}
      <AnimatePresence>
        {selectedDay && (() => {
          const allCardEvents = getCardEvents(selectedDay);
          const allReminders = reminders.filter(r => isSameDay(r.dueDate.toDate(), selectedDay));
          const allTransactions = transactions.filter(t => isSameDay(t.date.toDate(), selectedDay));
          const totalIncome = allTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
          const totalExpense = allTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
          const isEmpty = allCardEvents.length === 0 && allReminders.length === 0 && allTransactions.length === 0;

          return (
            <motion.div
              key="day-detail-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
              onClick={() => setSelectedDay(null)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

              {/* Modal */}
              <motion.div
                key="day-detail-modal"
                initial={{ opacity: 0, y: 40, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.97 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-blue-200/60 dark:border-slate-700/60 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                {/* Drag handle (mobile) */}
                <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
                  <div className="w-10 h-1 rounded-full bg-blue-200 dark:bg-slate-700" />
                </div>

                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 dark:border-slate-700/50 bg-blue-50/50 dark:bg-slate-800/50 shrink-0">
                  <div>
                    <h3 className="text-base font-bold text-blue-900 dark:text-slate-100 capitalize">
                      {format(selectedDay, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </h3>
                    {!isEmpty && (
                      <p className="text-xs text-blue-500 dark:text-slate-400 font-medium mt-0.5">
                        {[allCardEvents.length > 0 && `${allCardEvents.length} evento${allCardEvents.length > 1 ? 's' : ''} de cartão`, allReminders.length > 0 && `${allReminders.length} lembrete${allReminders.length > 1 ? 's' : ''}`, allTransactions.length > 0 && `${allTransactions.length} transaç${allTransactions.length > 1 ? 'ões' : 'ão'}`].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setSelectedDay(null)} className="p-2 rounded-xl text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-800 transition-colors">
                    <Icons.X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable content */}
                <div className="p-6 space-y-6 overflow-y-auto">
                  {isEmpty && (
                    <div className="py-8 text-center">
                      <div className="w-12 h-12 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Icons.Calendar className="w-5 h-5 text-blue-300 dark:text-slate-500" />
                      </div>
                      <p className="text-sm text-blue-400 dark:text-slate-500 font-medium">Nenhum evento neste dia.</p>
                    </div>
                  )}

                  {/* Card events */}
                  {allCardEvents.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-3">Cartões de Crédito</p>
                      <div className="space-y-2">
                        {allCardEvents.map((ev, idx) => {
                          const card = accounts.find(a => a.type === 'credit' && a.name === ev.cardName);
                          const used = card ? Math.max(0, card.balance) : 0;
                          const available = card?.creditLimit ? Math.max(0, card.creditLimit - used) : null;

                          return (
                            <div key={idx} className={cn('p-4 rounded-2xl border', ev.kind === 'closing' ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-900/40' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/40')}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', ev.kind === 'closing' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600')}>
                                    <Icons.CreditCard className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-blue-900 dark:text-slate-100 text-sm">{ev.cardName}</p>
                                    <p className={cn('text-xs font-semibold', ev.kind === 'closing' ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400')}>
                                      {ev.kind === 'closing' ? '📅 Fechamento da fatura' : '⚠️ Vencimento — data de pagamento'}
                                    </p>
                                  </div>
                                </div>
                                {card?.creditLimit && (
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-bold text-blue-900 dark:text-slate-100">{formatCurrency(used)}</p>
                                    <p className="text-[10px] text-blue-400 dark:text-slate-500 font-medium">de {formatCurrency(card.creditLimit)}</p>
                                  </div>
                                )}
                              </div>
                              {card?.creditLimit && (
                                <div className="mt-3 space-y-1.5">
                                  <div className="h-1.5 bg-white/60 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className={cn('h-full rounded-full', used / card.creditLimit > 0.8 ? 'bg-red-500' : used / card.creditLimit > 0.5 ? 'bg-amber-500' : 'bg-emerald-500')}
                                      style={{ width: `${Math.min((used / card.creditLimit) * 100, 100)}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-[10px] font-semibold">
                                    <span className="text-blue-400 dark:text-slate-500">{((used / card.creditLimit) * 100).toFixed(0)}% utilizado</span>
                                    {available !== null && <span className="text-emerald-600">Disponível: {formatCurrency(available)}</span>}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Reminders */}
                  {allReminders.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-3">Lembretes</p>
                      <div className="space-y-2">
                        {allReminders.map(r => {
                          const cat = categories.find(c => c.id === r.category);
                          const CatIcon = cat ? Icons[cat.icon as IconName] || Icons.MoreHorizontal : Icons.MoreHorizontal;
                          return (
                            <div key={r.id} className="flex items-center gap-3 p-3.5 rounded-2xl border border-blue-100 dark:border-slate-700 bg-blue-50/30 dark:bg-slate-800/30">
                              <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', r.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-500')} style={cat ? { backgroundColor: `${cat.color}20`, color: cat.color } : {}}>
                                <CatIcon className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-blue-900 dark:text-slate-100 text-sm truncate">{r.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {cat && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>{cat.name}</span>}
                                  <span className="text-[10px] text-blue-400 dark:text-slate-500 font-medium capitalize">{r.frequency}</span>
                                </div>
                                {r.notes && <p className="text-xs text-blue-400 dark:text-slate-500 mt-1 truncate">{r.notes}</p>}
                              </div>
                              <p className={cn('font-bold text-sm shrink-0', r.type === 'income' ? 'text-emerald-600' : 'text-red-600')}>
                                {r.type === 'income' ? '+' : '−'}{formatCurrency(r.amount)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Transactions */}
                  {allTransactions.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest">Transações</p>
                        <div className="flex items-center gap-3 text-xs font-semibold">
                          {totalIncome > 0 && <span className="text-emerald-600">+{formatCurrency(totalIncome)}</span>}
                          {totalExpense > 0 && <span className="text-red-500">−{formatCurrency(totalExpense)}</span>}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {allTransactions.map(t => {
                          const cat = categories.find(c => c.id === t.category);
                          const acc = accounts.find(a => a.id === t.accountId);
                          const CatIcon = cat ? Icons[cat.icon as IconName] || Icons.MoreHorizontal : Icons.MoreHorizontal;
                          return (
                            <div key={t.id} className="flex items-center gap-3 p-3.5 rounded-2xl border border-blue-100 dark:border-slate-700 bg-blue-50/30 dark:bg-slate-800/30">
                              <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', t.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-500')} style={cat ? { backgroundColor: `${cat.color}20`, color: cat.color } : {}}>
                                <CatIcon className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-blue-900 dark:text-slate-100 text-sm truncate">{t.description || cat?.name || 'Sem descrição'}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {cat && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>{cat.name}</span>}
                                  {acc && (
                                    <span className="text-[10px] text-blue-400 dark:text-slate-500 font-medium flex items-center gap-0.5">
                                      {t.paymentMethod === 'credit' ? <Icons.CreditCard className="w-3 h-3" /> : <Icons.Landmark className="w-3 h-3" />}
                                      {acc.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className={cn('font-bold text-sm shrink-0', t.type === 'income' ? 'text-emerald-600' : 'text-blue-900 dark:text-slate-100')}>
                                {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm">
          <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Receitas</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(days.reduce((sum, day) => sum + getDayData(day).totalIncome, 0))}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm">
          <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Despesas</p>
          <p className="text-xl font-bold text-blue-900 dark:text-slate-100">{formatCurrency(days.reduce((sum, day) => sum + getDayData(day).totalExpense, 0))}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm">
          <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-1">Saldo do Período</p>
          <p className="text-xl font-bold text-blue-900 dark:text-slate-100">{formatCurrency(days.reduce((sum, day) => sum + (getDayData(day).totalIncome - getDayData(day).totalExpense), 0))}</p>
        </div>
      </div>

      {/* Upcoming card events this month */}
      {upcomingCardEvents.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm p-5">
          <h4 className="text-sm font-bold text-blue-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Icons.CreditCard className="w-4 h-4 text-blue-400" />
            Próximos eventos de cartão — {format(currentDate, 'MMMM', { locale: ptBR })}
          </h4>
          <div className="space-y-2">
            {upcomingCardEvents.map((ev, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 dark:bg-slate-800/50 border border-blue-100/50 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold', ev.kind === 'closing' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600')}>
                    {format(ev.date, 'd')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-slate-100">{ev.cardName}</p>
                    <p className={cn('text-xs font-medium', ev.kind === 'closing' ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400')}>
                      {ev.kind === 'closing' ? 'Fechamento da fatura' : 'Vencimento — data de pagamento'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-400 dark:text-slate-500 uppercase tracking-wider">
                  {format(ev.date, "dd MMM", { locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanosView() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const STRIPE_PRICE_PRO = import.meta.env.VITE_STRIPE_PRICE_PRO ?? '';
  const STRIPE_PRICE_FAMILY = import.meta.env.VITE_STRIPE_PRICE_FAMILY ?? '';

  useEffect(() => {
    subscriptionApi.getStatus().then(setStatus).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleCheckout = async (priceId: string) => {
    if (!priceId) return alert('Stripe price ID não configurado.');
    setCheckoutLoading(priceId);
    try {
      const { url } = await subscriptionApi.checkout(priceId);
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    try {
      const { url } = await subscriptionApi.portal();
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
    }
  };

  const plans = [
    {
      id: 'FREE',
      name: 'Gratuito',
      price: 'R$ 0',
      period: '',
      color: 'from-slate-500 to-slate-600',
      priceId: '',
      features: [
        '50 transações por mês',
        '2 contas',
        '2 metas',
        'Dashboard básico',
        'Categorias',
      ],
      missing: ['IA financeira', 'Open Finance', 'Exportar Excel', 'Relatórios avançados'],
    },
    {
      id: 'PRO',
      name: 'Pro',
      price: 'R$ 19',
      period: '/mês',
      color: 'from-blue-600 to-blue-700',
      priceId: STRIPE_PRICE_PRO,
      badge: 'Mais popular',
      features: [
        'Transações ilimitadas',
        'Contas ilimitadas',
        'Metas ilimitadas',
        'IA financeira (insights)',
        'Open Finance Brasil',
        'Exportar Excel',
        'Suporte prioritário',
      ],
      missing: [],
    },
    {
      id: 'FAMILY',
      name: 'Família',
      price: 'R$ 39',
      period: '/mês',
      color: 'from-violet-600 to-violet-700',
      priceId: STRIPE_PRICE_FAMILY,
      features: [
        'Tudo do Pro',
        'Até 5 usuários',
        'Dashboard familiar',
        'Metas compartilhadas',
        'Suporte VIP',
      ],
      missing: [],
    },
  ];

  if (loading) {
    return <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  }

  const currentPlan = status?.plan ?? 'FREE';
  const isTrialActive = status?.trialActive;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Status atual */}
      {status?.subscription && (
        <Card className="p-5 border-none shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-blue-500 dark:text-slate-400">Assinatura ativa</p>
              <p className="font-semibold text-blue-900 dark:text-slate-100">
                Plano <span className="text-blue-600">{currentPlan}</span>
                {status.subscription.cancelAtPeriodEnd && <span className="ml-2 text-xs text-amber-500">(cancela em {new Date(status.subscription.currentPeriodEnd).toLocaleDateString('pt-BR')})</span>}
              </p>
            </div>
            <Button variant="secondary" onClick={handlePortal} className="text-sm">
              Gerenciar assinatura
            </Button>
          </div>
        </Card>
      )}

      {isTrialActive && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center gap-2">
          <Icons.Sparkles className="w-4 h-4 shrink-0" />
          Trial PRO ativo até {new Date(status!.trialEndsAt!).toLocaleDateString('pt-BR')} — aproveite todas as funcionalidades!
        </div>
      )}

      {/* Cards dos planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {plans.map(plan => {
          const isCurrent = currentPlan === plan.id;
          const isUpgrade = plan.id !== 'FREE' && !isCurrent;

          return (
            <div
              key={plan.id}
              className={cn(
                'rounded-3xl overflow-hidden shadow-sm border transition-all duration-300',
                isCurrent
                  ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/30'
                  : 'border-blue-100 dark:border-slate-700 hover:shadow-md',
              )}
            >
              {/* Header */}
              <div className={`bg-gradient-to-br ${plan.color} p-6 text-white relative`}>
                {plan.badge && (
                  <span className="absolute top-4 right-4 text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                    {plan.badge}
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute top-4 right-4 text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                    Plano atual
                  </span>
                )}
                <p className="text-white/70 text-sm font-medium mb-1">{plan.name}</p>
                <p className="text-4xl font-bold tracking-tight">
                  {plan.price}<span className="text-lg font-normal text-white/70">{plan.period}</span>
                </p>
              </div>

              {/* Features */}
              <div className="p-6 bg-white dark:bg-slate-900 space-y-3">
                {plan.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-blue-800 dark:text-slate-200">
                    <Icons.Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    {f}
                  </div>
                ))}
                {plan.missing.map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-blue-300 dark:text-slate-600 line-through">
                    <Icons.X className="w-4 h-4 shrink-0" />
                    {f}
                  </div>
                ))}

                <div className="pt-4">
                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-full text-center text-sm font-medium bg-blue-50 dark:bg-slate-800 text-blue-500 dark:text-slate-400">
                      Plano atual
                    </div>
                  ) : isUpgrade ? (
                    <Button
                      variant="primary"
                      className="w-full"
                      disabled={checkoutLoading === plan.priceId}
                      onClick={() => handleCheckout(plan.priceId)}
                    >
                      {checkoutLoading === plan.priceId ? 'Aguarde...' : `Assinar ${plan.name}`}
                    </Button>
                  ) : (
                    <div className="w-full py-2.5 rounded-full text-center text-sm font-medium bg-slate-50 dark:bg-slate-800 text-slate-400">
                      Gratuito para sempre
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-blue-400 dark:text-slate-500 text-center">
        Pagamento seguro via Stripe. Cancele a qualquer momento.
      </p>
    </div>
  );
}

function InvestmentsView({ accounts, transactions }: { accounts: BankAccount[]; transactions: Transaction[] }) {
  const investmentAccounts = useMemo(() => accounts.filter(a => a.type === 'investment'), [accounts]);
  
  const totalInvested = useMemo(() => {
    return investmentAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  }, [investmentAccounts]);

  const allocation = useMemo(() => {
    const types: Record<string, number> = {};
    investmentAccounts.forEach(acc => {
      const type = acc.investmentType || 'other';
      types[type] = (types[type] || 0) + acc.balance;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [investmentAccounts]);

  const typeLabels: Record<string, string> = {
    cdb: 'CDB / Renda Fixa',
    stock: 'Ações',
    fund: 'Fundos',
    fii: 'FIIs',
    other: 'Outros'
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <Card className="p-6 bg-blue-900 text-white border-none shadow-xl h-fit">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Patrimônio Investido</p>
          <h3 className="text-3xl font-bold tracking-tight">{formatCurrency(totalInvested)}</h3>
          <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <Icons.TrendingUp className="w-4 h-4" />
            <span>Crescimento constante</span>
          </div>
        </Card>

        <Card className="p-6 md:col-span-2 bg-white dark:bg-slate-900 border-none shadow-sm">
          <div className="flex flex-row items-center gap-6">
            <div className="shrink-0 w-[200px] h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {allocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              <h4 className="text-sm font-bold text-blue-900 dark:text-slate-100 mb-4">Alocação de Ativos</h4>
              {allocation.length > 0 ? allocation.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">{typeLabels[item.name]}</span>
                  </div>
                  <span className="text-sm font-bold text-blue-900 dark:text-slate-100">
                    {totalInvested > 0 ? ((item.value / totalInvested) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              )) : (
                <p className="text-sm text-blue-500 dark:text-slate-400 italic">Nenhum investimento cadastrado.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {investmentAccounts.length === 0 ? (
        <p className="text-sm text-blue-500 dark:text-slate-400 italic text-center py-4">Nenhuma conta de investimento cadastrada.</p>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {investmentAccounts.map(acc => {
          const currentBalance = acc.balance;

          return (
            <Card key={acc.id} className="p-5 border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: acc.color }} />
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${acc.color}15`, color: acc.color }}>
                    <Icons.TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-slate-100">{acc.name}</h3>
                    <p className="text-xs text-blue-500 dark:text-slate-400 font-medium">{typeLabels[acc.investmentType || 'other']}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-blue-100/50 dark:border-slate-700/50">
                <p className="text-sm text-blue-500 dark:text-slate-400 mb-1">Valor Atual</p>
                <p className="text-2xl font-bold tracking-tight text-blue-800 dark:text-slate-100">{formatCurrency(currentBalance)}</p>
              </div>
            </Card>
          );
        })}
      </div>
      )}
    </div>
  );
}

const EMPTY_ACC = {
  name: '', type: 'checking' as BankAccount['type'],
  investmentType: 'cdb' as BankAccount['investmentType'],
  balance: '', creditLimit: '', closingDay: '', dueDay: '',
  color: '#3b82f6', icon: 'CreditCard',
};

const BANK_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4','#6366f1'];
const BANK_ICONS: IconName[] = ['Landmark','Building2','Wallet','CreditCard','PiggyBank','Banknote','TrendingUp','Briefcase'];

function AccountManager({ banks, accounts, transactions, onRefresh }: { banks: Bank[]; accounts: BankAccount[]; transactions: Transaction[]; userId: string; onRefresh: () => Promise<void> }) {
  const [isAddingBank, setIsAddingBank] = useState(false);
  const [newBank, setNewBank] = useState({ name: '', color: '#3b82f6', icon: 'Landmark' as IconName });
  const [addingAccTo, setAddingAccTo] = useState<string | null>(null);
  const [newAcc, setNewAcc] = useState({ ...EMPTY_ACC });
  const [accError, setAccError] = useState('');

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

  const handleDeleteAccount = async (id: string) => {
    try {
      await accountsApi.delete(id);
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

      {/* Bank cards */}
      <div className="space-y-4">
        {banks.map(bank => {
          const bankAccounts = accounts.filter(a => a.bankId === bank.id);
          const BankIcon = Icons[bank.icon as IconName] || Icons.Landmark;
          const totalBalance = bankAccounts
            .filter(a => a.type !== 'credit')
            .reduce((s, a) => s + a.balance, 0);

          return (
            <Card key={bank.id} className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden group">
              {/* Bank header */}
              <div className="flex items-center justify-between pb-4 mb-2 border-b border-blue-50 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${bank.color}20`, color: bank.color }}>
                    <BankIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-900 dark:text-slate-100">{bank.name}</h3>
                    <p className="text-xs text-blue-500 dark:text-slate-400">{bankAccounts.length} {bankAccounts.length === 1 ? 'conta' : 'contas'} · Saldo total: <span className="font-semibold text-emerald-600">{formatCurrency(totalBalance)}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => editingBankId === bank.id ? setEditingBankId(null) : startEditBank(bank)}
                    className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                    title="Editar banco"
                  >
                    <Icons.Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteBank(bank.id)}
                    className="p-2 text-blue-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                    title="Remover banco"
                  >
                    <Icons.Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Inline edit bank form */}
              {editingBankId === bank.id && (
                <div className="mb-4 p-4 rounded-xl bg-blue-50/50 dark:bg-slate-800/50 border border-blue-100 dark:border-slate-700 space-y-4">
                  <h4 className="text-sm font-bold text-blue-900 dark:text-slate-100">Editar Banco</h4>
                  <Input label="Nome" value={editBankForm.name} onChange={e => setEditBankForm({ ...editBankForm, name: e.target.value })} />
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-blue-900/70 dark:text-slate-400">Ícone</label>
                    <div className="flex flex-wrap gap-2">
                      {BANK_ICONS.map(icon => {
                        const Ic = Icons[icon];
                        return Ic ? (
                          <button key={icon} onClick={() => setEditBankForm({ ...editBankForm, icon })} className={cn('w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all', editBankForm.icon === icon ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'border-blue-100 dark:border-slate-700 text-blue-400 dark:text-slate-500 hover:border-blue-300 dark:hover:border-slate-500')}>
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
                        <button key={c} onClick={() => setEditBankForm({ ...editBankForm, color: c })} className={cn('w-8 h-8 rounded-full border-4 transition-transform hover:scale-110', editBankForm.color === c ? 'border-blue-900 dark:border-white scale-110' : 'border-transparent')} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => setEditingBankId(null)}>Cancelar</Button>
                    <Button className="flex-1" onClick={() => handleSaveBank(bank.id)}><Icons.Check className="w-4 h-4" /> Salvar</Button>
                  </div>
                </div>
              )}

              {/* Accounts list */}
              <div className="space-y-2">
                {bankAccounts.map(acc => {
                  const Icon = Icons[acc.icon as IconName] || Icons.CreditCard;
                  const currentBalance = acc.balance;

                  return (
                    <div key={acc.id} className="rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between p-3 bg-blue-50/40 dark:bg-slate-800/40 group/acc hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${bank.color}15`, color: bank.color }}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-blue-900 dark:text-slate-100">{acc.name}</p>
                            <p className="text-xs text-blue-400 dark:text-slate-500">{typeLabels[acc.type]}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            {acc.type === 'credit' ? (
                              <>
                                <p className="text-sm font-bold text-blue-800 dark:text-slate-100">{formatCurrency(Math.abs(currentBalance))}</p>
                                {acc.creditLimit && <p className="text-[10px] text-blue-400 dark:text-slate-500">Limite: {formatCurrency(acc.creditLimit)}</p>}
                                {(acc.closingDay || acc.dueDay) && (
                                  <p className="text-[10px] text-blue-400 dark:text-slate-500">
                                    {acc.closingDay && `Fecha dia ${acc.closingDay}`}{acc.closingDay && acc.dueDay && ' · '}{acc.dueDay && `Vence dia ${acc.dueDay}`}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-sm font-bold text-blue-900 dark:text-slate-100">{formatCurrency(currentBalance)}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover/acc:opacity-100 transition-all">
                            <button
                              onClick={() => editingAccId === acc.id ? setEditingAccId(null) : startEditAcc(acc)}
                              className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                              title="Editar"
                            >
                              <Icons.Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(acc.id)}
                              className="p-1.5 text-blue-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                              title="Excluir"
                            >
                              <Icons.Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Inline edit account form */}
                      {editingAccId === acc.id && (
                        <div className="p-4 bg-blue-50/30 dark:bg-slate-800/30 border-t border-blue-100 dark:border-slate-700 space-y-4">
                          <h4 className="text-sm font-bold text-blue-900 dark:text-slate-100">Editar {typeLabels[acc.type]}</h4>
                          <Input
                            label="Nome"
                            value={editAccForm.name}
                            onChange={e => { setEditAccForm({ ...editAccForm, name: e.target.value }); setEditAccError(''); }}
                            error={!editAccForm.name.trim() && editAccError ? editAccError : undefined}
                          />
                          <RadioGroup
                            label="Tipo"
                            value={editAccForm.type}
                            onChange={val => setEditAccForm({ ...editAccForm, type: val as BankAccount['type'] })}
                            options={[
                              { value: 'checking', label: 'Corrente' },
                              { value: 'savings', label: 'Poupança' },
                              { value: 'investment', label: 'Investimentos' },
                              { value: 'credit', label: 'Cartão' },
                            ]}
                          />
                          <Input
                            label={editAccForm.type === 'credit' ? 'Fatura atual' : 'Saldo'}
                            inputMode="decimal"
                            placeholder="0,00"
                            value={editAccForm.balance}
                            onChange={e => setEditAccForm({ ...editAccForm, balance: e.target.value.replace(',', '.') })}
                          />
                          {editAccForm.type === 'investment' && (
                            <Select
                              label="Tipo de Investimento"
                              value={editAccForm.investmentType}
                              onChange={e => setEditAccForm({ ...editAccForm, investmentType: e.target.value as BankAccount['investmentType'] })}
                              options={[
                                { value: 'cdb', label: 'CDB / Renda Fixa' },
                                { value: 'stock', label: 'Ações' },
                                { value: 'fund', label: 'Fundos' },
                                { value: 'fii', label: 'FIIs' },
                                { value: 'other', label: 'Outros' },
                              ]}
                            />
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
                          {editAccError && editAccForm.name.trim() && (
                            <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                              <Icons.AlertCircle className="w-3.5 h-3.5" /> {editAccError}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <Button variant="secondary" className="flex-1" onClick={() => setEditingAccId(null)}>Cancelar</Button>
                            <Button className="flex-1" onClick={() => handleSaveAccount(acc.id)}><Icons.Check className="w-4 h-4" /> Salvar</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add account form or button */}
                {addingAccTo === bank.id ? (
                  <div className="mt-4 pt-4 border-t border-blue-100/50 dark:border-slate-700/50 space-y-4">
                    <h4 className="text-sm font-bold text-blue-900 dark:text-slate-100">Nova conta / cartão</h4>
                    <Input
                      label="Nome"
                      placeholder="Ex: Conta Corrente, Roxinho..."
                      value={newAcc.name}
                      onChange={e => { setNewAcc({ ...newAcc, name: e.target.value }); setAccError(''); }}
                      error={!newAcc.name.trim() && accError ? accError : undefined}
                    />
                    <RadioGroup
                      label="Tipo"
                      value={newAcc.type}
                      onChange={val => setNewAcc({ ...newAcc, type: val as BankAccount['type'] })}
                      options={[
                        { value: 'checking', label: 'Corrente' },
                        { value: 'savings', label: 'Poupança' },
                        { value: 'investment', label: 'Investimentos' },
                        { value: 'credit', label: 'Cartão' },
                      ]}
                    />
                    <Input
                      label={newAcc.type === 'credit' ? 'Fatura atual' : 'Saldo inicial'}
                      inputMode="decimal"
                      placeholder="0,00"
                      value={newAcc.balance}
                      onChange={e => setNewAcc({ ...newAcc, balance: e.target.value.replace(',', '.') })}
                    />
                    {newAcc.type === 'investment' && (
                      <Select
                        label="Tipo de Investimento"
                        value={newAcc.investmentType}
                        onChange={e => setNewAcc({ ...newAcc, investmentType: e.target.value as BankAccount['investmentType'] })}
                        options={[
                          { value: 'cdb', label: 'CDB / Renda Fixa' },
                          { value: 'stock', label: 'Ações' },
                          { value: 'fund', label: 'Fundos' },
                          { value: 'fii', label: 'FIIs' },
                          { value: 'other', label: 'Outros' },
                        ]}
                      />
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
                      <Button variant="secondary" className="flex-1" onClick={() => { setAddingAccTo(null); setNewAcc({ ...EMPTY_ACC }); setAccError(''); }}>
                        Cancelar
                      </Button>
                      <Button className="flex-1" style={{ backgroundColor: bank.color }} onClick={() => handleAddAccount(bank.id)}>
                        <Icons.Plus className="w-4 h-4" /> Adicionar
                      </Button>
                    </div>
                    {accError && newAcc.name.trim() && (
                      <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                        <Icons.AlertCircle className="w-3.5 h-3.5" /> {accError}
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingAccTo(bank.id); setNewAcc({ ...EMPTY_ACC }); }}
                    className="w-full flex items-center gap-2 p-3 rounded-xl border border-dashed border-blue-200 dark:border-slate-600 text-blue-400 dark:text-slate-500 hover:border-blue-400 dark:hover:border-slate-400 hover:text-blue-600 dark:hover:text-slate-300 hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-all text-sm font-medium"
                    style={{ borderColor: `${bank.color}50` }}
                  >
                    <Icons.Plus className="w-4 h-4" style={{ color: bank.color }} />
                    <span style={{ color: bank.color }}>Adicionar conta ou cartão</span>
                  </button>
                )}
              </div>
            </Card>
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

function TransferenciaModal({ accounts, prefillToId, prefillAmount, onClose, onRefresh }: {
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
        transactionsApi.create({ type: 'expense', amount: amt, accountId: fromId, date, description: desc, paymentMethod: 'debit' }),
        transactionsApi.create({ type: 'income', amount: amt, accountId: toId, date, description: isBill ? `Pagamento fatura recebido` : desc }),
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

function UpcomingReminders({ reminders, categories, accounts, userId, onRefresh }: { reminders: Reminder[]; categories: Category[]; accounts: BankAccount[]; userId: string; onRefresh: () => Promise<void> }) {
  const upcoming = useMemo(() => {
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    return reminders.filter(r => r.dueDate.toDate() <= nextWeek).slice(0, 3);
  }, [reminders]);

  if (upcoming.length === 0) return null;

  return (
    <Card title="Próximos Vencimentos" subtitle="Lembretes para os próximos 7 dias" className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="space-y-2">
        {upcoming.map(r => (
          <ReminderItem key={r.id} reminder={r} category={categories.find(c => c.id === r.category)} accounts={accounts} userId={userId} onRefresh={onRefresh} />
        ))}
      </div>
    </Card>
  );
}

function ReminderManager({ reminders, categories, accounts, userId, onRefresh }: { reminders: Reminder[]; categories: Category[]; accounts: BankAccount[]; userId: string; onRefresh: () => Promise<void> }) {
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setIsAdding(true)}>
          <Icons.Plus className="w-5 h-5" />
          Novo Lembrete
        </Button>
      </div>

      <Card className="p-0 overflow-hidden border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-blue-100 dark:border-slate-700 bg-blue-50/50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Vencimento</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Título</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Frequência</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider text-right">Valor</th>
                <th className="px-6 py-4 text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100/50 dark:divide-slate-700/50">
              {reminders.map(r => (
                <tr key={r.id} className="hover:bg-blue-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4 text-sm font-medium text-blue-500 dark:text-slate-400 whitespace-nowrap">{formatDate(r.dueDate.toDate())}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-blue-800 dark:text-slate-200">{r.title}</td>
                  <td className="px-6 py-4 text-sm font-medium text-blue-500 dark:text-slate-400 capitalize">
                    {r.frequency === 'once' ? 'Única' :
                     r.frequency === 'daily' ? 'Diária' :
                     r.frequency === 'weekly' ? 'Semanal' :
                     r.frequency === 'monthly' ? 'Mensal' : 'Anual'}
                  </td>
                  <td className={cn('px-6 py-4 text-sm font-bold text-right whitespace-nowrap tracking-tight', r.type === 'income' ? 'text-emerald-600' : 'text-blue-900 dark:text-slate-100')}>
                    {r.type === 'income' ? '+' : '-'} {formatCurrency(r.amount)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={async () => {
                      if (!confirm('Excluir este lembrete?')) return;
                      await remindersApi.delete(r.id);
                      await onRefresh();
                    }} className="p-2 text-blue-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <Icons.Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {reminders.length === 0 && (
          <div className="py-24 text-center">
            <div className="w-16 h-16 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.Calendar className="w-6 h-6 text-blue-300 dark:text-slate-500" />
            </div>
            <p className="text-blue-500 dark:text-slate-400 font-medium">Nenhum lembrete configurado.</p>
          </div>
        )}
      </Card>

      <AnimatePresence>
        {isAdding && (
          <ReminderModal onClose={() => setIsAdding(false)} categories={categories} accounts={accounts} userId={userId} onRefresh={onRefresh} />
        )}
      </AnimatePresence>
    </div>
  );
}

const ReminderItem: React.FC<{ reminder: Reminder; category?: Category; accounts: BankAccount[]; userId: string; onRefresh: () => Promise<void> }> = ({ reminder, category, accounts, onRefresh }) => {
  const Icon = category ? Icons[category.icon as IconName] : Icons.Calendar;
  const isOverdue = reminder.dueDate.toDate() < new Date();
  
  const handlePay = async () => {
    try {
      const account = reminder.accountId ? accounts.find(a => a.id === reminder.accountId) : undefined;
      await transactionsApi.create({
        amount: reminder.amount,
        type: reminder.type,
        categoryId: reminder.category,
        date: new Date().toISOString().split('T')[0],
        description: reminder.title,
        accountId: reminder.accountId,
        paymentMethod: account ? (account.type === 'credit' ? 'credit' : 'debit') : undefined,
      });

      if (reminder.frequency === 'once') {
        await remindersApi.delete(reminder.id);
      } else {
        const nextDate = new Date(reminder.dueDate.toDate());
        if (reminder.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        if (reminder.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        if (reminder.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        if (reminder.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
        await remindersApi.update(reminder.id, { dueDate: nextDate.toISOString().split('T')[0] });
      }
      await onRefresh();
    } catch (err) {
      console.error('Erro ao registrar pagamento:', err);
    }
  };

  return (
    <div className="flex items-center gap-4 group bg-white dark:bg-slate-800/50 hover:bg-blue-50/80 dark:hover:bg-slate-800 p-4 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm transition-all duration-300">
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105', reminder.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600')}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-blue-800 dark:text-slate-200 truncate">{reminder.title}</p>
        {reminder.notes && <p className="text-xs text-blue-400 dark:text-slate-500 truncate mt-0.5 italic">{reminder.notes}</p>}
        <div className="flex items-center gap-2 text-xs mt-1">
          <span className={isOverdue ? 'text-red-500 font-semibold bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-md' : 'text-blue-500 dark:text-slate-400 font-medium'}>
            {isOverdue ? 'Atrasado: ' : 'Vence: '} {formatDate(reminder.dueDate.toDate())}
          </span>
          {reminder.accountId && (
            <span className="text-blue-400 dark:text-slate-500 flex items-center gap-1">
              • <Icons.Wallet className="w-3 h-3" /> {accounts.find(a => a.id === reminder.accountId)?.name || 'Conta não encontrada'}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className={cn('font-bold text-right text-lg tracking-tight', reminder.type === 'income' ? 'text-emerald-600' : 'text-blue-900 dark:text-slate-100')}>
          {formatCurrency(reminder.amount)}
        </div>
        <Button 
          variant="secondary" 
          className={cn(
            "px-4 py-1.5 text-xs font-semibold h-auto transition-all",
            reminder.type === 'income' ? "hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200" : "hover:bg-blue-900 hover:text-white"
          )} 
          onClick={handlePay}
        >
          {reminder.type === 'income' ? 'Receber' : 'Pagar'}
        </Button>
      </div>
    </div>
  );
}

function ReminderModal({ onClose, categories, accounts, userId, onRefresh }: { onClose: () => void; categories: Category[]; accounts: BankAccount[]; userId: string; onRefresh: () => Promise<void> }) {
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

function TransactionModal({ onClose, categories, accounts, transactions, userId, onRefresh }: { onClose: () => void; categories: Category[]; accounts: BankAccount[]; transactions: Transaction[]; userId: string; onRefresh: () => Promise<void> }) {
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
          <button onClick={onClose} className="p-2 text-blue-400 hover:text-blue-900 dark:hover:text-slate-100 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

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

function GoalsSummary({ goals, onSeeAll }: { goals: Goal[]; onSeeAll: () => void }) {
  const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount);
  
  if (activeGoals.length === 0) return null;

  return (
    <Card 
      title="Metas Financeiras" 
      subtitle="Acompanhe o progresso dos seus sonhos" 
      className="border-none shadow-sm bg-white/50 backdrop-blur-sm"
      action={<Button variant="ghost" className="text-xs font-medium" onClick={onSeeAll}>Ver Todas</Button>}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {activeGoals.slice(0, 2).map(goal => {
          const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
          const Icon = Icons[goal.icon as IconName] || Icons.Target;
          
          return (
            <div key={goal.id} className="space-y-3 p-4 rounded-2xl bg-white dark:bg-slate-800/50 border border-blue-100 dark:border-slate-700 shadow-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${goal.color}20`, color: goal.color }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-900 dark:text-slate-100 text-sm">{goal.name}</h4>
                    <p className="text-[10px] text-blue-500 dark:text-slate-400 font-medium uppercase tracking-wider">{goal.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-blue-900 dark:text-slate-100">{percentage.toFixed(0)}%</span>
                </div>
              </div>

              <div className="h-2 bg-blue-50 dark:bg-slate-700 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: goal.color }}
                />
              </div>
              
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-blue-400 dark:text-slate-500">{formatCurrency(goal.currentAmount)}</span>
                <span className="text-blue-900 dark:text-slate-300">Alvo: {formatCurrency(goal.targetAmount)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function GoalsView({ goals, userId, transactions, accounts, categories, onRefresh }: { goals: Goal[]; userId: string; transactions: Transaction[]; accounts: BankAccount[]; categories: Category[]; onRefresh: () => Promise<void> }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [aiAdvice, setAiAdvice] = useState<AiGoalsStrategy | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setIsModalOpen(true);
  };

  const handleDelete = async (goalId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta meta?')) {
      try {
        await goalsApi.delete(goalId);
        await onRefresh();
      } catch (error) {
        console.error('Erro ao excluir meta:', error);
      }
    }
  };

  const getAiHelp = async () => {
    if (goals.length === 0) return;
    setLoadingAi(true);
    const insights = await getGoalInsights();
    if (insights) setAiAdvice(insights);
    setLoadingAi(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-blue-900 dark:text-slate-100">Suas Metas</h3>
          <p className="text-sm text-blue-500 dark:text-slate-400">Planeje e acompanhe seus objetivos financeiros.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={getAiHelp} disabled={loadingAi || goals.length === 0} className="relative overflow-hidden group">
            {loadingAi && (
              <motion.div 
                layoutId="ai-loading"
                className="absolute inset-0 bg-blue-600/10"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              />
            )}
            <Icons.Sparkles className={cn("w-4 h-4 relative z-10", loadingAi && "animate-spin text-blue-600")} />
            <span className="relative z-10">{loadingAi ? 'Analisando seu Perfil...' : 'Consultar IA'}</span>
          </Button>
          <Button onClick={() => { setEditingGoal(null); setIsModalOpen(true); }}>
            <Icons.Plus className="w-4 h-4" />
            Nova Meta
          </Button>
        </div>
      </div>

      {aiAdvice && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden border border-white/10"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <Icons.Sparkles className="w-48 h-48" />
          </div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Icons.Sparkles className="w-6 h-6 text-blue-300" />
                </div>
                <div>
                  <h4 className="font-bold text-xl tracking-tight">Estratégias Personalizadas</h4>
                  <p className="text-blue-300/60 text-xs font-bold uppercase tracking-widest">Análise via Gemini AI</p>
                </div>
              </div>
              <button 
                onClick={() => setAiAdvice(null)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <Icons.X className="w-5 h-5 text-white/50" />
              </button>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-8">
              <p className="text-blue-100 text-sm leading-relaxed italic">
                <Icons.Quote className="w-4 h-4 text-blue-400 inline-block mr-2 mb-1 rotate-180" />
                {aiAdvice.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {aiAdvice.advice.map((item, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all duration-300 group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h5 className="font-bold text-lg text-white group-hover:text-blue-300 transition-colors">{item.goalName}</h5>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                      item.feasibility === 'Alta' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      item.feasibility === 'Média' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                    )}>
                      Viabilidade: {item.feasibility}
                    </div>
                  </div>
                  
                  <p className="text-sm text-blue-100/70 leading-relaxed mb-6">{item.strategy}</p>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-blue-300/40 uppercase tracking-widest">Tempo Estimado</p>
                      <div className="flex items-center gap-2 text-sm font-bold text-blue-100">
                        <Icons.Calendar className="w-4 h-4 text-blue-400" />
                        {item.estimatedTime}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-blue-300/40 uppercase tracking-widest">Aporte Mensal</p>
                      <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                        <Icons.TrendingUp className="w-4 h-4" />
                        {item.monthlySavingNeeded}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-dashed border-blue-200 dark:border-slate-600">
            <div className="w-20 h-20 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.Target className="w-10 h-10 text-blue-300 dark:text-slate-500" />
            </div>
            <h4 className="text-lg font-bold text-blue-900 dark:text-slate-100">Nenhuma meta definida</h4>
            <p className="text-blue-500 dark:text-slate-400 max-w-xs mx-auto mt-2">Comece a planejar seu futuro criando sua primeira meta financeira.</p>
            <Button variant="secondary" className="mt-6" onClick={() => setIsModalOpen(true)}>Criar Primeira Meta</Button>
          </div>
        ) : (
          goals.map(goal => (
            <GoalItem key={goal.id} goal={goal} onEdit={() => handleEdit(goal)} onDelete={() => { handleDelete(goal.id!); }} />
          ))
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <GoalModal
            onClose={() => setIsModalOpen(false)}
            userId={userId}
            goal={editingGoal}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function GoalItem({ goal, onEdit, onDelete }: { goal: Goal; onEdit: () => void; onDelete: () => void; key?: string }) {
  const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  const Icon = Icons[goal.icon as IconName] || Icons.Target;
  const isCompleted = goal.currentAmount >= goal.targetAmount;
  
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden border-none shadow-sm">
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${goal.color}20`, color: goal.color }}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-blue-900 dark:text-slate-100 text-lg leading-tight">{goal.name}</h4>
              <p className="text-xs text-blue-500 dark:text-slate-400 font-semibold uppercase tracking-widest mt-0.5">{goal.category}</p>
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 transition-colors">
              <Icons.Edit2 className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 transition-colors">
              <Icons.Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-2xl font-bold text-blue-900 dark:text-slate-100">{percentage.toFixed(0)}%</span>
            <span className="text-xs font-bold text-blue-500 dark:text-slate-400 uppercase tracking-wider">
              {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
            </span>
          </div>
          <div className="h-3 bg-blue-50 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ backgroundColor: goal.color }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-blue-50">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-500">
            <Icons.Calendar className="w-3.5 h-3.5" />
            {goal.deadline ? formatDate(goal.deadline.toDate()) : 'Sem prazo'}
          </div>
          {isCompleted && (
            <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold uppercase tracking-widest">
              <Icons.CheckCircle className="w-4 h-4" />
              Concluído
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function GoalModal({ onClose, userId, goal, onRefresh }: { onClose: () => void; userId: string; goal: Goal | null; onRefresh: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: goal?.name || '',
    targetAmount: goal?.targetAmount || 0,
    currentAmount: goal?.currentAmount || 0,
    category: goal?.category || 'Viagem',
    deadline: goal?.deadline ? goal.deadline.toDate().toISOString().split('T')[0] : '',
    color: goal?.color || '#3b82f6',
    icon: goal?.icon || 'Plane'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const goalData = {
      name: form.name,
      targetAmount: Number(form.targetAmount),
      currentAmount: Number(form.currentAmount),
      category: form.category,
      deadline: form.deadline || undefined,
      color: form.color,
      icon: form.icon,
    };

    try {
      if (goal?.id) {
        await goalsApi.update(goal.id, goalData);
      } else {
        await goalsApi.create(goalData);
      }
      await onRefresh();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { name: 'Viagem', icon: 'Plane', color: '#3b82f6' },
    { name: 'Casa', icon: 'Home', color: '#10b981' },
    { name: 'Carro', icon: 'Car', color: '#f59e0b' },
    { name: 'Educação', icon: 'GraduationCap', color: '#8b5cf6' },
    { name: 'Reserva de Emergência', icon: 'Shield', color: '#ef4444' },
    { name: 'Aposentadoria', icon: 'Briefcase', color: '#6366f1' },
    { name: 'Outros', icon: 'Target', color: '#64748b' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-900/40 dark:bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-blue-100/50 dark:border-slate-700/50"
      >
        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">{goal ? 'Editar Meta' : 'Nova Meta Financeira'}</h3>
            <p className="text-blue-100 text-xs mt-1">Defina seus objetivos e acompanhe seu progresso.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <Input 
              label="Nome da Meta" 
              placeholder="Ex: Viagem para o Japão" 
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Valor Alvo" 
                type="number" 
                step="0.01" 
                required
                value={form.targetAmount}
                onChange={e => setForm({ ...form, targetAmount: Number(e.target.value) })}
              />
              <Input 
                label="Valor Atual" 
                type="number" 
                step="0.01" 
                required
                value={form.currentAmount}
                onChange={e => setForm({ ...form, currentAmount: Number(e.target.value) })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select 
                label="Categoria" 
                options={categories.map(c => ({ value: c.name, label: c.name }))}
                value={form.category}
                onChange={e => {
                  const cat = categories.find(c => c.name === e.target.value);
                  if (cat) {
                    setForm({ ...form, category: cat.name, icon: cat.icon, color: cat.color });
                  }
                }}
              />
              <Input 
                label="Prazo (opcional)" 
                type="date" 
                value={form.deadline}
                onChange={e => setForm({ ...form, deadline: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-blue-900 uppercase tracking-widest">Ícone e Cor</label>
              <div className="flex gap-3 flex-wrap">
                {categories.map(cat => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setForm({ ...form, icon: cat.icon, color: cat.color })}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                      form.icon === cat.icon ? "ring-2 ring-offset-2 ring-blue-600 scale-110" : "opacity-60 hover:opacity-100"
                    )}
                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                  >
                    {(() => {
                      const Icon = Icons[cat.icon as IconName] || Icons.Target;
                      return <Icon className="w-5 h-5" />;
                    })()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Salvando...' : goal ? 'Salvar Alterações' : 'Criar Meta'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
