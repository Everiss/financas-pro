import { aiApi, AiInsight, AiGoalsStrategy } from './api';

export async function getFinancialInsights(): Promise<{ insights: AiInsight[]; summary: string } | null> {
  try {
    const insights = await aiApi.getInsights();
    return { insights, summary: '' };
  } catch (error) {
    console.error('Erro ao obter insights da IA:', error);
    return null;
  }
}

export async function getGoalInsights(): Promise<AiGoalsStrategy | null> {
  try {
    return await aiApi.getGoalsStrategy();
  } catch (error) {
    console.error('Erro ao obter estratégia de metas da IA:', error);
    return null;
  }
}
