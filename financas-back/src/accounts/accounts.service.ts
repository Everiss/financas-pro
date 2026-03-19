import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.bankAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const account = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Conta não encontrada.');
    if (account.userId !== userId) throw new ForbiddenException();
    return account;
  }

  async create(userId: string, dto: CreateAccountDto) {
    return this.prisma.bankAccount.create({ data: { ...dto, userId } });
  }

  async update(id: string, userId: string, dto: UpdateAccountDto) {
    await this.findOne(id, userId);
    return this.prisma.bankAccount.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.bankAccount.delete({ where: { id } });
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
