import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType, PaymentMethod } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ example: 150.50 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: '2026-03-19' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: 'Almoço no restaurante' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Indica transferência entre contas (exclui de receitas/despesas)' })
  @IsOptional()
  @IsBoolean()
  isTransfer?: boolean;
}
