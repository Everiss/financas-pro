import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { PushService } from '../push/push.service';

@Injectable()
export class ScheduledService {
  private readonly logger = new Logger(ScheduledService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private email: EmailService,
    private push: PushService,
  ) {}

  // ── Alertas diários (todo dia às 7h) ──────────────────────────────────────
  @Cron('0 7 * * *', { name: 'daily-alerts', timeZone: 'America/Sao_Paulo' })
  async sendDailyAlerts() {
    this.logger.log('Cron: enviando alertas diários...');

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { settings: { emailNotifications: true } },
          { settings: { pushNotifications: true } },
        ],
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        settings: { select: { emailNotifications: true, pushNotifications: true } },
      },
    });

    for (const user of users) {
      try {
        const alerts = await this.notifications.getAll(user.id);
        const urgent = alerts.filter(a => a.severity === 'danger' || a.severity === 'warning');
        if (urgent.length === 0) continue;

        // Email
        if (user.settings?.emailNotifications) {
          await this.email.sendAlerts(user.email, {
            userName: user.displayName,
            notifications: urgent.map(a => ({
              title: a.title,
              description: a.description,
              severity: a.severity,
            })),
          });
        }

        // Push (envia uma notificação resumida com o alerta mais grave)
        if (user.settings?.pushNotifications) {
          const top = urgent[0];
          await this.push.sendToUser(user.id, {
            title: top.title,
            body: top.description,
            icon: '/icon-192.png',
            badge: '/icon-72.png',
            tag: top.type,
            url: top.tab ? `/${top.tab}` : '/',
          });
        }
      } catch (err) {
        this.logger.error(`Erro ao enviar alertas para ${user.email}: ${err}`);
      }
    }

    this.logger.log(`Cron: alertas diários processados para ${users.length} usuário(s)`);
  }

  // ── Relatório semanal (toda segunda às 8h) ────────────────────────────────
  @Cron('0 8 * * 1', { name: 'weekly-report', timeZone: 'America/Sao_Paulo' })
  async sendWeeklyReports() {
    this.logger.log('Cron: enviando relatórios semanais...');

    const users = await this.prisma.user.findMany({
      where: { settings: { weeklyReport: true } },
      select: { id: true, email: true, displayName: true },
    });

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - 1);

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(weekStart.getDate() - 7);

    const weekLabel = `${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

    for (const user of users) {
      try {
        const txs = await this.prisma.transaction.findMany({
          where: {
            userId: user.id,
            isTransfer: false,
            isPending: false,
            date: { gte: weekStart, lte: weekEnd },
          },
          include: { category: true },
        });

        const prevTxs = await this.prisma.transaction.findMany({
          where: {
            userId: user.id,
            isTransfer: false,
            isPending: false,
            type: 'expense',
            date: { gte: prevWeekStart, lte: weekStart },
          },
        });

        const income   = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
        const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
        const prevExpenses = prevTxs.reduce((s, t) => s + Number(t.amount), 0);

        // Agrupa por categoria
        const catMap = new Map<string, number>();
        txs.filter(t => t.type === 'expense').forEach(t => {
          const name = (t.category as any)?.name ?? 'Outros';
          catMap.set(name, (catMap.get(name) ?? 0) + Number(t.amount));
        });
        const topCategories = Array.from(catMap.entries())
          .map(([name, amount]) => ({ name, amount, pct: expenses > 0 ? (amount / expenses) * 100 : 0 }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        if (income === 0 && expenses === 0) continue; // nada a reportar

        await this.email.sendWeeklyReport(user.email, {
          userName: user.displayName,
          weekLabel,
          income,
          expenses,
          balance: income - expenses,
          topCategories,
          prevWeekExpenses: prevExpenses,
        });
      } catch (err) {
        this.logger.error(`Erro no relatório semanal para ${user.email}: ${err}`);
      }
    }
  }

  // ── Relatório mensal (1º dia do mês às 8h) ────────────────────────────────
  @Cron('0 8 1 * *', { name: 'monthly-report', timeZone: 'America/Sao_Paulo' })
  async sendMonthlyReports() {
    this.logger.log('Cron: enviando relatórios mensais...');

    const users = await this.prisma.user.findMany({
      where: { settings: { monthlyReport: true } },
      select: { id: true, email: true, displayName: true },
    });

    // Mês anterior
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const monthLabel = monthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    for (const user of users) {
      try {
        const txs = await this.prisma.transaction.findMany({
          where: {
            userId: user.id,
            isTransfer: false,
            isPending: false,
            date: { gte: monthStart, lte: monthEnd },
          },
          include: { category: true },
        });

        const income   = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
        const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
        const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

        // Top categorias
        const catMap = new Map<string, number>();
        txs.filter(t => t.type === 'expense').forEach(t => {
          const name = (t.category as any)?.name ?? 'Outros';
          catMap.set(name, (catMap.get(name) ?? 0) + Number(t.amount));
        });
        const topCategories = Array.from(catMap.entries())
          .map(([name, amount]) => ({ name, amount, pct: expenses > 0 ? (amount / expenses) * 100 : 0 }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        // Metas
        const goals = await this.prisma.goal.findMany({
          where: { userId: user.id },
          select: { name: true, targetAmount: true, currentAmount: true, completedAt: true },
        });
        const goalsProgress = goals.map(g => ({
          name: g.name,
          pct: Math.min(100, Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 100)),
          completed: !!g.completedAt,
        }));

        // Health score simplificado (sem IA, só cálculo local)
        const healthScore = calculateSimpleHealthScore(income, expenses, savingsRate);

        if (income === 0 && expenses === 0) continue;

        await this.email.sendMonthlyReport(user.email, {
          userName: user.displayName,
          monthLabel,
          income,
          expenses,
          savingsRate,
          healthScore,
          topCategories,
          goalsProgress,
        });
      } catch (err) {
        this.logger.error(`Erro no relatório mensal para ${user.email}: ${err}`);
      }
    }
  }
}

/** Score simplificado para o email mensal (sem chamar Claude) */
function calculateSimpleHealthScore(income: number, expenses: number, savingsRate: number): number {
  if (income === 0) return 0;
  const commitment = (expenses / income) * 100;
  const savingsScore    = savingsRate >= 20 ? 100 : savingsRate >= 10 ? 60 : savingsRate >= 0 ? 20 : 0;
  const commitmentScore = commitment <= 50 ? 100 : commitment <= 65 ? 70 : commitment <= 85 ? 40 : 10;
  return Math.round(savingsScore * 0.4 + commitmentScore * 0.6);
}
