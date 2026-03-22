import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiCacheService } from '../ai/ai-cache.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface CreateInstallmentsDto {
  amount: number;
  installments: number;
  accountId: string;
  categoryId?: string;
  description: string;
  date: string;
  type: 'income' | 'expense';
  paymentMethod?: 'debit' | 'credit';
}

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
          ...(dto as any),
          date: new Date(dto.date),
          userId,
        } as any,
        include: { category: true, account: true },
      });

      // Pending transactions do NOT affect balance until confirmed
      if (!dto.isPending && dto.accountId) {
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

  /** Creates N installment transactions, all pending, with monthly dates */
  async createInstallments(userId: string, dto: CreateInstallmentsDto) {
    const ref = randomUUID();
    const installmentAmount = Math.round((dto.amount / dto.installments) * 100) / 100;
    const baseDate = new Date(dto.date);

    const created: any[] = [];
    for (let i = 0; i < dto.installments; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);
      const tx = await this.prisma.transaction.create({
        data: {
          amount: installmentAmount,
          type: dto.type as any,
          date: d,
          description: `${dto.description} (${i + 1}/${dto.installments})`,
          accountId: dto.accountId,
          categoryId: dto.categoryId,
          paymentMethod: dto.paymentMethod as any,
          isPending: true,
          installmentRef: ref,
          userId,
        } as any,
        include: { category: true, account: true },
      });
      created.push(tx);
    }

    await this.aiCache.invalidate(userId);
    return { ref, count: created.length, transactions: created };
  }

  /** Confirms a pending transaction: sets isPending=false and applies balance delta */
  async confirm(id: string, userId: string) {
    const existing = await this.findOne(id, userId);
    if (!(existing as any).isPending) return existing; // already confirmed

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id },
        data: { isPending: false } as any,
        include: { category: true, account: true },
      });

      if (existing.accountId) {
        const account = await tx.bankAccount.findUnique({
          where: { id: existing.accountId },
          select: { type: true },
        });
        if (account) {
          const delta = balanceDelta(existing.type, Number(existing.amount), account.type);
          await tx.bankAccount.update({
            where: { id: existing.accountId },
            data: { balance: { increment: delta } },
          });
        }
      }

      await this.aiCache.invalidate(userId);
      return updated;
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

      // Pending transactions never touched balance — nothing to revert
      if (!(existing as any).isPending && existing.accountId && existing.account) {
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
