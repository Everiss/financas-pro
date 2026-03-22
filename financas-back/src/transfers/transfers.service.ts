import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiCacheService } from '../ai/ai-cache.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

@Injectable()
export class TransfersService {
  constructor(
    private prisma: PrismaService,
    private aiCache: AiCacheService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.transfer.findMany({
      where: { userId },
      include: {
        fromAccount: true,
        toAccount: true,
        fromTx: { include: { category: true } },
        toTx: { include: { category: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async create(userId: string, dto: CreateTransferDto) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Conta de origem e destino não podem ser iguais.');
    }

    const [fromAccount, toAccount] = await Promise.all([
      this.prisma.bankAccount.findUnique({ where: { id: dto.fromAccountId } }),
      this.prisma.bankAccount.findUnique({ where: { id: dto.toAccountId } }),
    ]);

    if (!fromAccount || fromAccount.userId !== userId) throw new NotFoundException('Conta de origem não encontrada.');
    if (!toAccount || toAccount.userId !== userId) throw new NotFoundException('Conta de destino não encontrada.');

    const isBill = dto.isBillPayment ?? toAccount.type === 'credit';
    const date = new Date(dto.date);
    const desc = dto.description?.trim() ||
      (isBill ? `Pagamento de fatura — ${toAccount.name}` : `Transferência: ${fromAccount.name} → ${toAccount.name}`);

    return this.prisma.$transaction(async (tx) => {
      // 1. Cria transação de saída (despesa na conta origem)
      const fromTx = await tx.transaction.create({
        data: {
          amount: dto.amount,
          type: 'expense',
          date,
          description: desc,
          accountId: dto.fromAccountId,
          isTransfer: true,
          userId,
        },
      });

      // 2. Cria transação de entrada (receita na conta destino)
      const toTx = await tx.transaction.create({
        data: {
          amount: dto.amount,
          type: 'income',
          date,
          description: isBill ? `Pagamento de fatura recebido — ${fromAccount.name}` : desc,
          accountId: dto.toAccountId,
          isTransfer: true,
          userId,
        },
      });

      // 3. Cria o registro de transferência vinculando as duas transações
      const transfer = await tx.transfer.create({
        data: {
          amount: dto.amount,
          date,
          description: desc,
          isBillPayment: isBill,
          userId,
          fromAccountId: dto.fromAccountId,
          toAccountId: dto.toAccountId,
          fromTxId: fromTx.id,
          toTxId: toTx.id,
        },
        include: {
          fromAccount: true,
          toAccount: true,
          fromTx: true,
          toTx: true,
        },
      });

      // 4. Atualiza saldos
      // Conta origem: perde dinheiro
      const fromDelta = fromAccount.type === 'credit' ? dto.amount : -dto.amount;
      await tx.bankAccount.update({
        where: { id: dto.fromAccountId },
        data: { balance: { increment: fromDelta } },
      });

      // Conta destino: recebe dinheiro
      const toDelta = toAccount.type === 'credit' ? -dto.amount : dto.amount;
      await tx.bankAccount.update({
        where: { id: dto.toAccountId },
        data: { balance: { increment: toDelta } },
      });

      await this.aiCache.invalidate(userId);
      return transfer;
    });
  }

  async remove(id: string, userId: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: { fromAccount: true, toAccount: true },
    });

    if (!transfer) throw new NotFoundException('Transferência não encontrada.');
    if (transfer.userId !== userId) throw new ForbiddenException();

    return this.prisma.$transaction(async (tx) => {
      // Reverte saldo da conta origem
      const fromDelta = transfer.fromAccount.type === 'credit' ? -Number(transfer.amount) : Number(transfer.amount);
      await tx.bankAccount.update({
        where: { id: transfer.fromAccountId },
        data: { balance: { increment: fromDelta } },
      });

      // Reverte saldo da conta destino
      const toDelta = transfer.toAccount.type === 'credit' ? Number(transfer.amount) : -Number(transfer.amount);
      await tx.bankAccount.update({
        where: { id: transfer.toAccountId },
        data: { balance: { increment: toDelta } },
      });

      // Deleta as transações (Transfer será deletado em cascata via onDelete: Cascade nos fromTx/toTx)
      await tx.transaction.deleteMany({
        where: { id: { in: [transfer.fromTxId, transfer.toTxId] } },
      });

      // Deleta a transferência
      await tx.transfer.delete({ where: { id } });

      await this.aiCache.invalidate(userId);
      return { message: 'Transferência removida com sucesso.' };
    });
  }
}
