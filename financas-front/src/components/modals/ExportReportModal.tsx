import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, Category, BankAccount } from '../../types';
import { Icons } from '../Icons';
import { cn } from '../../lib/utils';
import {
  exportTransactionsXLSX,
  exportTransactionsCSV,
  exportTransactionsPDF,
  exportMonthlySummaryXLSX,
  exportMonthlySummaryPDF,
  exportCashflowXLSX,
  exportCashflowCSV,
  exportCashflowPDF,
  ReportFormat,
  ReportType,
} from '../../lib/reportExport';

// ─── tipos ────────────────────────────────────────────────────────────────────

type PeriodPreset =
  | 'this_month'
  | 'last_month'
  | 'last_3'
  | 'last_6'
  | 'this_year'
  | 'custom';

interface Period { start: Date; end: Date }

// ─── helpers ──────────────────────────────────────────────────────────────────

function getPeriod(preset: PeriodPreset, custom: { start: string; end: string }): Period {
  const now = new Date();
  switch (preset) {
    case 'this_month':  return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last_month': {
      const last = subMonths(now, 1);
      return { start: startOfMonth(last), end: endOfMonth(last) };
    }
    case 'last_3':  return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    case 'last_6':  return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
    case 'this_year': return { start: startOfYear(now), end: endOfYear(now) };
    case 'custom':
      return {
        start: custom.start ? new Date(custom.start + 'T00:00:00') : startOfMonth(now),
        end:   custom.end   ? new Date(custom.end   + 'T23:59:59') : endOfMonth(now),
      };
  }
}

function periodLabel(period: Period) {
  return `${format(period.start, 'dd-MM-yyyy')}_a_${format(period.end, 'dd-MM-yyyy')}`;
}

function periodTitle(period: Period) {
  if (
    period.start.getDate() === 1 &&
    period.end.getDate() === endOfMonth(period.end).getDate() &&
    period.start.getMonth() === period.end.getMonth()
  ) {
    return format(period.start, 'MMMM yyyy', { locale: ptBR });
  }
  return `${format(period.start, 'dd/MM/yyyy', { locale: ptBR })} — ${format(period.end, 'dd/MM/yyyy', { locale: ptBR })}`;
}

// ─── config de tipos de relatório ─────────────────────────────────────────────

const REPORT_TYPES: { id: ReportType; label: string; desc: string; icon: keyof typeof Icons; formats: ReportFormat[] }[] = [
  {
    id: 'transactions',
    label: 'Extrato de Transações',
    desc: 'Lista completa de lançamentos com categoria, conta e valor.',
    icon: 'List',
    formats: ['xlsx', 'csv', 'pdf'],
  },
  {
    id: 'monthly',
    label: 'Relatório Mensal',
    desc: 'DRE simplificado: receitas, despesas, saldo e breakdown por categoria.',
    icon: 'LayoutDashboard',
    formats: ['xlsx', 'pdf'],
  },
  {
    id: 'cashflow',
    label: 'Fluxo de Caixa',
    desc: 'Evolução mensal de receitas, despesas e saldo no período selecionado.',
    icon: 'TrendingUp',
    formats: ['xlsx', 'csv', 'pdf'],
  },
];

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: 'this_month',  label: 'Mês atual' },
  { id: 'last_month',  label: 'Mês anterior' },
  { id: 'last_3',      label: 'Últimos 3 meses' },
  { id: 'last_6',      label: 'Últimos 6 meses' },
  { id: 'this_year',   label: 'Ano atual' },
  { id: 'custom',      label: 'Personalizado' },
];

const FORMAT_META: Record<ReportFormat, { label: string; ext: string; color: string }> = {
  xlsx: { label: 'Excel (.xlsx)', ext: 'XLSX', color: 'text-emerald-600 dark:text-emerald-400' },
  csv:  { label: 'CSV (.csv)',    ext: 'CSV',  color: 'text-blue-600 dark:text-blue-400' },
  pdf:  { label: 'PDF (.pdf)',    ext: 'PDF',  color: 'text-red-600 dark:text-red-400' },
};

// ─── componente principal ─────────────────────────────────────────────────────

interface Props {
  transactions: Transaction[];
  categories:   Category[];
  accounts:     BankAccount[];
  onClose:      () => void;
  /** Pré-selecionado ao abrir da FaturaView */
  preselectedType?: ReportType;
}

export function ExportReportModal({ transactions, categories, accounts, onClose, preselectedType }: Props) {
  const [reportType, setReportType] = useState<ReportType>(preselectedType ?? 'transactions');
  const [preset, setPreset] = useState<PeriodPreset>('this_month');
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd,   setCustomEnd]   = useState(format(endOfMonth(new Date()),   'yyyy-MM-dd'));
  const [fmt, setFmt] = useState<ReportFormat>('xlsx');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const currentType = REPORT_TYPES.find(r => r.id === reportType)!;

  // garante que o formato selecionado seja suportado pelo tipo de relatório
  const availableFmts = currentType.formats;
  const safeFmt: ReportFormat = availableFmts.includes(fmt) ? fmt : availableFmts[0];

  const period = useMemo(
    () => getPeriod(preset, { start: customStart, end: customEnd }),
    [preset, customStart, customEnd],
  );

  const filteredTxs = useMemo(
    () => transactions.filter(t => {
      const d = t.date.toDate();
      return d >= period.start && d <= period.end;
    }),
    [transactions, period],
  );

  const label = periodLabel(period);
  const title = periodTitle(period);

  const handleGenerate = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 60)); // yield para o spinner aparecer

    try {
      if (reportType === 'transactions') {
        if (safeFmt === 'xlsx') exportTransactionsXLSX(filteredTxs, categories, accounts, label);
        if (safeFmt === 'csv')  exportTransactionsCSV(filteredTxs, categories, accounts, label);
        if (safeFmt === 'pdf')  exportTransactionsPDF(filteredTxs, categories, accounts, label, title);
      } else if (reportType === 'monthly') {
        if (safeFmt === 'xlsx') exportMonthlySummaryXLSX(filteredTxs, categories, accounts, label);
        if (safeFmt === 'pdf')  exportMonthlySummaryPDF(filteredTxs, categories, accounts, label, title);
      } else if (reportType === 'cashflow') {
        if (safeFmt === 'xlsx') exportCashflowXLSX(filteredTxs, label);
        if (safeFmt === 'csv')  exportCashflowCSV(filteredTxs, label);
        if (safeFmt === 'pdf')  exportCashflowPDF(filteredTxs, label, title);
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Icons.Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Exportar Relatório</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center py-8 gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Icons.CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Relatório gerado!</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    O download foi iniciado automaticamente.
                  </p>
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setDone(false)}
                    className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Gerar outro
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

                {/* 1. Tipo de relatório */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Tipo de Relatório</p>
                  <div className="grid grid-cols-1 gap-2">
                    {REPORT_TYPES.map(r => {
                      const Ico = Icons[r.icon as keyof typeof Icons] as React.ElementType;
                      return (
                        <button
                          key={r.id}
                          onClick={() => { setReportType(r.id); if (!r.formats.includes(safeFmt)) setFmt(r.formats[0]); }}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                            reportType === r.id
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                              : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                          )}
                        >
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                            reportType === r.id ? 'bg-blue-100 dark:bg-blue-900/60' : 'bg-slate-100 dark:bg-slate-800')}>
                            <Ico className={cn('w-4 h-4', reportType === r.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500')} />
                          </div>
                          <div>
                            <p className={cn('text-sm font-medium', reportType === r.id ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200')}>
                              {r.label}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{r.desc}</p>
                          </div>
                          {reportType === r.id && <Icons.Check className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-auto shrink-0 mt-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Período */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Período</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {PRESETS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setPreset(p.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                          preset === p.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300',
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {preset === 'custom' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">De</label>
                        <input
                          type="date"
                          value={customStart}
                          onChange={e => setCustomStart(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Até</label>
                        <input
                          type="date"
                          value={customEnd}
                          onChange={e => setCustomEnd(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-2">
                    <Icons.Calendar className="inline w-3.5 h-3.5 mr-1" />
                    {title} — <span className="font-medium">{filteredTxs.length} transações</span>
                  </p>
                </div>

                {/* 3. Formato */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Formato</p>
                  <div className="flex gap-3">
                    {availableFmts.map(f => (
                      <button
                        key={f}
                        onClick={() => setFmt(f)}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all',
                          safeFmt === f
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300',
                        )}
                      >
                        <Icons.FileText className={cn('w-4 h-4', FORMAT_META[f].color)} />
                        {FORMAT_META[f].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* botão gerar */}
                <button
                  onClick={handleGenerate}
                  disabled={loading || filteredTxs.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Icons.Download className="w-4 h-4" />
                  )}
                  {loading ? 'Gerando...' : filteredTxs.length === 0 ? 'Sem transações no período' : `Gerar ${FORMAT_META[safeFmt].ext}`}
                </button>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
