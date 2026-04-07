import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface AlertEmailData {
  userName: string;
  notifications: Array<{
    title: string;
    description: string;
    severity: 'danger' | 'warning' | 'info' | 'success';
  }>;
}

export interface WeeklyReportData {
  userName: string;
  weekLabel: string;
  income: number;
  expenses: number;
  balance: number;
  topCategories: Array<{ name: string; amount: number; pct: number }>;
  prevWeekExpenses: number;
}

export interface MonthlyReportData {
  userName: string;
  monthLabel: string;
  income: number;
  expenses: number;
  savingsRate: number;
  healthScore: number;
  topCategories: Array<{ name: string; amount: number; pct: number }>;
  goalsProgress: Array<{ name: string; pct: number; completed: boolean }>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = this.config.get('SMTP_HOST');
    if (!host) {
      this.logger.warn('SMTP_HOST não configurado — emails desativados');
      return;
    }
    this.transporter = nodemailer.createTransport({
      host,
      port:   Number(this.config.get('SMTP_PORT') ?? 587),
      secure: Number(this.config.get('SMTP_PORT') ?? 587) === 465,
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });
  }

  private get from() {
    return this.config.get('SMTP_FROM') ?? 'Finanças Pro <noreply@financaspro.com.br>';
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.debug(`[EMAIL MOCK] To: ${to} | ${subject}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      this.logger.log(`Email enviado para ${to}: ${subject}`);
    } catch (err) {
      this.logger.error(`Erro ao enviar email para ${to}: ${err}`);
    }
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  async sendAlerts(to: string, data: AlertEmailData): Promise<void> {
    const severityColor: Record<string, string> = {
      danger:  '#ef4444',
      warning: '#f59e0b',
      info:    '#3b82f6',
      success: '#10b981',
    };
    const severityLabel: Record<string, string> = {
      danger: 'Urgente', warning: 'Atenção', info: 'Info', success: 'Conquista',
    };

    const rows = data.notifications.map(n => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;color:#fff;background:${severityColor[n.severity]};margin-bottom:4px;">
            ${severityLabel[n.severity]}
          </span>
          <div style="font-weight:600;color:#1e293b;font-size:14px;">${n.title}</div>
          <div style="color:#64748b;font-size:13px;margin-top:2px;">${n.description}</div>
        </td>
      </tr>`).join('');

    const html = baseTemplate(`
      <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;">Alertas Financeiros</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Olá, <strong>${data.userName}</strong>! Você tem ${data.notifications.length} alerta(s) que precisam da sua atenção.</p>
      <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        ${rows}
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
        Acesse o app para ver detalhes e tomar ações.
      </p>
    `);

    await this.send(to, `🔔 ${data.notifications.length} alerta(s) — Finanças Pro`, html);
  }

  async sendWeeklyReport(to: string, data: WeeklyReportData): Promise<void> {
    const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
    const diff = data.expenses - data.prevWeekExpenses;
    const diffSign = diff >= 0 ? '+' : '';
    const diffColor = diff <= 0 ? '#10b981' : '#ef4444';

    const catRows = data.topCategories.map(c => `
      <tr>
        <td style="padding:8px 16px;font-size:13px;color:#334155;">${c.name}</td>
        <td style="padding:8px 16px;text-align:right;font-size:13px;font-weight:600;color:#1e293b;">${fmt(c.amount)}</td>
        <td style="padding:8px 16px;text-align:right;font-size:13px;color:#64748b;">${c.pct.toFixed(0)}%</td>
      </tr>`).join('');

    const html = baseTemplate(`
      <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;">Relatório Semanal</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Olá, <strong>${data.userName}</strong>! Aqui está o resumo da semana <strong>${data.weekLabel}</strong>.</p>

      <div style="display:flex;gap:12px;margin-bottom:24px;">
        ${kpiCard('Receitas', fmt(data.income), '#10b981')}
        ${kpiCard('Despesas', fmt(data.expenses), '#ef4444')}
        ${kpiCard('Saldo', fmt(data.balance), data.balance >= 0 ? '#3b82f6' : '#ef4444')}
      </div>

      <div style="margin-bottom:24px;padding:12px 16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
        <span style="font-size:13px;color:#64748b;">Variação vs semana anterior: </span>
        <span style="font-size:13px;font-weight:700;color:${diffColor};">${diffSign}${fmt(diff)}</span>
      </div>

      <h3 style="margin:0 0 12px;font-size:15px;color:#1e293b;">Top Categorias</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">CATEGORIA</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;color:#64748b;font-weight:600;">VALOR</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;color:#64748b;font-weight:600;">%</th>
          </tr>
        </thead>
        <tbody>${catRows}</tbody>
      </table>
    `);

    await this.send(to, `📊 Relatório Semanal ${data.weekLabel} — Finanças Pro`, html);
  }

  async sendMonthlyReport(to: string, data: MonthlyReportData): Promise<void> {
    const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

    const scoreColor = data.healthScore >= 75 ? '#10b981' : data.healthScore >= 50 ? '#3b82f6' : data.healthScore >= 25 ? '#f59e0b' : '#ef4444';

    const catRows = data.topCategories.map(c => `
      <tr>
        <td style="padding:8px 16px;font-size:13px;color:#334155;">${c.name}</td>
        <td style="padding:8px 16px;text-align:right;font-weight:600;color:#1e293b;">${fmt(c.amount)}</td>
        <td style="padding:8px 16px;text-align:right;color:#64748b;">${c.pct.toFixed(0)}%</td>
      </tr>`).join('');

    const goalRows = data.goalsProgress.map(g => `
      <tr>
        <td style="padding:8px 16px;font-size:13px;color:#334155;">${g.name}</td>
        <td style="padding:8px 16px;text-align:right;">
          ${g.completed
            ? '<span style="color:#10b981;font-weight:700;">✓ Concluída</span>'
            : `<div style="background:#e2e8f0;border-radius:9999px;height:8px;"><div style="background:#3b82f6;border-radius:9999px;height:8px;width:${g.pct}%;"></div></div><span style="font-size:12px;color:#64748b;">${g.pct}%</span>`}
        </td>
      </tr>`).join('');

    const html = baseTemplate(`
      <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;">Relatório Mensal</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Olá, <strong>${data.userName}</strong>! Resumo completo de <strong>${data.monthLabel}</strong>.</p>

      <div style="display:flex;gap:12px;margin-bottom:24px;">
        ${kpiCard('Receitas', fmt(data.income), '#10b981')}
        ${kpiCard('Despesas', fmt(data.expenses), '#ef4444')}
        ${kpiCard('Taxa de Poupança', `${data.savingsRate.toFixed(1)}%`, data.savingsRate >= 20 ? '#10b981' : '#f59e0b')}
      </div>

      <div style="margin-bottom:24px;text-align:center;padding:20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
        <div style="font-size:48px;font-weight:800;color:${scoreColor};">${data.healthScore}</div>
        <div style="font-size:13px;color:#64748b;margin-top:4px;">Score de Saúde Financeira</div>
      </div>

      <h3 style="margin:0 0 12px;font-size:15px;color:#1e293b;">Top Categorias</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <tbody>${catRows}</tbody>
      </table>

      ${data.goalsProgress.length > 0 ? `
      <h3 style="margin:0 0 12px;font-size:15px;color:#1e293b;">Metas</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tbody>${goalRows}</tbody>
      </table>` : ''}
    `);

    await this.send(to, `📈 Relatório Mensal ${data.monthLabel} — Finanças Pro`, html);
  }
}

// ── Helpers de template ────────────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#1d4ed8);padding:24px 32px;">
            <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">💰 Finanças Pro</span>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:32px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Você está recebendo este email pois ativou notificações no Finanças Pro.<br>
              Para cancelar, acesse Configurações → Comunicação.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function kpiCard(label: string, value: string, color: string): string {
  return `<div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
    <div style="font-size:20px;font-weight:800;color:${color};">${value}</div>
    <div style="font-size:12px;color:#64748b;margin-top:4px;">${label}</div>
  </div>`;
}
