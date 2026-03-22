import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType, InvestmentType } from '@prisma/client';
import { IsEnum, IsHexColor, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ example: 'Nubank' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({ example: 1500.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  balance?: number;

  @ApiPropertyOptional({ example: '#8b5cf6' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 'CreditCard' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  closingDay?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;

  @ApiPropertyOptional({ enum: InvestmentType })
  @IsOptional()
  @IsEnum(InvestmentType)
  investmentType?: InvestmentType;

  @ApiPropertyOptional({ example: 'digital' })
  @IsOptional()
  @IsString()
  subtype?: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Código ISO 4217 da moeda (padrão: BRL)' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'uuid-do-banco' })
  @IsOptional()
  @IsString()
  bankId?: string;
}
