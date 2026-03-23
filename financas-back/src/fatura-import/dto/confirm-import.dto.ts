import { IsArray, IsString, IsIn, IsOptional, ValidateNested, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class ExtractedItemDto {
  @IsDateString() date: string;
  @IsString() description: string;
  @IsNumber() amount: number;
}

class ConfirmItemDto {
  @ValidateNested() @Type(() => ExtractedItemDto) extracted: ExtractedItemDto;
  @IsIn(['link', 'create', 'skip']) action: 'link' | 'create' | 'skip';
  @IsOptional() @IsString() matchId?: string;
  @IsOptional() @IsString() categoryId?: string;
}

export class ConfirmImportDto {
  @IsString() accountId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ConfirmItemDto) items: ConfirmItemDto[];
}
