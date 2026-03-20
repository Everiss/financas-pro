import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiCacheService {
  constructor(private prisma: PrismaService) {}

  async invalidate(userId: string): Promise<void> {
    await this.prisma.aiInsightCache.upsert({
      where: { userId },
      create: { userId, isDirty: true },
      update: { isDirty: true },
    });
  }
}
