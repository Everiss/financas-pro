import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CategoriesModule } from './categories/categories.module';
import { AccountsModule } from './accounts/accounts.module';
import { BanksModule } from './banks/banks.module';
import { GoalsModule } from './goals/goals.module';
import { RemindersModule } from './reminders/reminders.module';
import { AiModule } from './ai/ai.module';
import { AuditModule } from './audit/audit.module';
import { OpenFinanceModule } from './openfinance/openfinance.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { TransfersModule } from './transfers/transfers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TransactionsModule,
    CategoriesModule,
    AccountsModule,
    BanksModule,
    GoalsModule,
    RemindersModule,
    AiModule,
    AuditModule,
    OpenFinanceModule,
    SubscriptionModule,
    TransfersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
