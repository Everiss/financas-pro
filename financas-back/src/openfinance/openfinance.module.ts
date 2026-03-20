import { Module } from '@nestjs/common';
import { OpenFinanceService } from './openfinance.service';
import { OpenFinanceController } from './openfinance.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [OpenFinanceService],
  controllers: [OpenFinanceController],
})
export class OpenFinanceModule {}
