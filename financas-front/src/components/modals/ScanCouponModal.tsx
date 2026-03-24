import React, { useState, useCallback, useRef } from 'react';
import { cn, formatCurrency } from '../../lib/utils';
import { Icons } from '../Icons';
import { BankAccount, Category } from '../../types';
import { couponScannerApi, ScannedReceipt, ScannedReceiptItem } from '../../services/api';

// ─── Step types ───────────────────────────────────────────────────────────────

type Step = 'upload' | 'scanning' | 'review' | 'success';

interface EditableItem extends ScannedReceiptItem {
  categoryId: string | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'upload',   label: 'Enviar' },
    { key: 'scanning', label: 'IA' },
    { key: 'review',   label: 'Revisar' },
    { key: 'success',  label: 'Pronto' },
  ];
  const idx = steps.findIndex(s => s.key === step);
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all',
            i <= idx
              ? 'bg-blue-600 text-white'
              : 'bg-blue-50 dark:bg-slate-800 text-blue-400 dark:text-slate-500',
          )}>
            <span>{i + 1}</span>
            <span>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn('flex-1 h-px', i < idx ? 'bg-blue-600' : 'bg-blue-100 dark:bg-slate-700')} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── ScanCouponModal ──────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  categories: Category[];
  onSuccess: () => void;
}

export function ScanCouponModal({ open, onClose, accounts, categories, onSuccess }: Props) {
  const [step, setStep]           = useState<Step>('upload');
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<string | null>(null);
  const [dragging, setDragging]   = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Scanned data
  const [scanned, setScanned]     = useState<ScannedReceipt | null>(null);
  const [items, setItems]         = useState<EditableItem[]>([]);

  // Transaction form
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [payMethod, setPayMethod] = useState<string>('debit');
  const [txDesc, setTxDesc]       = useState('');
  const [saving, setSaving]       = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload'); setFile(null); setPreview(null);
    setScanned(null);  setItems([]);  setError(null);
    setSaving(false);
  }, []);

  const handleClose = () => { reset(); onClose(); };

  // ── File handling ────────────────────────────────────────────────────────────

  const pickFile = (f: File) => {
    if (!f.type.startsWith('image/')) { setError('Envie uma imagem (JPG, PNG, WEBP).'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }, []);

  // ── Scan ─────────────────────────────────────────────────────────────────────

  const scan = async () => {
    if (!file) return;
    setStep('scanning');
    setError(null);
    try {
      const result = await couponScannerApi.scan(file);
      setScanned(result);
      setItems(result.items.map(it => ({
        ...it,
        categoryId: it.suggestedCategoryId ?? null,
      })));
      setTxDesc(result.issuerName ?? 'Compra via cupom fiscal');
      setStep('review');
    } catch (e: any) {
      setError(e.message ?? 'Erro ao processar cupom. Tente uma imagem mais nítida.');
      setStep('upload');
    }
  };

  // ── Item editing ─────────────────────────────────────────────────────────────

  const setItemCategory = (idx: number, catId: string | null) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, categoryId: catId } : it));
  };

  // ── Confirm ──────────────────────────────────────────────────────────────────

  const confirm = async () => {
    if (!scanned || !accountId) return;
    setSaving(true);
    setError(null);
    try {
      await couponScannerApi.confirm({
        issuerName:    scanned.issuerName,
        issuerCnpj:    scanned.issuerCnpj,
        issueDate:     scanned.issueDate,
        totalAmount:   scanned.totalAmount,
        accessKey:     scanned.accessKey,
        source:        'image',
        items:         items.map(it => ({
          description: it.description,
          quantity:    it.quantity,
          unit:        it.unit,
          unitPrice:   it.unitPrice,
          totalPrice:  it.totalPrice,
          categoryId:  it.categoryId,
        })),
        accountId,
        categoryId:    null,
        description:   txDesc,
        paymentMethod: payMethod,
      });
      setStep('success');
      onSuccess();
    } catch (e: any) {
      setError(e.message ?? 'Erro ao salvar cupom.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-blue-100 dark:border-slate-700">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-blue-50 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center">
              <Icons.ScanLine className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-bold text-blue-900 dark:text-slate-100 text-base">Escanear Cupom Fiscal</h2>
              <p className="text-xs text-blue-400 dark:text-slate-500">IA extrai todos os itens automaticamente</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800 text-blue-400 dark:text-slate-500">
            <Icons.X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <StepIndicator step={step} />

          {/* ── Step: upload ── */}
          {(step === 'upload') && (
            <div className="space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all',
                  dragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'border-blue-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-800/50',
                )}
              >
                <input ref={inputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
                {preview ? (
                  <img src={preview} alt="preview" className="max-h-64 rounded-xl object-contain shadow-md" />
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center">
                      <Icons.ScanLine className="w-8 h-8 text-blue-400" />
                    </div>
                    <p className="text-sm font-semibold text-blue-700 dark:text-slate-300">
                      Arraste a foto do cupom ou clique para selecionar
                    </p>
                    <p className="text-xs text-blue-400 dark:text-slate-500">JPG, PNG, WEBP — até 20 MB</p>
                  </>
                )}
              </div>

              {preview && (
                <p className="text-xs text-center text-blue-400 dark:text-slate-500">
                  {file?.name} — clique na área acima para trocar
                </p>
              )}

              {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Step: scanning ── */}
          {step === 'scanning' && (
            <div className="flex flex-col items-center justify-center py-16 gap-5">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-slate-700" />
                <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icons.ScanLine className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-bold text-blue-900 dark:text-slate-100 mb-1">Analisando cupom fiscal...</p>
                <p className="text-sm text-blue-400 dark:text-slate-500">
                  Claude IA está identificando os itens, preços e categorias
                </p>
              </div>
            </div>
          )}

          {/* ── Step: review ── */}
          {step === 'review' && scanned && (
            <div className="space-y-5">
              {/* Receipt header */}
              <div className="rounded-2xl bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-blue-900 dark:text-slate-100 text-base">
                      {scanned.issuerName ?? 'Estabelecimento'}
                    </p>
                    {scanned.issuerCnpj && (
                      <p className="text-xs text-blue-400 dark:text-slate-500 mt-0.5">CNPJ: {scanned.issuerCnpj}</p>
                    )}
                    {scanned.issueDate && (
                      <p className="text-xs text-blue-400 dark:text-slate-500">
                        Data: {new Date(scanned.issueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-blue-400 dark:text-slate-500 uppercase tracking-wider">Total</p>
                    <p className="text-2xl font-black text-blue-900 dark:text-slate-100">
                      {formatCurrency(scanned.totalAmount)}
                    </p>
                    <p className="text-xs text-blue-400 dark:text-slate-500">{items.length} iten{items.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>

              {/* Items table */}
              <div>
                <h4 className="text-xs font-bold text-blue-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Itens do cupom — ajuste as categorias se necessário
                </h4>
                <div className="rounded-xl border border-blue-100 dark:border-slate-700 overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-wider bg-blue-50/80 dark:bg-slate-800/80 px-3 py-2 gap-2">
                    <span>Produto</span>
                    <span className="text-right">Qtd</span>
                    <span className="text-right">Total</span>
                    <span>Categoria</span>
                  </div>
                  <div className="divide-y divide-blue-50 dark:divide-slate-800">
                    {items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2.5 hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-blue-900 dark:text-slate-100 truncate">{item.description}</p>
                          <p className="text-[10px] text-blue-400 dark:text-slate-500">
                            {formatCurrency(item.unitPrice)} / {item.unit}
                          </p>
                        </div>
                        <span className="text-xs text-blue-600 dark:text-slate-300 font-semibold text-right whitespace-nowrap">
                          {Number(item.quantity) % 1 === 0 ? Number(item.quantity).toFixed(0) : Number(item.quantity).toFixed(3)} {item.unit}
                        </span>
                        <span className="text-xs font-bold text-blue-900 dark:text-slate-100 text-right whitespace-nowrap">
                          {formatCurrency(item.totalPrice)}
                        </span>
                        <select
                          value={item.categoryId ?? ''}
                          onChange={e => setItemCategory(idx, e.target.value || null)}
                          className="text-[10px] border border-blue-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-blue-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-[120px]"
                        >
                          <option value="">— nenhuma —</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transaction form */}
              <div className="rounded-2xl border border-blue-100 dark:border-slate-700 px-5 py-4 space-y-3">
                <h4 className="text-xs font-bold text-blue-500 dark:text-slate-400 uppercase tracking-wider">
                  Dados da transação
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-blue-600 dark:text-slate-400 mb-1 block">Conta *</label>
                    <select
                      value={accountId}
                      onChange={e => setAccountId(e.target.value)}
                      className="w-full text-sm border border-blue-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-blue-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-blue-600 dark:text-slate-400 mb-1 block">Pagamento</label>
                    <select
                      value={payMethod}
                      onChange={e => setPayMethod(e.target.value)}
                      className="w-full text-sm border border-blue-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-blue-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="debit">Débito</option>
                      <option value="credit">Crédito</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-blue-600 dark:text-slate-400 mb-1 block">Descrição</label>
                  <input
                    value={txDesc}
                    onChange={e => setTxDesc(e.target.value)}
                    className="w-full text-sm border border-blue-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-blue-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Descrição da transação"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Step: success ── */}
          {step === 'success' && scanned && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                <Icons.CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-blue-900 dark:text-slate-100 text-lg mb-1">Cupom importado!</p>
                <p className="text-sm text-blue-400 dark:text-slate-500">
                  {items.length} iten{items.length !== 1 ? 's' : ''} de {formatCurrency(scanned.totalAmount)} registrados com sucesso.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-blue-50 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          {step === 'success' ? (
            <button onClick={handleClose} className="ml-auto px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
              Fechar
            </button>
          ) : (
            <>
              <button
                onClick={step === 'review' ? () => { setStep('upload'); setError(null); } : handleClose}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-blue-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
              >
                {step === 'review' ? '← Voltar' : 'Cancelar'}
              </button>

              {step === 'upload' && (
                <button
                  onClick={scan}
                  disabled={!file}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Icons.ScanLine className="w-4 h-4" />
                  Analisar com IA
                </button>
              )}

              {step === 'review' && (
                <button
                  onClick={confirm}
                  disabled={saving || !accountId}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
                    : <><Icons.CheckCircle className="w-4 h-4" /> Confirmar e Salvar</>
                  }
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
