import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

@Injectable()
export class RemindersService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.reminder.findMany({
      where: { userId },
      include: { category: true, account: true },
      orderBy: { dueDate: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id },
      include: { category: true, account: true },
    });
    if (!reminder) throw new NotFoundException('Lembrete não encontrado.');
    if (reminder.userId !== userId) throw new ForbiddenException();
    return reminder;
  }

  async create(userId: string, dto: CreateReminderDto) {
    return this.prisma.reminder.create({
      data: { ...dto, dueDate: new Date(dto.dueDate), userId },
      include: { category: true, account: true },
    });
  }

  async update(id: string, userId: string, dto: UpdateReminderDto) {
    await this.findOne(id, userId);
    return this.prisma.reminder.update({
      where: { id },
      data: { ...dto, ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }) },
      include: { category: true, account: true },
    });
  }

  async confirm(id: string, userId: string) {
    const reminder = await this.findOne(id, userId);
    if ((reminder as any).completedAt && reminder.frequency === 'once') return reminder;

    if (reminder.frequency === 'once') {
      // Única: marcar como concluído definitivamente
      return this.prisma.reminder.update({
        where: { id },
        data: { completedAt: new Date() } as any,
        include: { category: true, account: true },
      });
    }

    // Recorrente: avança dueDate para o próximo período e reseta completedAt
    const next = new Date(reminder.dueDate);
    if (reminder.frequency === 'daily')   next.setDate(next.getDate() + 1);
    if (reminder.frequency === 'weekly')  next.setDate(next.getDate() + 7);
    if (reminder.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
    if (reminder.frequency === 'yearly')  next.setFullYear(next.getFullYear() + 1);

    return this.prisma.reminder.update({
      where: { id },
      data: { dueDate: next, completedAt: null } as any,
      include: { category: true, account: true },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.reminder.delete({ where: { id } });
    return { message: 'Lembrete removido com sucesso.' };
  }
}
