import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

@Injectable()
export class BanksService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.bank.findMany({
      where: { userId },
      include: {
        accounts: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const bank = await this.prisma.bank.findUnique({
      where: { id },
      include: { accounts: true },
    });
    if (!bank) throw new NotFoundException('Banco não encontrado.');
    if (bank.userId !== userId) throw new ForbiddenException();
    return bank;
  }

  async create(userId: string, dto: CreateBankDto) {
    return this.prisma.bank.create({ data: { ...dto, userId } });
  }

  async update(id: string, userId: string, dto: UpdateBankDto) {
    await this.findOne(id, userId);
    return this.prisma.bank.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.bank.delete({ where: { id } });
    return { message: 'Banco removido com sucesso.' };
  }
}
