import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiCacheService } from '../ai/ai-cache.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { DepositGoalDto } from './dto/deposit-goal.dto';

@Injectable()
export class GoalsService {
  constructor(
    private prisma: PrismaService,
    private aiCache: AiCacheService,
  ) {}

  async findAll(userId: string) {
    const goals = await this.prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return goals.map((g) => ({
      ...g,
      progressPercent: Math.min(100, Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 100)),
    }));
  }

  async findOne(id: string, userId: string) {
    const goal = await this.prisma.goal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundException('Meta não encontrada.');
    if (goal.userId !== userId) throw new ForbiddenException();
    return goal;
  }

  async create(userId: string, dto: CreateGoalDto) {
    const goal = await this.prisma.goal.create({
      data: {
        ...dto,
        ...(dto.deadline && { deadline: new Date(dto.deadline) }),
        userId,
      },
    });
    await this.aiCache.invalidate(userId);
    return goal;
  }

  async update(id: string, userId: string, dto: UpdateGoalDto) {
    await this.findOne(id, userId);
    const goal = await this.prisma.goal.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.deadline && { deadline: new Date(dto.deadline) }),
      },
    });
    await this.aiCache.invalidate(userId);
    return goal;
  }

  async deposit(id: string, userId: string, dto: DepositGoalDto) {
    await this.findOne(id, userId);
    const goal = await this.prisma.goal.update({
      where: { id },
      data: { currentAmount: { increment: dto.amount } },
    });
    await this.aiCache.invalidate(userId);
    return goal;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.goal.delete({ where: { id } });
    await this.aiCache.invalidate(userId);
    return { message: 'Meta removida com sucesso.' };
  }
}
