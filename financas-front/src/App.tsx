import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from './firebase';
import {
  transactionsApi, categoriesApi, accountsApi, goalsApi, remindersApi, usersApi,
  TransactionResponse, CategoryResponse, AccountResponse, GoalResponse, ReminderResponse,
  AiGoalsStrategy, CreateTransactionPayload
} from './services/api';
import { Transaction, Category, UserProfile, Reminder, BankAccount, Goal } from './types';
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
  Line
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
    amount: r.amount,
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
    budget: r.budget,
    userId: r.userId || '',
  };
}

function toAccount(r: AccountResponse): BankAccount {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    investmentType: r.investmentType,
    balance: r.balance,
    creditLimit: r.creditLimit,
    closingDay: r.closingDay,
    dueDay: r.dueDay,
    color: r.color,
    icon: r.icon,
    userId: r.userId,
  };
}

function toGoal(r: GoalResponse): Goal {
  return {
    id: r.id,
    name: r.name,
    targetAmount: r.targetAmount,
    currentAmount: r.currentAmount,
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
    amount: r.amount,
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
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'categories' | 'reminders' | 'accounts' | 'calendar' | 'goals'>('dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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
      const [txs, cats, accs, gls, rems] = await Promise.all([
        transactionsApi.getAll(),
        categoriesApi.getAll(),
        accountsApi.getAll(),
        goalsApi.getAll(),
        remindersApi.getAll(),
      ]);
      setTransactions(txs.map(toTransaction));
      setCategories(cats.map(toCategory));
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
          <div className="max-w-5xl mx-auto p-4 md:p-8">
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
                <Button onClick={() => setIsAddModalOpen(true)} className="shadow-lg shadow-blue-900/10">
                  <Icons.Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Nova Transação</span>
                </Button>
              </div>
            </header>

            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <DashboardStats transactions={transactions} accounts={accounts} />
                  <AIInsights transactions={transactions} />
                  <CreditStrategy accounts={accounts} />
                  <UpcomingReminders reminders={reminders} categories={categories} accounts={accounts} userId={user.uid} onRefresh={fetchAllData} />
                  <BudgetProgress transactions={transactions} categories={categories} />
                  <CreditCardUsage accounts={accounts} transactions={transactions} />
                  <GoalsSummary goals={goals} onSeeAll={() => setActiveTab('goals')} />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <DashboardCharts transactions={transactions} categories={categories} accounts={accounts} />
                    <RecentTransactions transactions={transactions.slice(0, 5)} categories={categories} accounts={accounts} onSeeAll={() => setActiveTab('transactions')} />
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
                  <AccountManager accounts={accounts} transactions={transactions} userId={user.uid} onRefresh={fetchAllData} />
                </motion.div>
              )}

              {activeTab === 'calendar' && (
                <motion.div key="calendar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <CalendarView reminders={reminders} transactions={transactions} categories={categories} />
                </motion.div>
              )}

              {activeTab === 'goals' && (
                <motion.div key="goals" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <GoalsView goals={goals} userId={user.uid} transactions={transactions} accounts={accounts} categories={categories} onRefresh={fetchAllData} />
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

function DashboardStats({ transactions, accounts }: { transactions: Transaction[]; accounts: BankAccount[] }) {
  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const initialBalance = accounts.reduce((acc, a) => a.type === 'credit' ? acc - a.balance : acc + a.balance, 0);
    
    const invested = accounts
      .filter(a => a.type === 'investment')
      .reduce((sum, acc) => {
        const currentBalance = transactions
          .filter(t => t.accountId === acc.id)
          .reduce((accBalance, t) => {
            return t.type === 'income' ? accBalance + t.amount : accBalance - t.amount;
          }, acc.balance);
        return sum + currentBalance;
      }, 0);

    return { income, expense, balance: initialBalance + income - expense, invested };
  }, [transactions, accounts]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Saldo Total" amount={stats.balance} icon="Wallet" color="blue" />
      <StatCard title="Investimentos" amount={stats.invested} icon="TrendingUp" color="blue" />
      <StatCard title="Receitas" amount={stats.income} icon="ArrowUpRight" color="emerald" />
      <StatCard title="Despesas" amount={stats.expense} icon="ArrowDownLeft" color="red" />
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

function StatCard({ title, amount, icon, color }: { title: string; amount: number; icon: IconName; color: 'blue' | 'emerald' | 'red' }) {
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
      </div>
    </Card>
  );
}

function BudgetProgress({ transactions, categories }: { transactions: Transaction[]; categories: Category[] }) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const expensesThisMonth = transactions.filter(t => {
    const d = t.date.toDate();
    return t.type === 'expense' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
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

function CreditCardUsage({ accounts, transactions }: { accounts: BankAccount[]; transactions: Transaction[] }) {
  const creditCards = useMemo(() => {
    return accounts
      .filter(a => a.type === 'credit' && a.creditLimit && a.creditLimit > 0)
      .map(acc => {
        const currentBalance = transactions
          .filter(t => t.accountId === acc.id)
          .reduce((accBalance, t) => {
            return t.type === 'expense' ? accBalance + t.amount : accBalance - t.amount;
          }, acc.balance);
        
        const used = Math.max(0, currentBalance);
        const available = Math.max(0, acc.creditLimit! - used);
        const percentage = Math.min((used / acc.creditLimit!) * 100, 100);

        return {
          name: acc.name,
          used,
          available,
          limit: acc.creditLimit!,
          percentage,
          color: acc.color
        };
      });
  }, [accounts, transactions]);

  if (creditCards.length === 0) return null;

  return (
    <Card title="Uso do Cartão de Crédito" subtitle="Limite utilizado vs disponível" className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="space-y-8">
        {creditCards.map(card => (
          <div key={card.name} className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <h4 className="font-bold text-blue-900 dark:text-slate-100 text-sm">{card.name}</h4>
                <p className="text-[10px] text-blue-500 dark:text-slate-400 font-medium uppercase tracking-wider">Limite: {formatCurrency(card.limit)}</p>
              </div>
              <div className="text-right">
                <span className={cn("text-sm font-bold", card.percentage > 90 ? "text-red-600" : "text-blue-900 dark:text-slate-100")}>
                  {formatCurrency(card.used)}
                </span>
                <span className="text-blue-400 dark:text-slate-500 text-xs mx-1">utilizado</span>
              </div>
            </div>

            <div className="relative h-4 bg-blue-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${card.percentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={cn(
                  "absolute h-full rounded-full transition-all duration-500",
                  card.percentage > 90 ? "bg-red-500" : card.percentage > 70 ? "bg-amber-500" : "bg-emerald-500"
                )}
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

function DashboardCharts({ transactions, categories, accounts }: { transactions: Transaction[]; categories: Category[]; accounts: BankAccount[] }) {
  const pieData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const grouped = expenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([catId, amount]) => {
      const cat = categories.find(c => c.id === catId);
      return {
        name: cat?.name || 'Outros',
        value: amount,
        color: cat?.color || '#71717a'
      };
    }).sort((a, b) => b.value - a.value);
  }, [transactions, categories]);

  const barData = useMemo(() => {
    // Last 6 months
    const data: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date);
      const month = date.getMonth();
      const year = date.getFullYear();

      const monthTransactions = transactions.filter(t => {
        const d = t.date.toDate();
        return d.getMonth() === month && d.getFullYear() === year;
      });

      data.push({
        name: monthLabel,
        receitas: monthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
        despesas: monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0),
      });
    }
    return data;
  }, [transactions]);

  const accountBalancesData = useMemo(() => {
    return accounts.map(account => {
      const accountTransactions = transactions.filter(t => t.accountId === account.id);
      const balance = accountTransactions.reduce((accBalance, t) => {
        if (account.type === 'credit') {
          return t.type === 'expense' ? accBalance + t.amount : accBalance - t.amount;
        }
        return t.type === 'income' ? accBalance + t.amount : accBalance - t.amount;
      }, account.balance);

      return {
        name: account.name,
        balance: balance,
        type: account.type
      };
    }).sort((a, b) => b.balance - a.balance);
  }, [transactions, accounts]);

  return (
    <div className="space-y-6">
      <Card title="Saldo por Conta" subtitle="Saldo atual consolidado por conta" className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={accountBalancesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa', fontWeight: 500 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa', fontWeight: 500 }} />
              <Tooltip 
                cursor={{ fill: '#f4f4f5' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', padding: '12px 16px', fontWeight: 500 }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Bar 
                dataKey="balance" 
                radius={[6, 6, 0, 0]} 
                maxBarSize={40}
              >
                {accountBalancesData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.balance >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Fluxo de Caixa" subtitle="Receitas vs Despesas (Últimos 6 meses)" className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa', fontWeight: 500 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa', fontWeight: 500 }} />
              <Tooltip 
                cursor={{ fill: '#f4f4f5' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', padding: '12px 16px', fontWeight: 500 }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Bar dataKey="receitas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
              <Bar dataKey="despesas" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Gastos por Categoria" subtitle="Distribuição proporcional das despesas" className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={90}
                paddingAngle={8}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', padding: '12px 16px', fontWeight: 500 }}
                formatter={(value: number) => formatCurrency(value)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {pieData.slice(0, 4).map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-blue-50/50 dark:bg-slate-800/50 p-2 rounded-xl">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-xs font-medium text-blue-700 dark:text-slate-300 truncate">{item.name}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RecentTransactions({ transactions, categories, accounts, onSeeAll }: { transactions: Transaction[]; categories: Category[]; accounts: BankAccount[]; onSeeAll: () => void }) {
  return (
    <Card title="Transações Recentes" className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm" action={<Button variant="ghost" className="text-xs font-medium" onClick={onSeeAll}>Ver Tudo</Button>}>
      <div className="space-y-2">
        {transactions.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.AlertCircle className="w-6 h-6 text-blue-300 dark:text-slate-500" />
            </div>
            <p className="text-blue-500 dark:text-slate-400 font-medium">Nenhuma transação encontrada.</p>
          </div>
        ) : (
          transactions.map(t => (
            <TransactionItem key={t.id} transaction={t} category={categories.find(c => c.id === t.category)} account={accounts.find(a => a.id === t.accountId)} />
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
        <div className="flex gap-2">
          <Button variant={filter === 'all' ? 'primary' : 'secondary'} onClick={() => setFilter('all')} className="px-3 py-2 text-xs">Tudo</Button>
          <Button variant={filter === 'income' ? 'primary' : 'secondary'} onClick={() => setFilter('income')} className="px-3 py-2 text-xs">Receitas</Button>
          <Button variant={filter === 'expense' ? 'primary' : 'secondary'} onClick={() => setFilter('expense')} className="px-3 py-2 text-xs">Despesas</Button>
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

function CalendarView({ reminders, transactions, categories }: { reminders: Reminder[]; transactions: Transaction[]; categories: Category[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filter, setFilter] = useState<'all' | 'expense' | 'income' | 'reminder'>('all');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getDayData = (day: Date) => {
    const dayReminders = reminders.filter(r => isSameDay(r.dueDate.toDate(), day));
    const dayTransactions = transactions.filter(t => isSameDay(t.date.toDate(), day));

    let filteredReminders = dayReminders;
    let filteredTransactions = dayTransactions;

    if (filter === 'expense') {
      filteredReminders = dayReminders.filter(r => r.type === 'expense');
      filteredTransactions = dayTransactions.filter(t => t.type === 'expense');
    } else if (filter === 'income') {
      filteredReminders = dayReminders.filter(r => r.type === 'income');
      filteredTransactions = dayTransactions.filter(t => t.type === 'income');
    } else if (filter === 'reminder') {
      filteredTransactions = [];
    }

    const totalExpense = [...filteredReminders.filter(r => r.type === 'expense'), ...filteredTransactions.filter(t => t.type === 'expense')]
      .reduce((sum, item) => sum + item.amount, 0);
    
    const totalIncome = [...filteredReminders.filter(r => r.type === 'income'), ...filteredTransactions.filter(t => t.type === 'income')]
      .reduce((sum, item) => sum + item.amount, 0);

    return {
      reminders: filteredReminders,
      transactions: filteredTransactions,
      totalExpense,
      totalIncome,
      isCritical: totalExpense > 500 // Threshold for "critical" period
    };
  };

  return (
    <div className="space-y-6">
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
          {(['all', 'expense', 'income', 'reminder'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                filter === f ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-slate-100 shadow-sm' : 'text-blue-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-slate-200'
              )}
            >
              {f === 'all' && 'Tudo'}
              {f === 'expense' && 'Despesas'}
              {f === 'income' && 'Receitas'}
              {f === 'reminder' && 'Lembretes'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-blue-200/60 dark:border-slate-700/60 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-blue-100 dark:border-slate-700 bg-blue-50/50 dark:bg-slate-800/50">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="py-3 text-center text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const data = getDayData(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            
            return (
              <div 
                key={day.toString()} 
                className={cn(
                  "min-h-[100px] sm:min-h-[120px] p-2 border-r border-b border-blue-100 dark:border-slate-700/50 last:border-r-0 transition-colors relative group",
                  !isCurrentMonth && "bg-blue-50/30 dark:bg-slate-800/30",
                  isToday(day) && "bg-blue-900/[0.02] dark:bg-blue-500/5"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                    isToday(day) ? "bg-blue-900 text-white" : isCurrentMonth ? "text-blue-900 dark:text-slate-200" : "text-blue-300 dark:text-slate-600"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {data.isCritical && (
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Período Crítico" />
                  )}
                </div>

                <div className="space-y-1">
                  {data.totalIncome > 0 && (
                    <div className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md truncate">
                      + {formatCurrency(data.totalIncome)}
                    </div>
                  )}
                  {data.totalExpense > 0 && (
                    <div className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-md truncate",
                      data.isCritical ? "bg-red-50 text-red-600" : "bg-blue-100 text-blue-600"
                    )}>
                      - {formatCurrency(data.totalExpense)}
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {data.reminders.map(r => (
                      <div key={r.id} className="w-1 h-1 rounded-full bg-blue-400" title={`Lembrete: ${r.title}`} />
                    ))}
                  </div>
                </div>

                {/* Hover Details */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-3 transition-opacity border border-blue-200 dark:border-slate-600 shadow-xl rounded-xl -m-1">
                  <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase mb-2">{format(day, "dd 'de' MMMM", { locale: ptBR })}</p>
                  <div className="space-y-2 max-h-[100px] overflow-y-auto pr-1">
                    {data.reminders.map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-medium text-blue-600 truncate">{r.title}</span>
                        <span className={cn("text-[10px] font-bold", r.type === 'income' ? 'text-emerald-600' : 'text-blue-900')}>
                          {formatCurrency(r.amount)}
                        </span>
                      </div>
                    ))}
                    {data.transactions.map(t => (
                      <div key={t.id} className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-medium text-blue-400 truncate italic">{t.description || 'Sem descrição'}</span>
                        <span className={cn("text-[10px] font-bold opacity-70", t.type === 'income' ? 'text-emerald-600' : 'text-blue-900')}>
                          {formatCurrency(t.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm">
          <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Receitas</p>
          <p className="text-xl font-bold text-emerald-600">
            {formatCurrency(days.reduce((sum, day) => sum + getDayData(day).totalIncome, 0))}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm">
          <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Despesas</p>
          <p className="text-xl font-bold text-blue-900 dark:text-slate-100">
            {formatCurrency(days.reduce((sum, day) => sum + getDayData(day).totalExpense, 0))}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm">
          <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-1">Saldo do Período</p>
          <p className="text-xl font-bold text-blue-900 dark:text-slate-100">
            {formatCurrency(days.reduce((sum, day) => sum + (getDayData(day).totalIncome - getDayData(day).totalExpense), 0))}
          </p>
        </div>
      </div>
    </div>
  );
}

function InvestmentsView({ accounts, transactions }: { accounts: BankAccount[]; transactions: Transaction[] }) {
  const investmentAccounts = useMemo(() => accounts.filter(a => a.type === 'investment'), [accounts]);
  
  const totalInvested = useMemo(() => {
    return investmentAccounts.reduce((sum, acc) => {
      const currentBalance = transactions
        .filter(t => t.accountId === acc.id)
        .reduce((accBalance, t) => {
          return t.type === 'income' ? accBalance + t.amount : accBalance - t.amount;
        }, acc.balance);
      return sum + currentBalance;
    }, 0);
  }, [investmentAccounts, transactions]);

  const allocation = useMemo(() => {
    const types: Record<string, number> = {};
    investmentAccounts.forEach(acc => {
      const currentBalance = transactions
        .filter(t => t.accountId === acc.id)
        .reduce((accBalance, t) => {
          return t.type === 'income' ? accBalance + t.amount : accBalance - t.amount;
        }, acc.balance);
      
      const type = acc.investmentType || 'other';
      types[type] = (types[type] || 0) + currentBalance;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [investmentAccounts, transactions]);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-blue-900 text-white border-none shadow-xl">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Patrimônio Investido</p>
          <h3 className="text-3xl font-bold tracking-tight">{formatCurrency(totalInvested)}</h3>
          <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <Icons.TrendingUp className="w-4 h-4" />
            <span>Crescimento constante</span>
          </div>
        </Card>

        <Card className="p-6 md:col-span-2 bg-white dark:bg-slate-900 border-none shadow-sm flex flex-col md:flex-row items-center gap-8">
          <div className="w-full md:w-1/2 h-[200px]">
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
          <div className="w-full md:w-1/2 space-y-3">
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
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {investmentAccounts.map(acc => {
          const currentBalance = transactions
            .filter(t => t.accountId === acc.id)
            .reduce((accBalance, t) => {
              return t.type === 'income' ? accBalance + t.amount : accBalance - t.amount;
            }, acc.balance);

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
    </div>
  );
}

function AccountManager({ accounts, transactions, userId, onRefresh }: { accounts: BankAccount[]; transactions: Transaction[]; userId: string; onRefresh: () => Promise<void> }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newAcc, setNewAcc] = useState({ 
    name: '', 
    type: 'checking' as BankAccount['type'], 
    investmentType: 'cdb' as BankAccount['investmentType'],
    balance: '', 
    creditLimit: '', 
    closingDay: '', 
    dueDay: '', 
    color: '#3b82f6', 
    icon: 'Landmark' 
  });

  const handleAdd = async () => {
    if (!newAcc.name || !newAcc.balance) return;
    try {
      const data: any = {
        name: newAcc.name,
        type: newAcc.type,
        balance: parseFloat(newAcc.balance),
        color: newAcc.color,
        icon: newAcc.icon,
      };
      if (newAcc.type === 'credit') {
        if (newAcc.creditLimit) data.creditLimit = parseFloat(newAcc.creditLimit);
        if (newAcc.closingDay) data.closingDay = parseInt(newAcc.closingDay);
        if (newAcc.dueDay) data.dueDay = parseInt(newAcc.dueDay);
      }
      if (newAcc.type === 'investment') {
        data.investmentType = newAcc.investmentType;
        data.icon = 'TrendingUp';
      }
      await accountsApi.create(data);
      setIsAdding(false);
      setNewAcc({
        name: '',
        type: 'checking',
        investmentType: 'cdb',
        balance: '',
        creditLimit: '',
        closingDay: '',
        dueDay: '',
        color: '#3b82f6',
        icon: 'Landmark'
      });
      await onRefresh();
    } catch (err) {
      console.error('Erro ao criar conta:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await accountsApi.delete(id);
      await onRefresh();
    } catch (err) {
      console.error('Erro ao excluir conta:', err);
    }
  };

  const typeLabels: Record<string, string> = {
    checking: 'Conta Corrente',
    savings: 'Poupança',
    investment: 'Investimentos',
    credit: 'Cartão de Crédito'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-blue-900 dark:text-slate-100">Contas Bancárias</h2>
          <p className="text-blue-500 dark:text-slate-400 mt-1">Gerencie suas contas e cartões</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(acc => {
          const Icon = Icons[acc.icon as IconName] || Icons.Landmark;
          const currentBalance = transactions
            .filter(t => t.accountId === acc.id)
            .reduce((accBalance, t) => {
              if (acc.type === 'credit') {
                return t.type === 'expense' ? accBalance + t.amount : accBalance - t.amount;
              }
              return t.type === 'income' ? accBalance + t.amount : accBalance - t.amount;
            }, acc.balance);

          return (
            <Card key={acc.id} className="p-5 border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: acc.color }} />
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${acc.color}15`, color: acc.color }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-slate-100">{acc.name}</h3>
                    <p className="text-xs text-blue-500 dark:text-slate-400 font-medium">{typeLabels[acc.type]}</p>
                  </div>
                </div>
                <button onClick={() => handleDelete(acc.id)} className="p-2 text-blue-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl opacity-0 group-hover:opacity-100 transition-all">
                  <Icons.Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-blue-100/50 dark:border-slate-700/50">
                {acc.type === 'credit' ? (
                  <>
                    <p className="text-sm text-blue-500 dark:text-slate-400 mb-1">Fatura Atual</p>
                    <p className="text-2xl font-bold tracking-tight text-blue-800 dark:text-slate-100">{formatCurrency(Math.abs(currentBalance))}</p>
                    {acc.creditLimit && (
                      <div className="mt-2 flex justify-between text-xs font-medium">
                        <span className="text-blue-500 dark:text-slate-400">Limite Disponível</span>
                        <span className="text-emerald-600">{formatCurrency(acc.creditLimit - Math.abs(currentBalance))}</span>
                      </div>
                    )}
                    {(acc.closingDay || acc.dueDay) && (
                      <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-blue-100/50 dark:border-slate-700/50">
                        {acc.closingDay && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 dark:text-slate-500 mb-0.5">Fechamento</p>
                            <p className="text-sm font-bold text-blue-700 dark:text-blue-400">Dia {acc.closingDay}</p>
                          </div>
                        )}
                        {acc.dueDay && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 dark:text-slate-500 mb-0.5">Vencimento</p>
                            <p className="text-sm font-bold text-blue-700 dark:text-blue-400">Dia {acc.dueDay}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {acc.closingDay && (
                      <div className="mt-4 p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-800/50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 shrink-0">
                          <Icons.TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Melhor dia para compra</p>
                          <p className="text-sm font-bold text-blue-700 dark:text-blue-400">Dia {acc.closingDay + 1 > 31 ? 1 : acc.closingDay + 1}</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-blue-500 dark:text-slate-400 mb-1">Saldo Atual</p>
                    <p className="text-2xl font-bold tracking-tight text-blue-900 dark:text-slate-100">{formatCurrency(currentBalance)}</p>
                  </>
                )}
              </div>
            </Card>
          );
        })}

        {isAdding ? (
          <Card className="p-6 border-none shadow-lg bg-white dark:bg-slate-900 space-y-6">
            <div className="flex items-center justify-between border-b border-blue-50 dark:border-slate-700 pb-4">
              <h3 className="text-lg font-bold text-blue-900 dark:text-slate-100 tracking-tight">Nova Conta</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 text-blue-400 hover:text-blue-900 dark:hover:text-slate-100 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-full transition-colors">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <Input 
                label="Nome da conta" 
                placeholder="Ex: Nubank, Itaú..." 
                value={newAcc.name} 
                onChange={e => setNewAcc({ ...newAcc, name: e.target.value })} 
                className="bg-white" 
              />
              
              <RadioGroup 
                label="Tipo de Conta"
                value={newAcc.type} 
                onChange={val => setNewAcc({ ...newAcc, type: val as any })}
                options={[
                  { value: 'checking', label: 'Corrente' },
                  { value: 'savings', label: 'Poupança' },
                  { value: 'investment', label: 'Investimentos' },
                  { value: 'credit', label: 'Cartão de Crédito' }
                ]}
              />

              <Input 
                label={newAcc.type === 'credit' ? "Fatura atual" : "Saldo inicial"} 
                type="number" 
                placeholder="0,00" 
                value={newAcc.balance} 
                onChange={e => setNewAcc({ ...newAcc, balance: e.target.value })} 
                className="bg-white" 
              />
              
              {newAcc.type === 'investment' && (
                <Select 
                  label="Tipo de Investimento"
                  value={newAcc.investmentType} 
                  onChange={e => setNewAcc({ ...newAcc, investmentType: e.target.value as any })}
                  options={[
                    { value: 'cdb', label: 'CDB / Renda Fixa' },
                    { value: 'stock', label: 'Ações' },
                    { value: 'fund', label: 'Fundos de Investimento' },
                    { value: 'fii', label: 'FIIs' },
                    { value: 'other', label: 'Outros' }
                  ]}
                  className="bg-white"
                />
              )}

              {newAcc.type === 'credit' && (
                <div className="space-y-4 pt-2 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                  <Input 
                    label="Limite de crédito" 
                    type="number" 
                    placeholder="0,00" 
                    value={newAcc.creditLimit} 
                    onChange={e => setNewAcc({ ...newAcc, creditLimit: e.target.value })} 
                    className="bg-white" 
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input 
                      label="Dia fechamento" 
                      type="number" 
                      placeholder="Dia" 
                      value={newAcc.closingDay} 
                      onChange={e => setNewAcc({ ...newAcc, closingDay: e.target.value })} 
                      className="bg-white" 
                    />
                    <Input 
                      label="Dia vencimento" 
                      type="number" 
                      placeholder="Dia" 
                      value={newAcc.dueDay} 
                      onChange={e => setNewAcc({ ...newAcc, dueDay: e.target.value })} 
                      className="bg-white" 
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-blue-900/70 tracking-tight">Cor da Conta</label>
                <div className="flex gap-3">
                  <div className="relative w-14 h-11 rounded-xl overflow-hidden border-2 border-blue-100 shrink-0 shadow-sm transition-transform hover:scale-105">
                    <input 
                      type="color" 
                      className="absolute -top-2 -left-2 w-20 h-20 cursor-pointer border-none p-0" 
                      value={newAcc.color} 
                      onChange={e => setNewAcc({ ...newAcc, color: e.target.value })} 
                    />
                  </div>
                  <Button className="flex-1 h-11 font-bold text-sm tracking-tight shadow-md shadow-blue-200" onClick={handleAdd}>
                    Adicionar Conta
                  </Button>
                </div>
              </div>
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
            <span className="font-medium text-sm">Nova Conta</span>
          </button>
        )}
      </div>
    </div>
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

  const getAccountBalance = (acc: BankAccount) => {
    return transactions
      .filter(t => t.accountId === acc.id)
      .reduce((accBalance, t) => {
        if (acc.type === 'credit') {
          return t.type === 'expense' ? accBalance + t.amount : accBalance - t.amount;
        }
        return t.type === 'income' ? accBalance + t.amount : accBalance - t.amount;
      }, acc.balance);
  };

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
