import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiCacheService } from '../ai/ai-cache.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(
    private prisma: PrismaService,
    private aiCache: AiCacheService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.bankAccount.findMany({
      where: { userId },
      include: { bank: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const account = await this.prisma.bankAccount.findUnique({
      where: { id },
      include: { bank: true },
    });
    if (!account) throw new NotFoundException('Conta não encontrada.');
    if (account.userId !== userId) throw new ForbiddenException();
    return account;
  }

  async create(userId: string, dto: CreateAccountDto) {
    const account = await this.prisma.bankAccount.create({ data: { ...dto, userId } });
    await this.aiCache.invalidate(userId);
    return account;
  }

  async update(id: string, userId: string, dto: UpdateAccountDto) {
    await this.findOne(id, userId);
    const account = await this.prisma.bankAccount.update({ where: { id }, data: dto });
    await this.aiCache.invalidate(userId);
    return account;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.bankAccount.delete({ where: { id } });
    await this.aiCache.invalidate(userId);
    return { message: 'Conta removida com sucesso.' };
  }

  async getStatement(id: string, userId: string, month?: string) {
    await this.findOne(id, userId);
    const where: any = { accountId: id };
    if (month) {
      const start = new Date(`${month}-01`);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
      where.date = { gte: start, lte: end };
    }
    return this.prisma.transaction.findMany({
      where,
      include: { category: true },
      orderBy: { date: 'desc' },
    });
  }
}
