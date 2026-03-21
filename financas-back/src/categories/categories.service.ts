import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { OR: [{ userId }, { isDefault: true }] },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, userId: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    if (!category.isDefault && category.userId !== userId) throw new ForbiddenException();
    return category;
  }

  async create(userId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: { ...dto, userId } });
  }

  async update(id: string, userId: string, dto: UpdateCategoryDto) {
    const category = await this.findOne(id, userId);
    if (category.isDefault) throw new ForbiddenException('Categorias padrão não podem ser editadas.');
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    const category = await this.findOne(id, userId);
    if (category.isDefault) throw new ForbiddenException('Categorias padrão não podem ser removidas.');
    await this.prisma.category.delete({ where: { id } });
    return { message: 'Categoria removida com sucesso.' };
  }

  async getStats(userId: string, month: string) {
    const start = new Date(`${month}-01`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);

    const categories = await this.findAll(userId);
    const transactions = await this.prisma.transaction.findMany({
      where: { userId, type: 'expense', isTransfer: false, date: { gte: start, lte: end } },
    });

    return categories.map((cat) => {
      const spent = transactions
        .filter((t) => t.categoryId === cat.id)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return {
        ...cat,
        spent,
        budgetUsagePercent: cat.budget ? Math.round((spent / Number(cat.budget)) * 100) : null,
      };
    });
  }
}
