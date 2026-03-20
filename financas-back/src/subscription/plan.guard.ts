import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { getEffectiveLimits, PlanLimits } from './plan.config';

export const PLAN_FEATURE_KEY = 'planFeature';

/** Decorador: @RequireFeature('ai') — bloqueia se o plano não tiver a feature */
export const RequireFeature = (feature: keyof PlanLimits) =>
  SetMetadata(PLAN_FEATURE_KEY, feature);

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<keyof PlanLimits>(
      PLAN_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!feature) return true; // sem restrição

    const req = context.switchToHttp().getRequest();
    const userId: string = req.user?.id;
    if (!userId) return false;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;

    const limits = getEffectiveLimits(user.plan as any, user.trialEndsAt);
    const allowed = limits[feature];

    if (!allowed) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        message: `Esta funcionalidade requer o plano PRO.`,
        feature,
        currentPlan: user.plan,
      });
    }

    return true;
  }
}
