import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { randomUUID } from 'crypto';

const DEFAULTS = {
  emailNotifications: true,
  weeklyReport: true,
  monthlyReport: true,
  pushNotifications: true,
  reminderAdvanceDays: 3,
  reminderFrequency: 'daily',
  budgetAlertThreshold: 80,
  lowBalanceAlert: 100,
  largeTransactionAlert: 500,
  creditUsageAlert: 70,
  emergencyFundMonths: 6,
  savingsRateTarget: 20,
  debtIncomeLimit: 30,
  riskProfile: 'moderate',
  rebalanceAlert: true,
  rebalanceThreshold: 5,
  fixedIncomeTarget: 40,
  variableTarget: 40,
  internationalTarget: 20,
  showMarketNews: true,
  showEconomicNews: true,
  showPersonalTips: true,
};

function mapRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    emailNotifications: !!row.email_notifications,
    weeklyReport: !!row.weekly_report,
    monthlyReport: !!row.monthly_report,
    pushNotifications: !!row.push_notifications,
    reminderAdvanceDays: Number(row.reminder_advance_days),
    reminderFrequency: row.reminder_frequency,
    budgetAlertThreshold: Number(row.budget_alert_threshold),
    lowBalanceAlert: Number(row.low_balance_alert),
    largeTransactionAlert: Number(row.large_transaction_alert),
    creditUsageAlert: Number(row.credit_usage_alert),
    emergencyFundMonths: Number(row.emergency_fund_months),
    savingsRateTarget: Number(row.savings_rate_target),
    debtIncomeLimit: Number(row.debt_income_limit),
    riskProfile: row.risk_profile,
    rebalanceAlert: !!row.rebalance_alert,
    rebalanceThreshold: Number(row.rebalance_threshold),
    fixedIncomeTarget: Number(row.fixed_income_target),
    variableTarget: Number(row.variable_target),
    internationalTarget: Number(row.international_target),
    showMarketNews: !!row.show_market_news,
    showEconomicNews: !!row.show_economic_news,
    showPersonalTips: !!row.show_personal_tips,
  };
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getOrCreate(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM `user_settings` WHERE `user_id` = ? LIMIT 1',
      userId,
    );
    if (rows.length > 0) return mapRow(rows[0]);

    // Create with defaults
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO `user_settings` (`id`, `user_id`, `updated_at`) VALUES (?, ?, NOW())',
      id, userId,
    );
    const created = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM `user_settings` WHERE `id` = ? LIMIT 1', id,
    );
    return mapRow(created[0]);
  }

  async update(userId: string, dto: UpdateSettingsDto) {
    await this.getOrCreate(userId); // ensure row exists

    const fields: string[] = [];
    const values: any[] = [];

    const colMap: Record<string, string> = {
      emailNotifications: 'email_notifications',
      weeklyReport: 'weekly_report',
      monthlyReport: 'monthly_report',
      pushNotifications: 'push_notifications',
      reminderAdvanceDays: 'reminder_advance_days',
      reminderFrequency: 'reminder_frequency',
      budgetAlertThreshold: 'budget_alert_threshold',
      lowBalanceAlert: 'low_balance_alert',
      largeTransactionAlert: 'large_transaction_alert',
      creditUsageAlert: 'credit_usage_alert',
      emergencyFundMonths: 'emergency_fund_months',
      savingsRateTarget: 'savings_rate_target',
      debtIncomeLimit: 'debt_income_limit',
      riskProfile: 'risk_profile',
      rebalanceAlert: 'rebalance_alert',
      rebalanceThreshold: 'rebalance_threshold',
      fixedIncomeTarget: 'fixed_income_target',
      variableTarget: 'variable_target',
      internationalTarget: 'international_target',
      showMarketNews: 'show_market_news',
      showEconomicNews: 'show_economic_news',
      showPersonalTips: 'show_personal_tips',
    };

    for (const [key, col] of Object.entries(colMap)) {
      if ((dto as any)[key] !== undefined) {
        fields.push(`\`${col}\` = ?`);
        values.push((dto as any)[key]);
      }
    }

    if (fields.length === 0) return this.getOrCreate(userId);

    fields.push('`updated_at` = NOW()');
    values.push(userId);

    await this.prisma.$executeRawUnsafe(
      `UPDATE \`user_settings\` SET ${fields.join(', ')} WHERE \`user_id\` = ?`,
      ...values,
    );

    return this.getOrCreate(userId);
  }
}
