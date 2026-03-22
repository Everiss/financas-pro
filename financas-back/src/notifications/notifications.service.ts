import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationSeverity = 'danger' | 'warning' | 'info' | 'success';
export type NotificationType =
  | 'reminder_overdue'
  | 'reminder_due'
  | 'budget_exceeded'
  | 'goal_reached'
  | 'debt_due';

export interface AppNotification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  description: string;
  tab?: string;
  amount?: number;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string): Promise<AppNotification[]> {
    const notifications: AppNotification[] = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in3Days = new Date(todayStart);
    in3Days.setDate(in3Days.getDate() + 3);

    // ── 1. Lembretes vencidos ───────────────────────────────────────────────
    const overdueReminders = await this.prisma.reminder.findMany({
      where: { userId, dueDate: { lt: todayStart } },
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

    // ── 2. Lembretes a vencer nos próximos 3 dias ───────────────────────────
    const upcomingReminders = await this.prisma.reminder.findMany({
      where: { userId, dueDate: { gte: todayStart, lte: in3Days } },
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

    // ── 3. Categorias acima do orçamento (mês corrente) ────────────────────
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const categoriesWithBudget = await this.prisma.category.findMany({
      where: { userId, budget: { not: null } },
    });

    if (categoriesWithBudget.length > 0) {
      const spending = await this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          userId,
          type: 'expense',
          date: { gte: monthStart, lte: monthEnd },
          categoryId: { in: categoriesWithBudget.map((c) => c.id) },
        },
        _sum: { amount: true },
      });

      for (const cat of categoriesWithBudget) {
        const spent = spending.find((s) => s.categoryId === cat.id)?._sum?.amount ?? 0;
        const budget = Number(cat.budget);
        const spentNum = Number(spent);
        if (spentNum > budget) {
          const pct = Math.round((spentNum / budget) * 100);
          notifications.push({
            id: `budget_exceeded_${cat.id}`,
            type: 'budget_exceeded',
            severity: 'warning',
            title: `Orçamento de "${cat.name}" ultrapassado`,
            description: `Gasto R$ ${spentNum.toFixed(2)} de R$ ${budget.toFixed(2)} (${pct}%)`,
            tab: 'categories',
            amount: spentNum,
          });
        }
      }
    }

    // ── 4. Metas atingidas ─────────────────────────────────────────────────
    const reachedGoals = await this.prisma.goal.findMany({
      where: { userId },
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

    // ── 5. Empréstimos / financiamentos com vencimento próximo ─────────────
    const today = now.getDate();
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

    // ── Ordenação: danger primeiro, depois warning, info, success ──────────
    const order: NotificationSeverity[] = ['danger', 'warning', 'info', 'success'];
    notifications.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

    return notifications;
  }
}
