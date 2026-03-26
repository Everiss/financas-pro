import { Module } from '@nestjs/common';
import { CouponScannerController } from './coupon-scanner.controller';
import { CouponScannerService } from './coupon-scanner.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CouponScannerController],
  providers: [CouponScannerService],
})
export class CouponScannerModule {}
