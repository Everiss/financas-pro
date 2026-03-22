import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class DepositGoalDto {
  @ApiProperty({ example: 500 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: 'Conta de onde sairá o dinheiro (opcional)' })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
