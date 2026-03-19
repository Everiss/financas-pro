import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('insights')
  getInsights(@CurrentUser() user: User) {
    return this.aiService.getFinancialInsights(user.id);
  }

  @Post('goals-strategy')
  getGoalsStrategy(@CurrentUser() user: User) {
    return this.aiService.getGoalsStrategy(user.id);
  }
}
