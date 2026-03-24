import { Module } from '@nestjs/common';
import { CouponScannerController } from './coupon-scanner.controller';
import { CouponScannerService } from './coupon-scanner.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CouponScannerController],
  providers: [CouponScannerService],
})
export class CouponScannerModule {}
