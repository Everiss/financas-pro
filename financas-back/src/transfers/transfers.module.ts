import { Module } from '@nestjs/common';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
