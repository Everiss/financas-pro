import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FrequencyType, TransactionType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateReminderDto {
  @ApiProperty({ example: 'Aluguel' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 1200 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: '2026-04-05' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ enum: FrequencyType })
  @IsEnum(FrequencyType)
  frequency: FrequencyType;

  @ApiPropertyOptional({ example: 'Pagar até dia 5' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
