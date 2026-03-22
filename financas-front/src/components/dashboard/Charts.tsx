import React, { useMemo } from 'react';
import { formatCurrency } from '../../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card } from '../ui';
import { Transaction, Category } from '../../types';

export function FluxoCaixaChart({ transactions, darkMode }: { transactions: Transaction[]; darkMode: boolean }) {
  const gridColor = darkMode ? '#1e293b' : '#e4e4e7';
  const tickColor = darkMode ? '#64748b' : '#a1a1aa';
  const tooltipStyle = { borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)', padding: '12px 16px', fontWeight: 500, backgroundColor: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#f1f5f9' : '#0f172a' };
  const cursorFill = darkMode ? '#0f172a' : '#f4f4f5';

  const barData = useMemo(() => {
    const data: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date);
      const m = date.getMonth();
      const y = date.getFullYear();
      const monthTxs = transactions.filter(t => {
        const d = t.date.toDate();
        return d.getMonth() === m && d.getFullYear() === y;
      });
      data.push({
        name: monthLabel,
        receitas: monthTxs.filter(t => t.type === 'income' && !t.isTransfer).reduce((acc, t) => acc + t.amount, 0),
        despesas: monthTxs.filter(t => t.type === 'expense' && !t.isTransfer).reduce((acc, t) => acc + t.amount, 0),
      });
    }
    return data;
  }, [transactions]);

  return (
    <Card title="Fluxo de Caixa" subtitle="Receitas vs Despesas — últimos 6 meses" className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <div className="h-[300px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: tickColor, fontWeight: 500 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: tickColor, fontWeight: 500 }} />
            <Tooltip cursor={{ fill: cursorFill }} contentStyle={tooltipStyle} formatter={(value: number) => formatCurrency(value)} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '16px', color: tickColor }} formatter={(v) => v === 'receitas' ? 'Receitas' : 'Despesas'} />
            <Bar dataKey="receitas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
            <Bar dataKey="despesas" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function GastosCategoriaChart({ transactions, categories, month, darkMode }: { transactions: Transaction[]; categories: Category[]; month: Date; darkMode: boolean }) {
  const tooltipStyle = { borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)', padding: '12px 16px', fontWeight: 500, backgroundColor: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#f1f5f9' : '#0f172a' };

  const pieData = useMemo(() => {
    const expenses = transactions.filter(t => {
      const d = t.date.toDate();
      return t.type === 'expense' && !t.isTransfer && d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
    });
    const grouped = expenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped).map(([catId, amount]) => {
      const cat = categories.find(c => c.id === catId);
      return { name: cat?.name || 'Outros', value: amount, color: cat?.color || '#71717a' };
    }).sort((a, b) => b.value - a.value);
  }, [transactions, categories, month]);

  const total = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <Card title="Gastos por Categoria" subtitle={`Distribuição das despesas — ${format(month, 'MMM yyyy', { locale: ptBR })}`} className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      {pieData.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm text-blue-400 dark:text-slate-500 font-medium">Sem despesas neste mês.</p>
        </div>
      ) : (
        <>
          <div className="h-[240px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={6} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-xs font-medium text-blue-700 dark:text-slate-300 flex-1 truncate">{item.name}</span>
                <span className="text-xs font-bold text-blue-500 dark:text-slate-400">{total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%</span>
                <span className="text-xs font-bold text-blue-900 dark:text-slate-100 w-20 text-right">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
