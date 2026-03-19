import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GoalCategory } from '@prisma/client';
import { IsDateString, IsEnum, IsHexColor, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateGoalDto {
  @ApiProperty({ example: 'Viagem para Europa' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 10000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  targetAmount: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  currentAmount?: number;

  @ApiPropertyOptional({ example: '2027-12-31' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiProperty({ enum: GoalCategory })
  @IsEnum(GoalCategory)
  category: GoalCategory;

  @ApiPropertyOptional({ example: '#3b82f6' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 'Plane' })
  @IsOptional()
  @IsString()
  icon?: string;
}
