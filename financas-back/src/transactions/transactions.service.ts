import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, query: QueryTransactionDto) {
    const where: Prisma.TransactionWhereInput = { userId };

    if (query.type) where.type = query.type;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.accountId) where.accountId = query.accountId;
    if (query.startDate || query.endDate) {
      where.date = {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      };
    }

    return this.prisma.transaction.findMany({
      where,
      include: { category: true, account: true },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: { category: true, account: true },
    });
    if (!transaction) throw new NotFoundException('Transação não encontrada.');
    if (transaction.userId !== userId) throw new ForbiddenException();
    return transaction;
  }

  async create(userId: string, dto: CreateTransactionDto) {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          ...dto,
          date: new Date(dto.date),
          userId,
        },
        include: { category: true, account: true },
      });

      if (dto.accountId) {
        const delta = dto.type === 'income' ? Number(dto.amount) : -Number(dto.amount);
        await tx.bankAccount.update({
          where: { id: dto.accountId },
          data: { balance: { increment: delta } },
        });
      }

      return transaction;
    });
  }

  async update(id: string, userId: string, dto: UpdateTransactionDto) {
    const existing = await this.findOne(id, userId);

    return this.prisma.$transaction(async (tx) => {
      // Reverte impacto anterior no saldo
      if (existing.accountId) {
        const oldDelta = existing.type === 'income' ? -Number(existing.amount) : Number(existing.amount);
        await tx.bankAccount.update({
          where: { id: existing.accountId },
          data: { balance: { increment: oldDelta } },
        });
      }

      const updated = await tx.transaction.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.date && { date: new Date(dto.date) }),
        },
        include: { category: true, account: true },
      });

      // Aplica novo impacto no saldo
      const newAccountId = dto.accountId ?? existing.accountId;
      if (newAccountId) {
        const newType = dto.type ?? existing.type;
        const newAmount = dto.amount ?? Number(existing.amount);
        const newDelta = newType === 'income' ? Number(newAmount) : -Number(newAmount);
        await tx.bankAccount.update({
          where: { id: newAccountId },
          data: { balance: { increment: newDelta } },
        });
      }

      return updated;
    });
  }

  async remove(id: string, userId: string) {
    const existing = await this.findOne(id, userId);

    return this.prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id } });

      if (existing.accountId) {
        const delta = existing.type === 'income' ? -Number(existing.amount) : Number(existing.amount);
        await tx.bankAccount.update({
          where: { id: existing.accountId },
          data: { balance: { increment: delta } },
        });
      }

      return { message: 'Transação removida com sucesso.' };
    });
  }
}
