import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiCacheService } from './ai-cache.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanGuard } from '../subscription/plan.guard';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [AiService, AiCacheService, PlanGuard],
  controllers: [AiController],
  exports: [AiCacheService],
})
export class AiModule {}
