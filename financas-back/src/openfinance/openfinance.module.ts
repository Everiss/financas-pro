import { Module } from '@nestjs/common';
import { OpenFinanceService } from './openfinance.service';
import { OpenFinanceController } from './openfinance.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanGuard } from '../subscription/plan.guard';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [OpenFinanceService, PlanGuard],
  controllers: [OpenFinanceController],
})
export class OpenFinanceModule {}
