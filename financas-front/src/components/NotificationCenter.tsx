import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Icons } from './Icons';
import { notificationsApi, AppNotification } from '../services/api';

// ─── Config ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<AppNotification['severity'], string> = {
  danger:  'border-l-red-500   bg-red-50/60   dark:bg-red-950/20',
  warning: 'border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20',
  info:    'border-l-blue-400  bg-blue-50/40  dark:bg-blue-950/20',
  success: 'border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20',
};

const SEVERITY_ICON_CLASS: Record<AppNotification['severity'], string> = {
  danger:  'text-red-500',
  warning: 'text-amber-500',
  info:    'text-blue-400',
  success: 'text-emerald-500',
};

const TYPE_ICONS: Record<AppNotification['type'], React.FC<{ className?: string }>> = {
  reminder_overdue: Icons.AlertCircle,
  reminder_due:     Icons.Clock,
  budget_exceeded:  Icons.TrendingUp,
  goal_reached:     Icons.Trophy,
  debt_due:         Icons.Receipt,
};

// ─── NotificationCenter ──────────────────────────────────────────────────────

export function NotificationCenter({
  onNavigate,
}: {
  onNavigate: (tab: string) => void;
}) {
  const [open, setOpen]       = useState(false);
  const [items, setItems]     = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [read, setRead]       = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notif_read') ?? '[]')); }
    catch { return new Set(); }
  });

  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await notificationsApi.getAll();
      setItems(data);
    } catch {
      // silently fail — não bloquear a UI se o endpoint falhar
    } finally {
      setLoading(false);
    }
  }, []);

  // fetch inicial + polling
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // fechar ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unread = items.filter((n) => !read.has(n.id)).length;

  const markAllRead = () => {
    const all = new Set(items.map((n) => n.id));
    setRead(all);
    localStorage.setItem('notif_read', JSON.stringify([...all]));
  };

  const handleClick = (n: AppNotification) => {
    // marcar como lida
    const next = new Set([...read, n.id]);
    setRead(next);
    localStorage.setItem('notif_read', JSON.stringify([...next]));
    if (n.tab) {
      onNavigate(n.tab);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Bell button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative p-2 rounded-xl transition-colors',
          open
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            : 'text-blue-400 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-600',
        )}
        title="Notificações"
      >
        <Icons.Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-blue-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-blue-50 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Icons.Bell className="w-4 h-4 text-blue-500 dark:text-slate-400" />
                <p className="font-bold text-blue-900 dark:text-slate-100 text-sm">Notificações</p>
                {loading && (
                  <span className="text-[10px] text-blue-400 dark:text-slate-500 animate-pulse">atualizando...</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-blue-500 dark:text-blue-400 hover:underline font-medium"
                  >
                    Marcar tudo como lido
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-lg text-blue-300 hover:text-blue-600 dark:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <Icons.X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto divide-y divide-blue-50 dark:divide-slate-800">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-blue-300 dark:text-slate-600">
                  <Icons.CheckCircle className="w-10 h-10" />
                  <p className="text-sm font-medium">Tudo em dia!</p>
                  <p className="text-xs text-center max-w-[200px]">
                    Sem lembretes vencidos, orçamentos ok, metas no caminho certo.
                  </p>
                </div>
              ) : (
                items.map((n) => {
                  const isRead = read.has(n.id);
                  const Icon = TYPE_ICONS[n.type] ?? Icons.Bell;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={cn(
                        'w-full text-left px-5 py-3.5 border-l-4 transition-all hover:brightness-95',
                        SEVERITY_STYLES[n.severity],
                        isRead && 'opacity-50',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', SEVERITY_ICON_CLASS[n.severity])} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn('text-sm font-semibold text-blue-900 dark:text-slate-100 truncate', isRead && 'font-medium')}>
                              {n.title}
                            </p>
                            {!isRead && (
                              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-blue-500 dark:text-slate-400 mt-0.5 leading-snug">
                            {n.description}
                          </p>
                        </div>
                        {n.tab && (
                          <Icons.ChevronRight className="w-3.5 h-3.5 text-blue-300 dark:text-slate-600 shrink-0 mt-1" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="px-5 py-3 border-t border-blue-50 dark:border-slate-800 bg-blue-50/30 dark:bg-slate-800/30">
                <p className="text-[11px] text-blue-400 dark:text-slate-500 text-center">
                  Atualiza automaticamente a cada 5 minutos · Clique para navegar
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
