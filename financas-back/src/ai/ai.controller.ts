import { Controller, Post, UseGuards, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '@prisma/client';
import { PlanGuard, RequireFeature } from '../subscription/plan.guard';
import { memoryStorage } from 'multer';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, PlanGuard)
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('insights')
  @RequireFeature('ai')
  getInsights(@CurrentUser() user: User) {
    return this.aiService.getFinancialInsights(user.id);
  }

  @Post('goals-strategy')
  @RequireFeature('ai')
  getGoalsStrategy(@CurrentUser() user: User) {
    return this.aiService.getGoalsStrategy(user.id);
  }

  @Post('extract-receipt')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  }))
  async extractReceipt(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Formato não suportado. Use JPG, PNG, GIF ou WebP.');
    }
    return this.aiService.extractReceipt(file.buffer, file.mimetype, user.id);
  }
}
