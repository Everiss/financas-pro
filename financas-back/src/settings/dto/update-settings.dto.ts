import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  // Comunicação
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailNotifications?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() weeklyReport?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() monthlyReport?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() pushNotifications?: boolean;

  // Lembretes
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(30) reminderAdvanceDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsIn(['daily', 'weekly']) reminderFrequency?: string;

  // Alertas
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100) budgetAlertThreshold?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) lowBalanceAlert?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) largeTransactionAlert?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100) creditUsageAlert?: number;

  // Saúde financeira
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(24) emergencyFundMonths?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(80) savingsRateTarget?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100) debtIncomeLimit?: number;

  // Investimentos
  @ApiPropertyOptional() @IsOptional() @IsIn(['conservative', 'moderate', 'aggressive']) riskProfile?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() rebalanceAlert?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(50) rebalanceThreshold?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) fixedIncomeTarget?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) variableTarget?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) internationalTarget?: number;

  // Notícias
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showMarketNews?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showEconomicNews?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showPersonalTips?: boolean;
}
