import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditEntity } from '@prisma/client';

export interface LogParams {
  userId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  payload?: string;
  ip?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: LogParams): Promise<void> {
    await this.prisma.auditLog.create({ data: params });
  }

  async findAll(userId: string, filters: { entity?: AuditEntity; action?: AuditAction; limit?: number }) {
    return this.prisma.auditLog.findMany({
      where: {
        userId,
        ...(filters.entity && { entity: filters.entity }),
        ...(filters.action && { action: filters.action }),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 100,
    });
  }
}
