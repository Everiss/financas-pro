import { Module } from '@nestjs/common';
import { FaturaImportController } from './fatura-import.controller';
import { FaturaImportService } from './fatura-import.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FaturaImportController],
  providers: [FaturaImportService],
})
export class FaturaImportModule {}
