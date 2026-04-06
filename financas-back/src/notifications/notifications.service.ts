import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationSeverity = 'danger' | 'warning' | 'info' | 'success';
export type NotificationType =
  | 'reminder_overdue'
  | 'reminder_due'
  | 'budget_exceeded'
  | 'budget_alert'
  | 'goal_reached'
  | 'debt_due'
  | 'low_balance'
  | 'large_transaction'
  | 'credit_usage_alert'
  | 'rebalance_needed';

export interface AppNotification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  description: string;
  tab?: string;
  amount?: number;
}

// Defaults usados quando o usuário ainda não tem settings cadastradas
const SETTINGS_DEFAULTS = {
  reminderAdvanceDays: 3,
  budgetAlertThreshold: 80,
  lowBalanceAlert: 100,
  largeTransactionAlert: 500,
  creditUsageAlert: 70,
  rebalanceAlert: true,
  rebalanceThreshold: 5,
  fixedIncomeTarget: 40,
  variableTarget: 40,
  internationalTarget: 20,
};

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string): Promise<AppNotification[]> {
    const notifications: AppNotification[] = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // ── Carrega settings do usuário (usa defaults se não existir) ─────────────
    const rawSettings = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM `user_settings` WHERE `user_id` = ? LIMIT 1',
      userId,
    );
    const s = rawSettings[0] ?? {};
    const settings = {
      reminderAdvanceDays:    Number(s.reminder_advance_days    ?? SETTINGS_DEFAULTS.reminderAdvanceDays),
      budgetAlertThreshold:   Number(s.budget_alert_threshold   ?? SETTINGS_DEFAULTS.budgetAlertThreshold),
      lowBalanceAlert:        Number(s.low_balance_alert        ?? SETTINGS_DEFAULTS.lowBalanceAlert),
      largeTransactionAlert:  Number(s.large_transaction_alert  ?? SETTINGS_DEFAULTS.largeTransactionAlert),
      creditUsageAlert:       Number(s.credit_usage_alert       ?? SETTINGS_DEFAULTS.creditUsageAlert),
      rebalanceAlert:         !!(s.rebalance_alert              ?? SETTINGS_DEFAULTS.rebalanceAlert),
      rebalanceThreshold:     Number(s.rebalance_threshold      ?? SETTINGS_DEFAULTS.rebalanceThreshold),
      fixedIncomeTarget:      Number(s.fixed_income_target      ?? SETTINGS_DEFAULTS.fixedIncomeTarget),
      variableTarget:         Number(s.variable_target          ?? SETTINGS_DEFAULTS.variableTarget),
      internationalTarget:    Number(s.international_target     ?? SETTINGS_DEFAULTS.internationalTarget),
    };

    // Janela de antecedência de lembretes (configurável)
    const inAdvance = new Date(todayStart);
    inAdvance.setDate(inAdvance.getDate() + settings.reminderAdvanceDays);

    // ── 1. Lembretes vencidos ─────────────────────────────────────────────────
    const overdueReminders = await this.prisma.reminder.findMany({
      where: { userId, dueDate: { lt: todayStart }, completedAt: null },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    for (const r of overdueReminders) {
      const daysAgo = Math.ceil((todayStart.getTime() - r.dueDate.getTime()) / 86_400_000);
      notifications.push({
        id: `reminder_overdue_${r.id}`,
        type: 'reminder_overdue',
        severity: 'danger',
        title: `Lembrete vencido: ${r.title}`,
        description: `Venceu há ${daysAgo} dia${daysAgo > 1 ? 's' : ''} — R$ ${Number(r.amount).toFixed(2)}`,
        tab: 'reminders',
        amount: Number(r.amount),
      });
    }

    // ── 2. Lembretes a vencer (dentro da janela configurada) ──────────────────
    const upcomingReminders = await this.prisma.reminder.findMany({
      where: { userId, dueDate: { gte: todayStart, lte: inAdvance }, completedAt: null },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    for (const r of upcomingReminders) {
      const daysUntil = Math.ceil((r.dueDate.getTime() - todayStart.getTime()) / 86_400_000);
      const when = daysUntil === 0 ? 'Vence hoje' : daysUntil === 1 ? 'Vence amanhã' : `Vence em ${daysUntil} dias`;
      notifications.push({
        id: `reminder_due_${r.id}`,
        type: 'reminder_due',
        severity: daysUntil === 0 ? 'warning' : 'info',
        title: r.title,
        description: `${when} — R$ ${Number(r.amount).toFixed(2)}`,
        tab: 'reminders',
        amount: Number(r.amount),
      });
    }

    // ── 3. Orçamento por categoria (mês corrente) ─────────────────────────────
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const threshold  = settings.budgetAlertThreshold / 100; // ex: 80% → 0.80

    const categoriesWithBudget = await this.prisma.category.findMany({
      where: { userId, budget: { not: null } },
    });

    if (categoriesWithBudget.length > 0) {
      const spending = await this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          userId,
          type: 'expense',
          isPending: false,
          date: { gte: monthStart, lte: monthEnd },
          categoryId: { in: categoriesWithBudget.map((c) => c.id) },
        },
        _sum: { amount: true },
      });

      for (const cat of categoriesWithBudget) {
        const spent  = Number(spending.find((s) => s.categoryId === cat.id)?._sum?.amount ?? 0);
        const budget = Number(cat.budget);
        const pct    = spent / budget;

        if (pct >= 1) {
          // Orçamento estourado
          notifications.push({
            id: `budget_exceeded_${cat.id}`,
            type: 'budget_exceeded',
            severity: 'warning',
            title: `Orçamento de "${cat.name}" ultrapassado`,
            description: `Gasto R$ ${spent.toFixed(2)} de R$ ${budget.toFixed(2)} (${Math.round(pct * 100)}%)`,
            tab: 'categories',
            amount: spent,
          });
        } else if (pct >= threshold) {
          // Atingiu o limiar configurado (ex: 80%)
          notifications.push({
            id: `budget_alert_${cat.id}`,
            type: 'budget_alert',
            severity: 'info',
            title: `Orçamento de "${cat.name}" em ${Math.round(pct * 100)}%`,
            description: `R$ ${spent.toFixed(2)} de R$ ${budget.toFixed(2)} — limite: ${settings.budgetAlertThreshold}%`,
            tab: 'categories',
            amount: spent,
          });
        }
      }
    }

    // ── 4. Metas atingidas (apenas as não marcadas como concluídas) ───────────
    const reachedGoals = await this.prisma.goal.findMany({
      where: { userId, completedAt: null },
    });

    for (const g of reachedGoals) {
      if (Number(g.currentAmount) >= Number(g.targetAmount)) {
        notifications.push({
          id: `goal_reached_${g.id}`,
          type: 'goal_reached',
          severity: 'success',
          title: `Meta atingida: ${g.name}`,
          description: `Parabéns! Você alcançou R$ ${Number(g.targetAmount).toFixed(2)}`,
          tab: 'goals',
          amount: Number(g.currentAmount),
        });
      }
    }

    // ── 5. Empréstimos / financiamentos com vencimento próximo ────────────────
    const today    = now.getDate();
    const tomorrow = today + 1;

    const debtAccounts = await this.prisma.bankAccount.findMany({
      where: { userId, type: { in: ['loan', 'financing'] }, dueDay: { in: [today, tomorrow] } },
    });

    for (const acc of debtAccounts) {
      const typeLabel = acc.type === 'financing' ? 'Financiamento' : 'Empréstimo';
      const when = acc.dueDay === today ? 'Vence hoje' : 'Vence amanhã';
      notifications.push({
        id: `debt_due_${acc.id}`,
        type: 'debt_due',
        severity: acc.dueDay === today ? 'warning' : 'info',
        title: `${typeLabel}: ${acc.name}`,
        description: `${when} — Saldo devedor R$ ${Number(acc.balance).toFixed(2)}`,
        tab: 'accounts',
        amount: Number(acc.balance),
      });
    }

    // ── 6. Saldo baixo em contas (não crédito) ────────────────────────────────
    if (settings.lowBalanceAlert > 0) {
      const lowBalanceAccounts = await this.prisma.bankAccount.findMany({
        where: {
          userId,
          type: { in: ['checking', 'savings'] },
          balance: { lt: settings.lowBalanceAlert },
        },
      });

      for (const acc of lowBalanceAccounts) {
        notifications.push({
          id: `low_balance_${acc.id}`,
          type: 'low_balance',
          severity: Number(acc.balance) <= 0 ? 'danger' : 'warning',
          title: `Saldo baixo: ${acc.name}`,
          description: `Saldo atual R$ ${Number(acc.balance).toFixed(2)} abaixo do mínimo de R$ ${settings.lowBalanceAlert.toFixed(2)}`,
          tab: 'accounts',
          amount: Number(acc.balance),
        });
      }
    }

    // ── 7. Transações grandes (últimos 7 dias) ────────────────────────────────
    if (settings.largeTransactionAlert > 0) {
      const sevenDaysAgo = new Date(todayStart);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const largeTxs = await this.prisma.transaction.findMany({
        where: {
          userId,
          type: 'expense',
          isPending: false,
          isTransfer: false,
          amount: { gte: settings.largeTransactionAlert },
          date: { gte: sevenDaysAgo },
        },
        orderBy: { amount: 'desc' },
        take: 5,
        include: { category: true },
      });

      for (const t of largeTxs) {
        notifications.push({
          id: `large_tx_${t.id}`,
          type: 'large_transaction',
          severity: 'info',
          title: `Transação alta: ${t.description ?? 'Sem descrição'}`,
          description: `R$ ${Number(t.amount).toFixed(2)} em ${(t.category as any)?.name ?? 'Outros'} — ${new Date(t.date).toLocaleDateString('pt-BR')}`,
          tab: 'transactions',
          amount: Number(t.amount),
        });
      }
    }

    // ── 8. Uso de crédito acima do limiar ─────────────────────────────────────
    if (settings.creditUsageAlert > 0) {
      const creditCards = await this.prisma.bankAccount.findMany({
        where: { userId, type: 'credit', creditLimit: { not: null } },
      });

      for (const card of creditCards) {
        const limit = Number(card.creditLimit);
        if (limit <= 0) continue;
        const usage = (Number(card.balance) / limit) * 100;
        if (usage >= settings.creditUsageAlert) {
          notifications.push({
            id: `credit_usage_${card.id}`,
            type: 'credit_usage_alert',
            severity: usage >= 90 ? 'danger' : 'warning',
            title: `Uso elevado: ${card.name}`,
            description: `${Math.round(usage)}% do limite utilizado — R$ ${Number(card.balance).toFixed(2)} de R$ ${limit.toFixed(2)}`,
            tab: 'accounts',
            amount: Number(card.balance),
          });
        }
      }
    }

    // ── 9. Rebalanceamento de portfólio ───────────────────────────────────────
    if (settings.rebalanceAlert) {
      const investmentAccounts = await this.prisma.bankAccount.findMany({
        where: { userId, type: 'investment' },
      });

      const totalInvested = investmentAccounts.reduce((s, a) => s + Number(a.balance), 0);

      if (totalInvested > 0) {
        // Classifica contas em fixo, variável e internacional por investmentType
        const FIXED_TYPES  = ['cdb', 'tesouro', 'previdencia'];
        const VAR_TYPES    = ['stock', 'fund', 'fii', 'crypto'];
        const INTL_TYPES   = ['other']; // usa 'other' para internacional neste modelo

        const fixed = investmentAccounts
          .filter(a => FIXED_TYPES.includes(a.investmentType ?? ''))
          .reduce((s, a) => s + Number(a.balance), 0);
        const variable = investmentAccounts
          .filter(a => VAR_TYPES.includes(a.investmentType ?? ''))
          .reduce((s, a) => s + Number(a.balance), 0);

        const actualFixed    = (fixed    / totalInvested) * 100;
        const actualVariable = (variable / totalInvested) * 100;

        const deviations = [
          { label: 'Renda Fixa',    actual: actualFixed,    target: settings.fixedIncomeTarget },
          { label: 'Renda Variável', actual: actualVariable, target: settings.variableTarget },
        ];

        for (const d of deviations) {
          const deviation = Math.abs(d.actual - d.target);
          if (deviation >= settings.rebalanceThreshold) {
            const direction = d.actual > d.target ? 'acima' : 'abaixo';
            notifications.push({
              id: `rebalance_${d.label.replace(/\s+/g, '_')}`,
              type: 'rebalance_needed',
              severity: 'info',
              title: `Rebalanceamento: ${d.label}`,
              description: `${Math.round(d.actual)}% atual vs ${d.target}% alvo — ${Math.round(deviation)}% ${direction} do esperado`,
              tab: 'investments',
              amount: totalInvested,
            });
          }
        }
      }
    }

    // ── Ordenação: danger → warning → info → success ──────────────────────────
    const order: NotificationSeverity[] = ['danger', 'warning', 'info', 'success'];
    notifications.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

    return notifications;
  }
}
