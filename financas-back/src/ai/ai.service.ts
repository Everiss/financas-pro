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
    const cache = await this.prisma.aiInsightCache.findUnique({ where: { userId } });
    if (cache && !cache.isDirty && cache.insightsJson) {
      return JSON.parse(cache.insightsJson);
    }

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
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');

    await this.prisma.aiInsightCache.upsert({
      where: { userId },
      create: { userId, insightsJson: JSON.stringify(result), isDirty: false },
      update: { insightsJson: JSON.stringify(result), isDirty: false },
    });

    return result;
  }

  /** Extrai dados de uma transação a partir de imagem de comprovante */
  async extractReceipt(imageBuffer: Buffer, mimeType: string, userId: string) {
    const categories = await this.prisma.category.findMany({
      where: { OR: [{ userId }, { isDefault: true }] },
      select: { name: true },
    });
    const categoryNames = categories.map((c) => c.name).join(', ');

    const base64 = imageBuffer.toString('base64');

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType as any, data: base64 },
            },
            {
              type: 'text',
              text: `Analise este comprovante/recibo financeiro e extraia as informações da transação.

Categorias disponíveis no sistema: ${categoryNames}

Retorne APENAS um JSON válido (sem markdown, sem explicações) com este formato exato:
{
  "amount": 0.00,
  "type": "expense",
  "date": "YYYY-MM-DD",
  "description": "descrição curta",
  "categoryName": "categoria mais adequada da lista acima",
  "paymentMethod": "debit",
  "establishment": "nome do estabelecimento ou pagador/recebedor",
  "confidence": "high|medium|low"
}

Regras:
- type: "expense" para pagamentos/compras, "income" para recebimentos/depósitos
- paymentMethod: "credit" se cartão de crédito, "debit" para os demais
- date: use a data do comprovante; se ausente, use hoje (${new Date().toISOString().split('T')[0]})
- amount: valor numérico positivo (sem R$, sem vírgula — use ponto decimal)
- categoryName: escolha a mais próxima da lista; use "Outros" se nenhuma se encaixar
- confidence: "high" se todas as informações estão claras, "low" se a imagem está ruim`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Não foi possível interpretar o comprovante.');

    return JSON.parse(jsonMatch[0]);
  }

  async getGoalsStrategy(userId: string) {
    const cache = await this.prisma.aiInsightCache.findUnique({ where: { userId } });
    if (cache && !cache.isDirty && cache.strategyJson) {
      return JSON.parse(cache.strategyJson);
    }

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
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

    await this.prisma.aiInsightCache.upsert({
      where: { userId },
      create: { userId, strategyJson: JSON.stringify(result), isDirty: false },
      update: { strategyJson: JSON.stringify(result), isDirty: false },
    });

    return result;
  }

  async getHealthScore(userId: string) {
    const extra = await this.getExtra(userId);
    if (extra.healthScore) return extra.healthScore;

    const [accounts, transactions, reminders] = await Promise.all([
      this.prisma.bankAccount.findMany({ where: { userId } }),
      this.prisma.transaction.findMany({
        where: { userId, date: { gte: new Date(new Date().setDate(1)) }, isTransfer: false },
      }),
      this.prisma.reminder.findMany({ where: { userId } }),
    ]);

    const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const savings = accounts.filter(a => a.type === 'savings').reduce((s, a) => s + Number(a.balance), 0);
    const investBalance = accounts.filter(a => a.type === 'investment').reduce((s, a) => s + Number(a.balance), 0);
    const creditCards = accounts.filter(a => a.type === 'credit');
    const totalCredit = creditCards.reduce((s, a) => s + Number(a.balance), 0);
    const totalLimit  = creditCards.reduce((s, a) => s + Number(a.creditLimit ?? 0), 0);

    const prompt = `Você é um consultor financeiro. Calcule um score de saúde financeira (0-100) baseado nos dados abaixo e retorne um JSON em português (BR).

Dados do mês atual:
- Receita: R$ ${income.toFixed(2)}
- Despesa: R$ ${expense.toFixed(2)}
- Taxa de poupança: ${income > 0 ? (((income - expense) / income) * 100).toFixed(1) : 0}%
- Saldo poupança: R$ ${savings.toFixed(2)}
- Saldo investimentos: R$ ${investBalance.toFixed(2)}
- Uso do crédito: R$ ${totalCredit.toFixed(2)} de R$ ${totalLimit.toFixed(2)} disponível
- Lembretes ativos: ${reminders.length}

Retorne APENAS JSON neste formato:
{
  "score": 75,
  "level": "Bom",
  "summary": "Resumo geral em uma frase",
  "components": [
    { "name": "Taxa de Poupança", "score": 80, "comment": "..." },
    { "name": "Uso do Crédito",   "score": 60, "comment": "..." },
    { "name": "Reserva de Emergência", "score": 40, "comment": "..." },
    { "name": "Investimentos",    "score": 70, "comment": "..." }
  ],
  "recommendations": ["recomendação 1", "recomendação 2", "recomendação 3"]
}`;

    const message = await this.client.messages.create({
      model: this.model, max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
    await this.saveExtra(userId, { healthScore: result });
    return result;
  }

  async getSpendingForecast(userId: string) {
    const extra = await this.getExtra(userId);
    if (extra.forecast) return extra.forecast;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const transactions = await this.prisma.transaction.findMany({
      where: { userId, type: 'expense', isTransfer: false, date: { gte: threeMonthsAgo } },
      include: { category: true },
    });

    const byCategory: Record<string, number[]> = {};
    transactions.forEach(t => {
      const name = t.category?.name ?? 'Outros';
      const monthKey = `${t.date.getFullYear()}-${t.date.getMonth()}`;
      if (!byCategory[name]) byCategory[name] = [];
      byCategory[name].push(Number(t.amount));
    });

    const summary = Object.entries(byCategory).map(([cat, vals]) => ({
      category: cat,
      avg: vals.reduce((s, v) => s + v, 0) / 3,
      total: vals.reduce((s, v) => s + v, 0),
    }));

    const prompt = `Você é um analista financeiro. Com base nos gastos dos últimos 3 meses, faça uma previsão para o próximo mês em português (BR).

Média mensal de gastos por categoria:
${summary.map(s => `- ${s.category}: R$ ${s.avg.toFixed(2)}/mês`).join('\n')}

Retorne APENAS JSON neste formato:
{
  "totalForecast": 2500.00,
  "summary": "Resumo da previsão em uma frase",
  "categories": [
    { "category": "Alimentação", "forecast": 800.00, "trend": "stable|up|down", "comment": "..." }
  ],
  "alert": "alerta principal se houver, ou null"
}`;

    const message = await this.client.messages.create({
      model: this.model, max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
    await this.saveExtra(userId, { forecast: result });
    return result;
  }

  async getInvestmentAnalysis(userId: string) {
    const extra = await this.getExtra(userId);
    if (extra.investmentAnalysis) return extra.investmentAnalysis;

    const [accounts, transactions] = await Promise.all([
      this.prisma.bankAccount.findMany({ where: { userId, type: 'investment' } }),
      this.prisma.transaction.findMany({
        where: { userId, date: { gte: new Date(new Date().setDate(1)) }, isTransfer: false },
      }),
    ]);

    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const totalInvested = accounts.reduce((s, a) => s + Number(a.balance), 0);

    const portfolioSummary = accounts.map(a => ({
      name: a.name,
      type: a.investmentType ?? 'other',
      balance: Number(a.balance),
      percent: totalInvested > 0 ? ((Number(a.balance) / totalInvested) * 100).toFixed(1) : '0',
    }));

    const prompt = `Você é um consultor de investimentos. Analise a carteira abaixo e retorne recomendações em português (BR).

Carteira atual (total: R$ ${totalInvested.toFixed(2)}):
${portfolioSummary.map(a => `- ${a.name} (${a.type}): R$ ${a.balance.toFixed(2)} (${a.percent}%)`).join('\n')}

Fluxo do mês:
- Receita: R$ ${income.toFixed(2)} | Despesa: R$ ${expense.toFixed(2)} | Disponível: R$ ${(income - expense).toFixed(2)}

Retorne APENAS JSON neste formato:
{
  "diversificationScore": 75,
  "summary": "Resumo da carteira em uma frase",
  "strengths": ["ponto forte 1", "ponto forte 2"],
  "risks": ["risco 1", "risco 2"],
  "recommendations": [
    { "action": "Aumentar posição em renda fixa", "reason": "...", "priority": "alta|média|baixa" }
  ]
}`;

    const message = await this.client.messages.create({
      model: this.model, max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
    await this.saveExtra(userId, { investmentAnalysis: result });
    return result;
  }

  async chat(userId: string, message: string) {
    const [accounts, transactions, goals] = await Promise.all([
      this.prisma.bankAccount.findMany({ where: { userId } }),
      this.prisma.transaction.findMany({
        where: { userId, date: { gte: new Date(new Date().setDate(1)) }, isTransfer: false },
        include: { category: true },
      }),
      this.prisma.goal.findMany({ where: { userId } }),
    ]);

    const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const netWorth = accounts.filter(a => a.type !== 'credit').reduce((s, a) => s + Number(a.balance), 0);

    const systemContext = `Você é um assistente financeiro pessoal do app Finanças Pro. Responda sempre em português (BR), de forma clara, direta e prática. Não invente dados — use apenas os fornecidos.

Contexto financeiro do usuário (mês atual):
- Patrimônio líquido: R$ ${netWorth.toFixed(2)}
- Receita do mês: R$ ${income.toFixed(2)}
- Despesas do mês: R$ ${expense.toFixed(2)}
- Saldo disponível: R$ ${(income - expense).toFixed(2)}
- Contas: ${accounts.map(a => `${a.name} (${a.type}): R$ ${Number(a.balance).toFixed(2)}`).join(', ')}
- Metas: ${goals.map(g => `${g.name}: ${Number(g.currentAmount).toFixed(2)}/${Number(g.targetAmount).toFixed(2)}`).join(', ')}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemContext,
      messages: [{ role: 'user', content: message }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return { reply: text };
  }

  private async getExtra(userId: string): Promise<Record<string, any>> {
    const cache = await this.prisma.aiInsightCache.findUnique({ where: { userId } });
    if (!cache?.extraJson) return {};
    try { return JSON.parse(cache.extraJson); } catch { return {}; }
  }

  private async saveExtra(userId: string, patch: Record<string, any>) {
    const current = await this.getExtra(userId);
    const updated = { ...current, ...patch };
    await this.prisma.aiInsightCache.upsert({
      where: { userId },
      create: { userId, extraJson: JSON.stringify(updated), isDirty: false },
      update: { extraJson: JSON.stringify(updated) },
    });
  }
}
