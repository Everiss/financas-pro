import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty()
  @IsUUID()
  fromAccountId: string;

  @ApiProperty()
  @IsUUID()
  toAccountId: string;

  @ApiProperty({ example: 500.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: '2026-03-22' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'true quando é pagamento de fatura de cartão de crédito' })
  @IsOptional()
  @IsBoolean()
  isBillPayment?: boolean;
}
