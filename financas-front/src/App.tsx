import React, { useState, useEffect, useCallback } from 'react';
import { LandingPage } from './LandingPage';
import { PlanProvider } from './contexts/PlanContext';
import { PlanGate } from './components/PlanGate';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from './firebase';
import {
  transactionsApi, categoriesApi, accountsApi, banksApi, goalsApi, remindersApi, usersApi,
  TransactionResponse, CategoryResponse, AccountResponse, BankResponse, GoalResponse, ReminderResponse,
} from './services/api';
import { Transaction, Category, UserProfile, Reminder, BankAccount, Bank, Goal } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Icons } from './components/Icons';
import { motion, AnimatePresence } from 'motion/react';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// UI primitives
import { Button } from './components/ui';

// Confirm dialog
import { ConfirmProvider, useConfirm } from './contexts/ConfirmContext';

// Layout
import { NavButton } from './components/layout/NavButton';
import { TopBar } from './components/layout/TopBar';

// Dashboard components
import { PatrimonioCard } from './components/dashboard/PatrimonioCard';
import { FluxoMes } from './components/dashboard/FluxoMes';
import { AIInsights } from './components/dashboard/AIInsights';
import { CreditStrategy } from './components/dashboard/CreditStrategy';
import { CreditCardUsage } from './components/dashboard/CreditCardUsage';
import { BudgetProgress } from './components/dashboard/BudgetProgress';
import { GoalsSummary } from './components/dashboard/GoalsSummary';
import { FluxoCaixaChart, GastosCategoriaChart } from './components/dashboard/Charts';
import { RecentTransactions } from './components/dashboard/RecentTransactions';
import { UpcomingReminders } from './components/dashboard/UpcomingReminders';
import { OnboardingChecklist } from './components/dashboard/OnboardingChecklist';

// Modals
import { TransactionModal } from './components/modals/TransactionModal';
import { TransferenciaModal } from './components/modals/TransferenciaModal';

// Views
import { TransactionManager } from './views/TransactionManager';
import { CategoryManager } from './views/CategoryManager';
import { AccountManager } from './views/AccountManager';
import { ReminderManager } from './views/ReminderManager';
import { GoalsView } from './views/GoalsView';
import { CalendarView } from './views/CalendarView';
import { InvestmentsView } from './views/InvestmentsView';
import { OpenFinanceView } from './views/OpenFinanceView';
import { PlanosView } from './views/PlanosView';
import { AuditLogView } from './views/AuditLogView';
import { FaturaView } from './views/FaturaView';
import { AnalyticsView } from './views/AnalyticsView';
import { SettingsView } from './views/SettingsView';
import { HealthView } from './views/HealthView';
import { HealthScoreCard } from './components/dashboard/HealthScoreCard';

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
    isTransfer: r.isTransfer ?? false,
    isPending: r.isPending ?? false,
    installmentRef: r.installmentRef,
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
    subtype: r.subtype,
    balance: Number(r.balance),
    creditLimit: r.creditLimit != null ? Number(r.creditLimit) : undefined,
    closingDay: r.closingDay,
    dueDay: r.dueDay,
    color: r.color,
    icon: r.icon,
    userId: r.userId,
    bankId: r.bankId,
    bank: r.bank ? { id: r.bank.id, name: r.bank.name, color: r.bank.color, icon: r.bank.icon, userId: r.bank.userId } : undefined,
    currency: r.currency ?? 'BRL',
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

// --- Main App ---

export default function App() {
  return (
    <ConfirmProvider>
      <AppInner />
    </ConfirmProvider>
  );
}

function AppInner() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'fatura' | 'investments' | 'analytics' | 'categories' | 'reminders' | 'accounts' | 'calendar' | 'goals' | 'audit' | 'openfinance' | 'planos' | 'settings' | 'health'>('dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [transferenciaModal, setTransferenciaModal] = useState<{ open: boolean; prefillToId?: string; prefillAmount?: number }>({ open: false });
  const [dashboardMonth, setDashboardMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const { confirm } = useConfirm();
  const [clearing, setClearing] = useState(false);

  const handleClearAllData = async () => {
    const ok = await confirm({
      title: 'Limpar todos os dados',
      description: 'Esta ação é permanente e não pode ser desfeita.',
      variant: 'danger',
      requireText: 'LIMPAR',
      items: [
        `${transactions.length} transação(ões)`,
        `${reminders.length} lembrete(s)`,
        `${accounts.length} conta(s) / cartão(ões)`,
        `${banks.length} banco(s)`,
      ],
      confirmLabel: 'Apagar tudo',
    });
    if (!ok) return;

    setClearing(true);
    try {
      await Promise.all([
        ...transactions.map(t => transactionsApi.delete(t.id)),
        ...reminders.map(r => remindersApi.delete(r.id)),
      ]);
      await Promise.all(accounts.map(a => accountsApi.delete(a.id)));
      await Promise.all(banks.map(b => banksApi.delete(b.id)));
      await fetchAllData();
    } catch (err) {
      console.error('Erro ao limpar dados:', err);
    } finally {
      setClearing(false);
    }
  };

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
    return <LandingPage onLogin={handleLogin} />;
  }

  return (
    <PlanProvider authenticated={!!user}>
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

        {/* Top navigation bar */}
        <TopBar
          user={user}
          profile={profile}
          darkMode={darkMode}
          onDarkModeToggle={() => setDarkMode(d => !d)}
          onLogout={handleLogout}
          onNavigate={(tab) => setActiveTab(tab as any)}
          onClearData={handleClearAllData}
          clearing={clearing}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(c => !c)}
          transactions={transactions}
          accounts={accounts}
          categories={categories}
        />

        {/* Sidebar / Nav */}
        <nav
          className={`fixed bottom-0 left-0 right-0 md:top-0 md:bottom-0 md:right-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t md:border-t-0 md:border-r border-blue-100/50 dark:border-slate-700/50 z-40 transition-all duration-300 ${sidebarCollapsed ? 'md:w-16' : 'md:w-64'}`}
          style={{ backgroundColor: darkMode ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)' }}
        >
          <div className="h-full flex flex-col p-2 md:p-4">
            {/* Logo / collapse toggle (desktop) */}
            <div className={`hidden md:flex items-center mb-6 mt-2 ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-2'}`}>
              {!sidebarCollapsed && (
                <>
                  <div className="w-9 h-9 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0">
                    <Icons.Wallet className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-lg tracking-tight text-blue-900 dark:text-slate-100 flex-1 truncate">Finanças Pro</span>
                </>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-xl text-blue-400 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors shrink-0"
                title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
              >
                {sidebarCollapsed ? <Icons.ChevronRight className="w-4 h-4" /> : <Icons.ChevronLeft className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex md:flex-col items-center md:items-stretch justify-around md:justify-start gap-1 flex-1 overflow-y-auto">
              <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon="LayoutDashboard" label="Dashboard" collapsed={sidebarCollapsed} />
              <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon="List" label="Transações" collapsed={sidebarCollapsed} />
              <NavButton active={activeTab === 'fatura'} onClick={() => setActiveTab('fatura')} icon="CreditCard" label="Faturas" collapsed={sidebarCollapsed} />
              <NavButton active={activeTab === 'investments'} onClick={() => setActiveTab('investments')} icon="TrendingUp" label="Investimentos" collapsed={sidebarCollapsed} />
              <NavButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} icon="Sparkles" label="Análises IA" collapsed={sidebarCollapsed} />
              <NavButton active={activeTab === 'health'} onClick={() => setActiveTab('health')} icon="HeartPulse" label="Saúde Financeira" collapsed={sidebarCollapsed} />
              <NavButton active={activeTab === 'categories'} onClick={() => setActiveTab('categories')} icon="Tag" label="Categorias" collapsed={sidebarCollapsed} />
              <NavButton active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon="Calendar" label="Calendário" collapsed={sidebarCollapsed} />
              <NavButton active={activeTab === 'reminders'} onClick={() => setActiveTab('reminders')} icon="List" label="Lembretes" collapsed={sidebarCollapsed} />
              <NavButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon="Landmark" label="Contas" collapsed={sidebarCollapsed} />
              <NavButton active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} icon="Target" label="Metas" collapsed={sidebarCollapsed} />
              <NavButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon="List" label="Histórico" collapsed={sidebarCollapsed} />
              <PlanGate feature="openFinance" showLocked={true}>
                <NavButton active={activeTab === 'openfinance'} onClick={() => setActiveTab('openfinance')} icon="Zap" label="Open Finance" collapsed={sidebarCollapsed} />
              </PlanGate>
              <NavButton active={activeTab === 'planos'} onClick={() => setActiveTab('planos')} icon="Sparkles" label="Planos" collapsed={sidebarCollapsed} />
              <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon="Settings" label="Configurações" collapsed={sidebarCollapsed} />
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className={`pt-14 pb-24 md:pb-8 min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'md:pl-16' : 'md:pl-64'}`}>
          <div className="p-4 md:p-8">
            <header className="flex items-start sm:items-center justify-between mb-10 mt-4 md:mt-0 gap-4 flex-col sm:flex-row">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-blue-900 dark:text-slate-100">
                  {activeTab === 'dashboard' && 'Dashboard'}
                  {activeTab === 'transactions' && 'Minhas Transações'}
                  {activeTab === 'fatura' && 'Faturas do Cartão'}
                  {activeTab === 'investments' && 'Meus Investimentos'}
                  {activeTab === 'categories' && 'Categorias'}
                  {activeTab === 'calendar' && 'Calendário Financeiro'}
                  {activeTab === 'reminders' && 'Lembretes'}
                  {activeTab === 'accounts' && 'Meus Produtos'}
                  {activeTab === 'goals' && 'Minhas Metas'}
                  {activeTab === 'audit' && 'Histórico de Operações'}
                  {activeTab === 'openfinance' && 'Open Finance'}
                  {activeTab === 'analytics' && 'Análises com IA'}
                  {activeTab === 'planos' && 'Planos & Assinatura'}
                  {activeTab === 'settings' && 'Configurações'}
                  {activeTab === 'health' && 'Saúde Financeira'}
                </h2>
                <p className="text-blue-500 dark:text-slate-400 font-medium mt-1">
                  {activeTab === 'dashboard' && `Bem-vindo de volta, ${user.displayName?.split(' ')[0]}!`}
                  {activeTab === 'transactions' && 'Histórico completo de movimentações.'}
                  {activeTab === 'fatura' && 'Visualize gastos e período de fechamento por cartão.'}
                  {activeTab === 'investments' && 'Acompanhe o crescimento do seu patrimônio.'}
                  {activeTab === 'categories' && 'Organize seus gastos por categorias.'}
                  {activeTab === 'calendar' && 'Visualize seus vencimentos e períodos críticos.'}
                  {activeTab === 'reminders' && 'Gerencie pagamentos recorrentes e futuros.'}
                  {activeTab === 'accounts' && 'Gerencie contas, cartões, empréstimos e financiamentos.'}
                  {activeTab === 'goals' && 'Planeje e acompanhe seus sonhos financeiros.'}
                  {activeTab === 'audit' && 'Rastreabilidade de todas as operações realizadas.'}
                  {activeTab === 'openfinance' && 'Conecte suas contas bancárias reais via Open Finance Brasil.'}
                  {activeTab === 'analytics' && 'Inteligência artificial aplicada às suas finanças.'}
                  {activeTab === 'planos' && 'Escolha o plano ideal para você.'}
                  {activeTab === 'settings' && 'Personalize alertas, lembretes, investimentos e muito mais.'}
                  {activeTab === 'health' && 'Score e indicadores baseados em literatura financeira internacional.'}
                </p>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <Button variant="secondary" onClick={() => setTransferenciaModal({ open: true })} className="shadow-sm hidden sm:flex">
                  <Icons.ArrowUpRight className="w-4 h-4 rotate-45" />
                  Transferência
                </Button>
                <PlanGate limit="transactionsPerMonth" current={transactions.filter(t => {
                  const d = t.date.toDate();
                  const now = new Date();
                  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                }).length}>
                  <Button onClick={() => setIsAddModalOpen(true)} className="shadow-lg shadow-blue-900/10">
                    <Icons.Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Nova Transação</span>
                  </Button>
                </PlanGate>
              </div>
            </header>

            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  {/* Onboarding */}
                  <OnboardingChecklist
                    userId={user.uid}
                    banks={banks}
                    accounts={accounts}
                    categories={categories}
                    transactions={transactions}
                    onNavigate={tab => setActiveTab(tab as any)}
                    onAddTransaction={() => setIsAddModalOpen(true)}
                  />

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

                  {/* Bloco 3 — Saúde Financeira (score card) */}
                  <HealthScoreCard
                    transactions={transactions}
                    accounts={accounts}
                    onNavigate={() => setActiveTab('health')}
                  />

                  {/* Bloco 4 — Insights IA */}
                  <PlanGate feature="ai">
                    <AIInsights transactions={transactions} />
                  </PlanGate>

                  {/* Bloco 4 — Estratégia de compra */}
                  <CreditStrategy accounts={accounts} />

                  {/* Bloco 5 — Cartões | Orçamento (orçamento só aparece se houver categorias com budget) */}
                  {(() => {
                    const hasBudget = categories.some(c => c.budget && c.budget > 0);
                    return hasBudget ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <CreditCardUsage accounts={accounts} transactions={transactions} onPayBill={(toId, amount) => setTransferenciaModal({ open: true, prefillToId: toId, prefillAmount: amount })} />
                        <BudgetProgress transactions={transactions} categories={categories} month={dashboardMonth} />
                      </div>
                    ) : (
                      <CreditCardUsage accounts={accounts} transactions={transactions} onPayBill={(toId, amount) => setTransferenciaModal({ open: true, prefillToId: toId, prefillAmount: amount })} />
                    );
                  })()}

                  {/* Bloco 6 — Metas (oculto se não houver metas ativas) */}
                  {goals.some(g => g.currentAmount < g.targetAmount) && (
                    <GoalsSummary goals={goals} onSeeAll={() => setActiveTab('goals')} />
                  )}

                  {/* Bloco 7 — Gráficos */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <FluxoCaixaChart transactions={transactions} darkMode={darkMode} />
                    <GastosCategoriaChart transactions={transactions} categories={categories} month={dashboardMonth} darkMode={darkMode} />
                  </div>

                  {/* Bloco 8 — Lembretes + Recentes (lembretes só aparecem se houver nos próximos 7 dias) */}
                  {(() => {
                    const now = new Date();
                    const nextWeek = new Date(); nextWeek.setDate(now.getDate() + 7);
                    const hasUpcoming = reminders.some(r => r.dueDate.toDate() <= nextWeek);
                    return hasUpcoming ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <UpcomingReminders reminders={reminders} categories={categories} accounts={accounts} userId={user.uid} onRefresh={fetchAllData} />
                        <RecentTransactions transactions={transactions} categories={categories} accounts={accounts} month={dashboardMonth} onSeeAll={() => setActiveTab('transactions')} />
                      </div>
                    ) : (
                      <RecentTransactions transactions={transactions} categories={categories} accounts={accounts} month={dashboardMonth} onSeeAll={() => setActiveTab('transactions')} />
                    );
                  })()}
                </motion.div>
              )}

              {activeTab === 'transactions' && (
                <motion.div key="transactions" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <TransactionManager transactions={transactions} categories={categories} accounts={accounts} onRefresh={fetchAllData} userId={user?.uid || ''} />
                </motion.div>
              )}

              {activeTab === 'fatura' && (
                <motion.div key="fatura" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <FaturaView
                    accounts={accounts}
                    transactions={transactions}
                    categories={categories}
                    onPayBill={(toId, amount) => setTransferenciaModal({ open: true, prefillToId: toId, prefillAmount: amount })}
                    onRefresh={fetchAllData}
                  />
                </motion.div>
              )}

              {activeTab === 'investments' && (
                <motion.div key="investments" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <InvestmentsView
                    banks={banks}
                    accounts={accounts}
                    transactions={transactions}
                    onAporte={(accId) => setTransferenciaModal({ open: true, prefillToId: accId })}
                    onTransfer={() => setTransferenciaModal({ open: true })}
                    onAddTransaction={() => setIsAddModalOpen(true)}
                  />
                </motion.div>
              )}

              {activeTab === 'analytics' && (
                <motion.div key="analytics" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <AnalyticsView />
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
                  <AccountManager banks={banks} accounts={accounts} transactions={transactions} reminders={reminders} userId={user.uid} onRefresh={fetchAllData} />
                </motion.div>
              )}

              {activeTab === 'calendar' && (
                <motion.div key="calendar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <CalendarView reminders={reminders} transactions={transactions} categories={categories} accounts={accounts} onRefresh={fetchAllData} />
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

              {activeTab === 'settings' && (
                <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <SettingsView
                    user={user}
                    profile={profile}
                    onProfileUpdate={async (data) => { await usersApi.updateMe(data); }}
                  />
                </motion.div>
              )}

              {activeTab === 'health' && (
                <motion.div key="health" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <HealthView transactions={transactions} accounts={accounts} />
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
    </PlanProvider>
  );
}
