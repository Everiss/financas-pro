import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { Icons } from '../Icons';
import { BankAccount, Category } from '../../types';
import { faturaImportApi, ReconciliationItem, ConfirmItem } from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'processing' | 'review' | 'done';

type RowAction = 'link' | 'create' | 'skip';

interface RowState {
  action: RowAction;
  categoryId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CONFIDENCE_LABEL: Record<string, { label: string; cls: string }> = {
  exact:  { label: 'Encontrada',        cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  fuzzy:  { label: 'Provável match',    cls: 'bg-amber-100   dark:bg-amber-900/30   text-amber-700   dark:text-amber-400'   },
  none:   { label: 'Não encontrada',    cls: 'bg-blue-100    dark:bg-blue-900/30    text-blue-600    dark:text-slate-400'    },
};

const ACTION_OPTS: { value: RowAction; label: string }[] = [
  { value: 'link',   label: 'Vincular existente' },
  { value: 'create', label: 'Criar nova'          },
  { value: 'skip',   label: 'Ignorar'             },
];

// ─── Upload zone ─────────────────────────────────────────────────────────────

function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200',
        dragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.01]'
          : 'border-blue-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-slate-500 hover:bg-blue-50/50 dark:hover:bg-slate-800/50',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <div className="w-16 h-16 bg-blue-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Icons.Upload className="w-8 h-8 text-blue-500 dark:text-slate-400" />
      </div>
      <p className="font-semibold text-blue-900 dark:text-slate-100 mb-1">
        Arraste o arquivo aqui ou clique para selecionar
      </p>
      <p className="text-sm text-blue-400 dark:text-slate-500">PDF, Excel (.xlsx / .xls) ou CSV — máx. 20 MB</p>
    </div>
  );
}

// ─── Processing step ──────────────────────────────────────────────────────────

function ProcessingStep({ fileName }: { fileName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-slate-700" />
        <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icons.FileText className="w-8 h-8 text-blue-500" />
        </div>
      </div>
      <div className="text-center">
        <p className="font-semibold text-blue-900 dark:text-slate-100 mb-1">Analisando com IA…</p>
        <p className="text-sm text-blue-400 dark:text-slate-500 truncate max-w-xs">{fileName}</p>
      </div>
      <div className="flex flex-col gap-2 text-sm text-blue-500 dark:text-slate-400 text-left max-w-xs w-full">
        <div className="flex items-center gap-2"><Icons.Check className="w-4 h-4 text-emerald-500" /> Lendo arquivo</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Extraindo transações</div>
        <div className="flex items-center gap-2 opacity-40"><Icons.Circle className="w-4 h-4" /> Conciliando com lançamentos</div>
      </div>
    </div>
  );
}

// ─── Review table ─────────────────────────────────────────────────────────────

function ReviewTable({
  items,
  rows,
  categories,
  onChange,
}: {
  items: ReconciliationItem[];
  rows: RowState[];
  categories: Category[];
  onChange: (idx: number, patch: Partial<RowState>) => void;
}) {
  const counts = {
    exact:  items.filter((_, i) => items[i].confidence === 'exact').length,
    fuzzy:  items.filter((_, i) => items[i].confidence === 'fuzzy').length,
    none:   items.filter((_, i) => items[i].confidence === 'none').length,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
          {counts.exact} encontradas
        </span>
        <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
          {counts.fuzzy} prováveis
        </span>
        <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-slate-400">
          {counts.none} novas
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-blue-100 dark:border-slate-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-blue-50/80 dark:bg-slate-800/80">
              <th className="px-3 py-2.5 text-left font-semibold text-blue-500 dark:text-slate-400">Data</th>
              <th className="px-3 py-2.5 text-left font-semibold text-blue-500 dark:text-slate-400">Descrição</th>
              <th className="px-3 py-2.5 text-right font-semibold text-blue-500 dark:text-slate-400">Valor</th>
              <th className="px-3 py-2.5 text-center font-semibold text-blue-500 dark:text-slate-400">Status</th>
              <th className="px-3 py-2.5 text-left font-semibold text-blue-500 dark:text-slate-400">Ação</th>
              <th className="px-3 py-2.5 text-left font-semibold text-blue-500 dark:text-slate-400">Categoria</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100/50 dark:divide-slate-700/50">
            {items.map((item, idx) => {
              const { confidence, matchDescription, matchDate, matchAmount } = item;
              const row = rows[idx];
              const { label, cls } = CONFIDENCE_LABEL[confidence];
              const isSkipped = row.action === 'skip';

              return (
                <tr
                  key={idx}
                  className={cn(
                    'transition-colors',
                    isSkipped
                      ? 'opacity-40 bg-slate-50 dark:bg-slate-800/30'
                      : 'hover:bg-blue-50/40 dark:hover:bg-slate-800/40',
                  )}
                >
                  {/* Date */}
                  <td className="px-3 py-2.5 whitespace-nowrap font-mono text-blue-700 dark:text-slate-300">
                    {formatDate(item.extracted.date + 'T12:00:00Z')}
                  </td>

                  {/* Description */}
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <p className="font-medium text-blue-900 dark:text-slate-100 truncate">{item.extracted.description}</p>
                    {matchDescription && row.action === 'link' && (
                      <p className="text-blue-400 dark:text-slate-500 truncate mt-0.5">
                        ↳ {matchDescription} · {matchDate && formatDate(matchDate + 'T12:00:00Z')}
                        {matchAmount !== null && ` · ${formatCurrency(matchAmount)}`}
                      </p>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="px-3 py-2.5 text-right font-semibold text-blue-900 dark:text-slate-100 whitespace-nowrap">
                    {formatCurrency(item.extracted.amount)}
                  </td>

                  {/* Status badge */}
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn('px-2 py-0.5 rounded-full font-semibold text-[10px] whitespace-nowrap', cls)}>
                      {label}
                    </span>
                  </td>

                  {/* Action selector */}
                  <td className="px-3 py-2.5">
                    <select
                      value={row.action}
                      onChange={(e) => onChange(idx, { action: e.target.value as RowAction })}
                      className="text-xs rounded-lg border border-blue-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-900 dark:text-slate-100 px-2 py-1 focus:ring-2 focus:ring-blue-400 outline-none"
                    >
                      {ACTION_OPTS.filter((o) => {
                        if (o.value === 'link' && !item.matchId) return false;
                        return true;
                      }).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>

                  {/* Category (only for 'create') */}
                  <td className="px-3 py-2.5">
                    {row.action === 'create' ? (
                      <select
                        value={row.categoryId}
                        onChange={(e) => onChange(idx, { categoryId: e.target.value })}
                        className="text-xs rounded-lg border border-blue-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-900 dark:text-slate-100 px-2 py-1 focus:ring-2 focus:ring-blue-400 outline-none max-w-[140px]"
                      >
                        <option value="">Sem categoria</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-blue-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Done step ────────────────────────────────────────────────────────────────

function DoneStep({
  result,
  onClose,
}: {
  result: { linked: number; created: number; skipped: number };
  onClose: () => void;
}) {
  const total = result.linked + result.created + result.skipped;
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6">
      <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
        <Icons.Check className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="text-center">
        <p className="text-xl font-bold text-blue-900 dark:text-slate-100 mb-1">Conciliação concluída!</p>
        <p className="text-sm text-blue-400 dark:text-slate-500">{total} itens processados</p>
      </div>
      <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
        <div className="text-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4">
          <p className="text-2xl font-bold text-emerald-600">{result.linked}</p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">Vinculadas</p>
        </div>
        <div className="text-center rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
          <p className="text-2xl font-bold text-blue-600">{result.created}</p>
          <p className="text-xs text-blue-600 mt-1 font-medium">Criadas</p>
        </div>
        <div className="text-center rounded-xl bg-slate-50 dark:bg-slate-800 p-4">
          <p className="text-2xl font-bold text-slate-500">{result.skipped}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">Ignoradas</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
      >
        Fechar
      </button>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function ImportFaturaModal({
  open,
  onClose,
  account,
  categories,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  account: BankAccount;
  categories: Category[];
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [rows, setRows] = useState<RowState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ linked: number; created: number; skipped: number } | null>(null);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setItems([]);
    setRows([]);
    setError(null);
    setResult(null);
    setConfirming(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = async (f: File) => {
    setFile(f);
    setError(null);
    setStep('processing');

    try {
      const data = await faturaImportApi.upload(f, account.id);
      setItems(data);
      // Default action: link if match found, else create
      setRows(data.map((item) => ({
        action: item.matchId ? 'link' : 'create',
        categoryId: '',
      })));
      setStep('review');
    } catch (e: any) {
      setError(e.message ?? 'Erro ao processar arquivo.');
      setStep('upload');
    }
  };

  const handleRowChange = (idx: number, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      const confirmItems: ConfirmItem[] = items.map((item, idx) => ({
        extracted: item.extracted,
        action: rows[idx].action,
        matchId: rows[idx].action === 'link' ? (item.matchId ?? undefined) : undefined,
        categoryId: rows[idx].categoryId || undefined,
      }));
      const res = await faturaImportApi.confirm(account.id, confirmItems);
      setResult(res);
      setStep('done');
      onSuccess();
    } catch (e: any) {
      setError(e.message ?? 'Erro ao confirmar.');
    } finally {
      setConfirming(false);
    }
  };

  const toCreate = rows.filter((r) => r.action === 'create').length;
  const toLink   = rows.filter((r) => r.action === 'link').length;
  const toSkip   = rows.filter((r) => r.action === 'skip').length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 dark:border-slate-700">
          <div>
            <h2 className="font-bold text-blue-900 dark:text-slate-100 text-lg">Importar Fatura</h2>
            <p className="text-xs text-blue-400 dark:text-slate-500 mt-0.5">
              {account.name} · {account.bank?.name ?? ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Step indicator */}
            <div className="hidden sm:flex items-center gap-1.5">
              {(['upload', 'processing', 'review', 'done'] as Step[]).map((s, i) => (
                <React.Fragment key={s}>
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                    step === s
                      ? 'bg-blue-600 text-white scale-110'
                      : (['upload', 'processing', 'review', 'done'] as Step[]).indexOf(step) > i
                      ? 'bg-emerald-500 text-white'
                      : 'bg-blue-100 dark:bg-slate-700 text-blue-400 dark:text-slate-500',
                  )}>
                    {(['upload', 'processing', 'review', 'done'] as Step[]).indexOf(step) > i
                      ? <Icons.Check className="w-3 h-3" />
                      : i + 1}
                  </div>
                  {i < 3 && <div className={cn('w-6 h-0.5 rounded', (['upload', 'processing', 'review', 'done'] as Step[]).indexOf(step) > i ? 'bg-emerald-400' : 'bg-blue-100 dark:bg-slate-700')} />}
                </React.Fragment>
              ))}
            </div>
            <button onClick={handleClose} className="p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800 text-blue-400 dark:text-slate-500 transition-colors">
              <Icons.X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
              <Icons.AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <UploadZone onFile={handleFile} />
              </motion.div>
            )}

            {step === 'processing' && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ProcessingStep fileName={file?.name ?? ''} />
              </motion.div>
            )}

            {step === 'review' && (
              <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ReviewTable items={items} rows={rows} categories={categories} onChange={handleRowChange} />
              </motion.div>
            )}

            {step === 'done' && result && (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <DoneStep result={result} onClose={handleClose} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer (review step only) */}
        {step === 'review' && (
          <div className="px-6 py-4 border-t border-blue-100 dark:border-slate-700 flex items-center justify-between gap-4">
            <div className="text-xs text-blue-400 dark:text-slate-500 flex flex-wrap gap-3">
              <span><span className="font-semibold text-blue-600">{toCreate}</span> a criar</span>
              <span><span className="font-semibold text-emerald-600">{toLink}</span> a vincular</span>
              <span><span className="font-semibold text-slate-400">{toSkip}</span> ignoradas</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setStep('upload'); setFile(null); setItems([]); setRows([]); }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-blue-200 dark:border-slate-600 text-blue-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
              >
                Trocar arquivo
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming || (toCreate + toLink === 0)}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {confirming && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Confirmar conciliação
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
