import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiCacheService } from '../ai/ai-cache.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { Prisma } from '@prisma/client';

/** Calcula o delta a aplicar no balance da conta.
 * - Contas normais (checking/savings/investment): income → +, expense → −
 * - Cartão de crédito: expense → + (mais dívida), income → − (pagamento reduz dívida)
 */
function balanceDelta(
  type: 'income' | 'expense',
  amount: number,
  accountType: string,
  revert = false,
): number {
  const isCredit = accountType === 'credit';
  const delta = isCredit
    ? type === 'expense' ? amount : -amount
    : type === 'income' ? amount : -amount;
  return revert ? -delta : delta;
}

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private aiCache: AiCacheService,
  ) {}

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
        const account = await tx.bankAccount.findUnique({
          where: { id: dto.accountId },
          select: { type: true },
        });
        if (account) {
          const delta = balanceDelta(dto.type, Number(dto.amount), account.type);
          await tx.bankAccount.update({
            where: { id: dto.accountId },
            data: { balance: { increment: delta } },
          });
        }
      }

      await this.aiCache.invalidate(userId);
      return transaction;
    });
  }

  async update(id: string, userId: string, dto: UpdateTransactionDto) {
    const existing = await this.findOne(id, userId);

    return this.prisma.$transaction(async (tx) => {
      // Reverte impacto anterior no saldo
      if (existing.accountId && existing.account) {
        const revertDelta = balanceDelta(
          existing.type,
          Number(existing.amount),
          existing.account.type,
          true,
        );
        await tx.bankAccount.update({
          where: { id: existing.accountId },
          data: { balance: { increment: revertDelta } },
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
        const newAmount = Number(dto.amount ?? existing.amount);

        // Busca o tipo da nova conta (pode ser diferente da anterior)
        const newAccount = await tx.bankAccount.findUnique({
          where: { id: newAccountId },
          select: { type: true },
        });
        if (newAccount) {
          const newDelta = balanceDelta(newType, newAmount, newAccount.type);
          await tx.bankAccount.update({
            where: { id: newAccountId },
            data: { balance: { increment: newDelta } },
          });
        }
      }

      await this.aiCache.invalidate(userId);
      return updated;
    });
  }

  async remove(id: string, userId: string) {
    const existing = await this.findOne(id, userId);

    return this.prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id } });

      if (existing.accountId && existing.account) {
        const revertDelta = balanceDelta(
          existing.type,
          Number(existing.amount),
          existing.account.type,
          true,
        );
        await tx.bankAccount.update({
          where: { id: existing.accountId },
          data: { balance: { increment: revertDelta } },
        });
      }

      await this.aiCache.invalidate(userId);
      return { message: 'Transação removida com sucesso.' };
    });
  }
}
