import React, { createContext, useCallback, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Icons } from '../components/Icons';
import { Button } from '../components/ui';
import { cn } from '../lib/utils';

export interface ConfirmOptions {
  title: string;
  description?: string;
  items?: string[];           // lista de itens afetados
  requireText?: string;       // usuário deve digitar exatamente este texto
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue>({ confirm: async () => false });

export function useConfirm() {
  return useContext(ConfirmContext);
}

interface PendingConfirm {
  opts: ConfirmOptions;
  resolve: (v: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [inputValue, setInputValue] = useState('');

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setInputValue('');
    return new Promise(resolve => setPending({ opts, resolve }));
  }, []);

  const handleConfirm = () => {
    pending?.resolve(true);
    setPending(null);
  };

  const handleCancel = () => {
    pending?.resolve(false);
    setPending(null);
  };

  const opts = pending?.opts;
  const variant = opts?.variant ?? 'default';
  const requireText = opts?.requireText;
  const canConfirm = requireText ? inputValue === requireText : true;

  const iconMap = {
    danger: <Icons.Trash2 className="w-6 h-6 text-red-500" />,
    warning: <Icons.AlertCircle className="w-6 h-6 text-amber-500" />,
    default: <Icons.AlertCircle className="w-6 h-6 text-blue-500" />,
  };

  const iconBgMap = {
    danger: 'bg-red-50 dark:bg-red-950/40',
    warning: 'bg-amber-50 dark:bg-amber-950/40',
    default: 'bg-blue-50 dark:bg-blue-950/40',
  };

  const confirmBtnVariant: Record<string, 'danger' | 'primary'> = {
    danger: 'danger',
    warning: 'primary',
    default: 'primary',
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {pending && opts && (
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-blue-900/40 dark:bg-black/60 backdrop-blur-md" onClick={handleCancel} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="relative bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-blue-100 dark:border-slate-700 overflow-hidden"
            >
              <div className="p-6 space-y-4">
                {/* Ícone */}
                <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', iconBgMap[variant])}>
                  {iconMap[variant]}
                </div>

                {/* Título */}
                <div>
                  <h3 className="text-lg font-bold text-blue-900 dark:text-slate-100">
                    {opts.title}
                  </h3>
                  {opts.description && (
                    <p className="text-sm text-blue-500 dark:text-slate-400 mt-1">
                      {opts.description}
                    </p>
                  )}
                </div>

                {/* Lista de itens */}
                {opts.items && opts.items.length > 0 && (
                  <ul className="space-y-1.5 bg-blue-50/60 dark:bg-slate-800/60 rounded-xl px-4 py-3">
                    {opts.items.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-blue-700 dark:text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-slate-500 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Campo de texto obrigatório */}
                {requireText && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-blue-500 dark:text-slate-400">
                      Digite <span className="font-mono font-bold text-red-500">{requireText}</span> para confirmar
                    </p>
                    <input
                      autoFocus
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && canConfirm && handleConfirm()}
                      placeholder={requireText}
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 focus:border-red-400 focus:ring-4 focus:ring-red-50 dark:focus:ring-red-900/20 outline-none transition-all text-sm text-blue-900 dark:text-slate-100 font-mono placeholder:text-blue-200 dark:placeholder:text-slate-600"
                    />
                  </div>
                )}
              </div>

              {/* Botões */}
              <div className="px-6 pb-6 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={handleCancel}>
                  {opts.cancelLabel ?? 'Cancelar'}
                </Button>
                <Button
                  variant={confirmBtnVariant[variant]}
                  className="flex-1"
                  disabled={!canConfirm}
                  onClick={handleConfirm}
                >
                  {opts.confirmLabel ?? 'Confirmar'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
