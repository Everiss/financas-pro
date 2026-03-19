import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  { name: 'Alimentação',   icon: 'Utensils',      color: '#ef4444' },
  { name: 'Transporte',    icon: 'Car',            color: '#3b82f6' },
  { name: 'Lazer',         icon: 'Gamepad2',       color: '#f59e0b' },
  { name: 'Saúde',         icon: 'HeartPulse',     color: '#10b981' },
  { name: 'Educação',      icon: 'GraduationCap',  color: '#8b5cf6' },
  { name: 'Moradia',       icon: 'Home',           color: '#6366f1' },
  { name: 'Serviços',      icon: 'Zap',            color: '#facc15' },
  { name: 'Salário',       icon: 'Wallet',         color: '#22c55e' },
  { name: 'Investimentos', icon: 'TrendingUp',     color: '#06b6d4' },
  { name: 'Outros',        icon: 'MoreHorizontal', color: '#71717a' },
];

async function main() {
  console.log('🌱 Criando categorias padrão...');

  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: {
        // upsert por nome nas categorias padrão (sem userId)
        // usa um campo único composto — fallback: cria se não existir pelo id buscado
        id: (
          await prisma.category.findFirst({
            where: { name: cat.name, isDefault: true },
            select: { id: true },
          })
        )?.id ?? 'new',
      },
      update: {
        icon: cat.icon,
        color: cat.color,
      },
      create: {
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        isDefault: true,
        userId: null,
      },
    });
    console.log(`  ✅ ${cat.name}`);
  }

  const total = await prisma.category.count({ where: { isDefault: true } });
  console.log(`\n✨ Total de categorias padrão no banco: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
