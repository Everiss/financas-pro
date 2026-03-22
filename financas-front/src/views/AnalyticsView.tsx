import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, cn } from '../lib/utils';
import { Icons } from '../components/Icons';
import { Button, Card } from '../components/ui';
import { aiApi, AiInsight, AiHealthScore, AiSpendingForecast, AiInvestmentAnalysis, AiGoalsStrategy } from '../services/api';
import { PlanGate } from '../components/PlanGate';

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalysisStatus = 'idle' | 'loading' | 'done' | 'error';

interface AnalysisState<T> {
  status: AnalysisStatus;
  data: T | null;
  error: string | null;
  lastRun: Date | null;
}

function useAnalysis<T>(fn: () => Promise<T>) {
  const [state, setState] = useState<AnalysisState<T>>({ status: 'idle', data: null, error: null, lastRun: null });

  const run = async () => {
    setState(s => ({ ...s, status: 'loading', error: null }));
    try {
      const data = await fn();
      setState({ status: 'done', data, error: null, lastRun: new Date() });
    } catch (err: any) {
      setState(s => ({ ...s, status: 'error', error: err?.message ?? 'Erro ao executar análise.' }));
    }
  };

  return { ...state, run };
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function AnalysisCard({
  icon, title, description, onRun, status, lastRun, children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onRun: () => void;
  status: AnalysisStatus;
  lastRun: Date | null;
  children?: React.ReactNode;
}) {
  return (
    <Card className="p-0 border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-blue-900 dark:text-slate-100 text-sm">{title}</p>
          <p className="text-xs text-blue-400 dark:text-slate-500 mt-0.5">{description}</p>
          {lastRun && (
            <p className="text-[10px] text-blue-300 dark:text-slate-600 mt-1">
              Última análise: {lastRun.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <Button
          onClick={onRun}
          disabled={status === 'loading'}
          className="shrink-0 text-xs py-1.5 px-3 h-auto"
        >
          {status === 'loading' ? (
            <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Analisando...</>
          ) : status === 'done' ? (
            <><Icons.TrendingUp className="w-3 h-3" /> Reanalisar</>
          ) : (
            <><Icons.Sparkles className="w-3 h-3" /> Analisar</>
          )}
        </Button>
      </div>

      {/* Result */}
      <AnimatePresence>
        {status === 'error' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-5 mb-5 flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <Icons.AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">Erro ao executar análise. Verifique sua conexão e tente novamente.</p>
            </div>
          </motion.div>
        )}
        {status === 'done' && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-blue-50 dark:border-slate-800 p-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── Health Score ─────────────────────────────────────────────────────────────

function HealthScoreResult({ data }: { data: AiHealthScore }) {
  const scoreColor =
    data.score >= 75 ? 'text-emerald-600 dark:text-emerald-400' :
    data.score >= 50 ? 'text-amber-600 dark:text-amber-400' :
    'text-red-500';

  const trackColor =
    data.score >= 75 ? '#10b981' : data.score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-5">
      {/* Score ring */}
      <div className="flex items-center gap-6">
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="8" className="text-blue-100 dark:text-slate-700" />
            <circle
              cx="40" cy="40" r="34" fill="none" strokeWidth="8"
              stroke={trackColor}
              strokeDasharray={`${data.score * 2.136} 213.6`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-bold ${scoreColor}`}>{data.score}</span>
            <span className="text-[9px] text-blue-400 dark:text-slate-500 font-medium">/100</span>
          </div>
        </div>
        <div>
          <p className={`text-lg font-bold ${scoreColor}`}>{data.level}</p>
          <p className="text-sm text-blue-600 dark:text-slate-300 mt-1 max-w-xs">{data.summary}</p>
        </div>
      </div>

      {/* Components */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.components.map(c => {
          const pct = Math.min(100, c.score);
          const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
          return (
            <div key={c.name} className="bg-blue-50/50 dark:bg-slate-800/50 rounded-xl p-3">
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-xs font-semibold text-blue-800 dark:text-slate-200">{c.name}</p>
                <span className="text-xs font-bold" style={{ color }}>{c.score}</span>
              </div>
              <div className="w-full h-1.5 bg-blue-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
              <p className="text-[11px] text-blue-500 dark:text-slate-400">{c.comment}</p>
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Recomendações</p>
        {data.recommendations.map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-blue-700 dark:text-slate-300">
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{i + 1}</span>
            {r}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Spending Forecast ────────────────────────────────────────────────────────

function SpendingForecastResult({ data }: { data: AiSpendingForecast }) {
  const TREND_ICON = {
    up:     <Icons.TrendingUp className="w-3.5 h-3.5 text-red-500" />,
    down:   <Icons.ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />,
    stable: <Icons.Minus className="w-3.5 h-3.5 text-blue-400 dark:text-slate-500" />,
  };

  return (
    <div className="space-y-4">
      {data.alert && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <Icons.AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">{data.alert}</p>
        </div>
      )}
      <div className="flex items-center justify-between bg-blue-50/50 dark:bg-slate-800/50 rounded-xl px-4 py-3">
        <p className="text-sm font-semibold text-blue-800 dark:text-slate-200">Previsão total próximo mês</p>
        <p className="text-xl font-bold text-blue-900 dark:text-slate-100">{formatCurrency(data.totalForecast)}</p>
      </div>
      <p className="text-sm text-blue-600 dark:text-slate-300">{data.summary}</p>
      <div className="space-y-2">
        {data.categories.map(c => (
          <div key={c.category} className="flex items-center gap-3 py-2 border-b border-blue-50 dark:border-slate-800 last:border-0">
            <div className="flex items-center gap-1.5 w-36 shrink-0">
              {TREND_ICON[c.trend]}
              <p className="text-xs font-semibold text-blue-800 dark:text-slate-200 truncate">{c.category}</p>
            </div>
            <p className="text-xs font-bold text-blue-900 dark:text-slate-100 w-24 text-right shrink-0">{formatCurrency(c.forecast)}</p>
            <p className="text-xs text-blue-400 dark:text-slate-500 flex-1 min-w-0">{c.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Investment Analysis ──────────────────────────────────────────────────────

function InvestmentAnalysisResult({ data }: { data: AiInvestmentAnalysis }) {
  const priorityColor = { alta: 'text-red-500 bg-red-50 dark:bg-red-950/30', média: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30', baixa: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="7" className="text-blue-100 dark:text-slate-700" />
            <circle cx="32" cy="32" r="26" fill="none" strokeWidth="7" stroke="#8b5cf6"
              strokeDasharray={`${data.diversificationScore * 1.634} 163.4`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-base font-bold text-purple-600 dark:text-purple-400">{data.diversificationScore}</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-blue-400 dark:text-slate-500 uppercase tracking-wider mb-1">Diversificação</p>
          <p className="text-sm text-blue-700 dark:text-slate-300">{data.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Pontos Fortes</p>
          {data.strengths.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-blue-700 dark:text-slate-300">
              <Icons.CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              {s}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Riscos</p>
          {data.risks.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-blue-700 dark:text-slate-300">
              <Icons.AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              {r}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Recomendações</p>
        {data.recommendations.map((r, i) => (
          <div key={i} className="flex items-start gap-3 bg-blue-50/50 dark:bg-slate-800/50 rounded-xl p-3">
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 mt-0.5', priorityColor[r.priority])}>
              {r.priority.toUpperCase()}
            </span>
            <div>
              <p className="text-xs font-semibold text-blue-800 dark:text-slate-200">{r.action}</p>
              <p className="text-[11px] text-blue-500 dark:text-slate-400 mt-0.5">{r.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Insights Result ──────────────────────────────────────────────────────────

function InsightsResult({ data }: { data: AiInsight[] }) {
  const STYLE = {
    warning: { bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', icon: <Icons.AlertCircle className="w-4 h-4 text-amber-500" />, title: 'text-amber-800 dark:text-amber-300' },
    success: { bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', icon: <Icons.CheckCircle className="w-4 h-4 text-emerald-500" />, title: 'text-emerald-800 dark:text-emerald-300' },
    tip:     { bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800', icon: <Icons.Sparkles className="w-4 h-4 text-blue-500" />, title: 'text-blue-800 dark:text-blue-300' },
  };
  return (
    <div className="space-y-3">
      {data.map((ins, i) => {
        const s = STYLE[ins.type];
        return (
          <div key={i} className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', s.bg)}>
            <div className="shrink-0 mt-0.5">{s.icon}</div>
            <div>
              <p className={cn('text-xs font-bold', s.title)}>{ins.title}</p>
              <p className="text-xs text-blue-600 dark:text-slate-300 mt-0.5">{ins.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

interface ChatMessage { role: 'user' | 'assistant'; text: string; }

function FinancialChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const { reply } = await aiApi.chat(text);
      setMessages(m => [...m, { role: 'assistant', text: reply }]);
    } catch (err: any) {
      setMessages(m => [...m, { role: 'assistant', text: `Erro: ${err?.message ?? 'tente novamente.'}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-0 border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-blue-50 dark:border-slate-800">
        <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0">
          <Icons.Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-blue-900 dark:text-slate-100 text-sm">Assistente Financeiro</p>
          <p className="text-xs text-blue-400 dark:text-slate-500">Faça perguntas sobre suas finanças</p>
        </div>
      </div>

      {/* Messages */}
      <div className="h-72 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <Icons.Sparkles className="w-8 h-8 text-blue-300 dark:text-slate-600" />
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-slate-300">Olá! Sou seu assistente financeiro.</p>
              <p className="text-xs text-blue-400 dark:text-slate-500 mt-1">Pergunte sobre seus gastos, metas, investimentos ou peça conselhos.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {['Como estão meus gastos este mês?', 'Tenho condições de investir mais?', 'Quando vou atingir minha meta?'].map(q => (
                <button key={q} onClick={() => setInput(q)} className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-blue-50 dark:bg-slate-800 text-blue-800 dark:text-slate-200 rounded-bl-sm',
            )}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-blue-50 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 pb-5 flex gap-2 border-t border-blue-50 dark:border-slate-800 pt-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Digite sua pergunta..."
          className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-900 dark:text-slate-100 placeholder:text-blue-300 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0"
        >
          <Icons.ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
    </Card>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function AnalyticsView() {
  const insights          = useAnalysis(aiApi.getInsights);
  const healthScore       = useAnalysis(aiApi.getHealthScore);
  const spendingForecast  = useAnalysis(aiApi.getSpendingForecast);
  const investAnalysis    = useAnalysis(aiApi.getInvestmentAnalysis);

  return (
    <PlanGate feature="ai" showLocked>
      <div className="space-y-5">
        {/* Hero */}
        <div className="bg-gradient-to-br from-blue-900 to-blue-700 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Icons.Sparkles className="w-6 h-6 text-blue-300" />
            <p className="font-bold text-lg tracking-tight">Análises com IA</p>
          </div>
          <p className="text-blue-200 text-sm max-w-lg">
            Execute análises personalizadas sobre sua saúde financeira, previsões de gastos, carteira de investimentos e mais — tudo com base nos seus dados reais.
          </p>
        </div>

        {/* Analysis cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AnalysisCard
            icon={<Icons.HeartPulse className="w-5 h-5" />}
            title="Score de Saúde Financeira"
            description="Pontuação geral + diagnóstico por componente: poupança, crédito, investimentos e reserva."
            onRun={healthScore.run}
            status={healthScore.status}
            lastRun={healthScore.lastRun}
          >
            {healthScore.data && <HealthScoreResult data={healthScore.data} />}
          </AnalysisCard>

          <AnalysisCard
            icon={<Icons.TrendingUp className="w-5 h-5" />}
            title="Previsão de Gastos"
            description="Baseado nos últimos 3 meses, estima quanto você vai gastar por categoria no próximo mês."
            onRun={spendingForecast.run}
            status={spendingForecast.status}
            lastRun={spendingForecast.lastRun}
          >
            {spendingForecast.data && <SpendingForecastResult data={spendingForecast.data} />}
          </AnalysisCard>

          <AnalysisCard
            icon={<Icons.PiggyBank className="w-5 h-5" />}
            title="Análise de Investimentos"
            description="Avalia sua carteira: diversificação, riscos e sugestões de rebalanceamento."
            onRun={investAnalysis.run}
            status={investAnalysis.status}
            lastRun={investAnalysis.lastRun}
          >
            {investAnalysis.data && <InvestmentAnalysisResult data={investAnalysis.data} />}
          </AnalysisCard>

          <AnalysisCard
            icon={<Icons.Sparkles className="w-5 h-5" />}
            title="Insights dos Últimos 30 Dias"
            description="3 insights práticos sobre seu comportamento financeiro recente."
            onRun={insights.run}
            status={insights.status}
            lastRun={insights.lastRun}
          >
            {insights.data && <InsightsResult data={insights.data} />}
          </AnalysisCard>
        </div>

        {/* Chat */}
        <FinancialChat />
      </div>
    </PlanGate>
  );
}
