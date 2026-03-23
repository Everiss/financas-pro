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
    const { currency, ...rest } = dto as any;
    const account = await this.prisma.bankAccount.create({ data: { ...rest, userId } });
    if (currency) {
      await this.prisma.$executeRaw`UPDATE bank_accounts SET currency = ${currency} WHERE id = ${account.id}`;
    }
    await this.aiCache.invalidate(userId);
    return this.findOne(account.id, userId);
  }

  async update(id: string, userId: string, dto: UpdateAccountDto) {
    await this.findOne(id, userId);
    const { currency, ...rest } = dto as any;
    await this.prisma.bankAccount.update({ where: { id }, data: rest });
    if (currency) {
      await this.prisma.$executeRaw`UPDATE bank_accounts SET currency = ${currency} WHERE id = ${id}`;
    }
    await this.aiCache.invalidate(userId);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.bankAccount.delete({ where: { id } });
    await this.aiCache.invalidate(userId);
    return { message: 'Conta removida com sucesso.' };
  }

  async getStatement(id: string, userId: string, month?: string, startDate?: string, endDate?: string) {
    await this.findOne(id, userId);
    const where: any = { accountId: id };
    if (startDate && endDate) {
      where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    } else if (month) {
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
