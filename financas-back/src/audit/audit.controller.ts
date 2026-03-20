import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AuditService } from './audit.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { AuditAction, AuditEntity } from '@prisma/client';

@UseGuards(FirebaseAuthGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  findAll(
    @Request() req: any,
    @Query('entity') entity?: AuditEntity,
    @Query('action') action?: AuditAction,
    @Query('limit') limit?: string,
  ) {
    return this.audit.findAll(req.user.id, {
      entity,
      action,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }
}
