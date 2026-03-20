import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  private client: Anthropic;
  private model: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.client = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') });
    this.model = this.config.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-20250514';
  }

  async getFinancialInsights(userId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [transactions, categories] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, date: { gte: thirtyDaysAgo } },
        include: { category: true },
      }),
      this.prisma.category.findMany({
        where: { OR: [{ userId }, { isDefault: true }] },
      }),
    ]);

    const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    const expenseByCategory = categories.map((cat) => ({
      category: cat.name,
      total: transactions
        .filter((t) => t.categoryId === cat.id && t.type === 'expense')
        .reduce((s, t) => s + Number(t.amount), 0),
    })).filter((c) => c.total > 0);

    const prompt = `Você é um assistente financeiro pessoal. Analise os dados abaixo e forneça exatamente 3 insights financeiros práticos e personalizados em português (BR). Seja direto e objetivo.

Período: últimos 30 dias
Receita total: R$ ${totalIncome.toFixed(2)}
Despesa total: R$ ${totalExpense.toFixed(2)}
Saldo do período: R$ ${(totalIncome - totalExpense).toFixed(2)}

Gastos por categoria:
${expenseByCategory.map((c) => `- ${c.category}: R$ ${c.total.toFixed(2)}`).join('\n')}

Retorne apenas os 3 insights em formato JSON: [{"title": "...", "description": "...", "type": "warning|success|tip"}]`;

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : '[]');
  }

  async getGoalsStrategy(userId: string) {
    const [goals, transactions] = await Promise.all([
      this.prisma.goal.findMany({ where: { userId } }),
      this.prisma.transaction.findMany({
        where: { userId, date: { gte: new Date(new Date().setDate(1)) } },
      }),
    ]);

    const monthIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const monthExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const available = monthIncome - monthExpense;

    const prompt = `Você é um consultor financeiro. Com base nas metas e fluxo de caixa, sugira uma estratégia de aportes para este mês em português (BR).

Fluxo de caixa do mês atual:
- Receita: R$ ${monthIncome.toFixed(2)}
- Despesa: R$ ${monthExpense.toFixed(2)}
- Disponível para investir: R$ ${available.toFixed(2)}

Metas:
${goals.map((g) => `- ${g.name}: R$ ${Number(g.currentAmount).toFixed(2)} de R$ ${Number(g.targetAmount).toFixed(2)}${g.deadline ? ` (prazo: ${g.deadline.toLocaleDateString('pt-BR')})` : ''}`).join('\n')}

Retorne um JSON com o seguinte formato exato:
{"summary": "conselho geral em uma frase", "advice": [{"goalName": "nome da meta", "strategy": "estratégia específica", "feasibility": "Alta|Média|Baixa", "estimatedTime": "ex: 6 meses", "monthlySavingNeeded": "ex: R$ 500,00"}]}`;

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
  }
}
