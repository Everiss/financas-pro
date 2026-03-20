import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuditAction, AuditEntity } from '@prisma/client';

const METHOD_TO_ACTION: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PATCH: AuditAction.UPDATE,
  PUT: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

const PATH_TO_ENTITY: [RegExp, AuditEntity][] = [
  [/\/transactions/, AuditEntity.TRANSACTION],
  [/\/accounts/, AuditEntity.ACCOUNT],
  [/\/banks/, AuditEntity.BANK],
  [/\/goals/, AuditEntity.GOAL],
  [/\/reminders/, AuditEntity.REMINDER],
  [/\/categories/, AuditEntity.CATEGORY],
];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const action = METHOD_TO_ACTION[req.method];

    if (!action) return next.handle();

    const entity = PATH_TO_ENTITY.find(([re]) => re.test(req.path))?.[1];
    if (!entity) return next.handle();

    const userId: string | undefined = req.user?.id;
    const ip = req.ip ?? req.headers['x-forwarded-for'];
    const payload = req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : undefined;

    return next.handle().pipe(
      tap(async (response) => {
        if (!userId) return;
        const entityId: string | undefined = req.params?.id ?? response?.id;
        await this.audit.log({ userId, action, entity, entityId, payload, ip }).catch(() => null);
      }),
    );
  }
}
