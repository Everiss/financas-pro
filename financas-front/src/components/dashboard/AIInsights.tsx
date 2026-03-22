import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Icons } from '../Icons';
import { Card } from '../ui';
import { Transaction } from '../../types';
import { getFinancialInsights } from '../../services/aiService';

export function AIInsights({ transactions }: { transactions: Transaction[] }) {
  const [insights, setInsights] = useState<{ insights: any[]; summary: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    const data = await getFinancialInsights();
    if (data) setInsights(data);
    setLoading(false);
  };

  useEffect(() => {
    if (transactions.length > 0 && !insights) {
      fetchInsights();
    }
  }, [transactions, insights]);

  if (!insights && !loading) return null;

  return (
    <Card className="border-none shadow-sm bg-gradient-to-br from-blue-900 to-blue-800 text-white overflow-hidden relative">
      <div className="absolute top-0 right-0 p-8 opacity-10">
        <Icons.Sparkles className="w-32 h-32" />
      </div>

      <div className="relative z-10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <Icons.Sparkles className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h3 className="font-bold text-lg tracking-tight">Insights da IA</h3>
              <p className="text-blue-300/60 text-xs font-medium uppercase tracking-wider">Análise Financeira Inteligente</p>
            </div>
          </div>
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <Icons.TrendingUp className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-white/5 rounded w-3/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-24 bg-white/5 rounded-2xl"></div>
              <div className="h-24 bg-white/5 rounded-2xl"></div>
              <div className="h-24 bg-white/5 rounded-2xl"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-blue-100 text-sm leading-relaxed font-medium">
              "{insights?.summary}"
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights?.insights.map((insight, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    {insight.type === 'warning' && <Icons.AlertCircle className="w-4 h-4 text-amber-300" />}
                    {insight.type === 'success' && <Icons.TrendingUp className="w-4 h-4 text-emerald-300" />}
                    {insight.type === 'info' && <Icons.Sparkles className="w-4 h-4 text-blue-300" />}
                    <h4 className="font-bold text-sm text-white">{insight.title}</h4>
                  </div>
                  <p className="text-xs text-blue-200/70 leading-relaxed">
                    {insight.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
