import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '../lib/utils';
import { Icons, IconName } from '../components/Icons';
import { auditApi, AuditLogResponse } from '../services/api';
import { motion, AnimatePresence } from 'motion/react';

const ACTION_LABELS: Record<string, string> = { CREATE: 'Criação', UPDATE: 'Atualização', DELETE: 'Exclusão' };
const ENTITY_LABELS: Record<string, string> = { TRANSACTION: 'Transação', ACCOUNT: 'Conta', BANK: 'Banco', GOAL: 'Meta', REMINDER: 'Lembrete', CATEGORY: 'Categoria' };

const ACTION_STYLES: Record<string, { badge: string; dot: string; dotText: string }> = {
  CREATE: { badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', dotText: 'text-emerald-600' },
  UPDATE: { badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',            dot: 'bg-blue-500',    dotText: 'text-blue-600' },
  DELETE: { badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',                dot: 'bg-red-500',     dotText: 'text-red-600' },
};

const ENTITY_STYLES: Record<string, { icon: IconName; color: string }> = {
  TRANSACTION: { icon: 'ArrowUpRight', color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30' },
  ACCOUNT:     { icon: 'Wallet',       color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
  BANK:        { icon: 'Landmark',     color: 'text-slate-600 bg-slate-100 dark:bg-slate-800' },
  GOAL:        { icon: 'Target',       color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
  REMINDER:    { icon: 'Bell',         color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30' },
  CATEGORY:    { icon: 'Tag',          color: 'text-pink-600 bg-pink-100 dark:bg-pink-900/30' },
};

function humanizePayload(entity: string, payload: Record<string, unknown> | null): string {
  if (!payload) return '';
  if (entity === 'TRANSACTION') {
    const parts: string[] = [];
    if (payload.description) parts.push(String(payload.description));
    if (payload.amount) parts.push(`R$ ${Number(payload.amount).toFixed(2).replace('.', ',')}`);
    if (payload.type) parts.push(payload.type === 'income' ? '· Receita' : '· Despesa');
    return parts.join(' ');
  }
  if (entity === 'ACCOUNT' || entity === 'BANK') return payload.name ? String(payload.name) : '';
  if (entity === 'GOAL') {
    const parts: string[] = [];
    if (payload.name) parts.push(String(payload.name));
    if (payload.targetAmount) parts.push(`Meta: R$ ${Number(payload.targetAmount).toFixed(2).replace('.', ',')}`);
    return parts.join(' · ');
  }
  if (entity === 'REMINDER') {
    const parts: string[] = [];
    if (payload.title) parts.push(String(payload.title));
    if (payload.amount) parts.push(`R$ ${Number(payload.amount).toFixed(2).replace('.', ',')}`);
    return parts.join(' · ');
  }
  if (entity === 'CATEGORY') return payload.name ? String(payload.name) : '';
  return '';
}

const AUDIT_PAGE_SIZE = 25;

export function AuditLogView() {
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    auditApi.getAll({ limit: 500 })
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filterEntity, filterAction, search]);

  const filtered = useMemo(() => logs.filter(l => {
    if (filterEntity && l.entity !== filterEntity) return false;
    if (filterAction && l.action !== filterAction) return false;
    if (search) {
      const q = search.toLowerCase();
      const payload = l.payload?.toLowerCase() ?? '';
      if (!payload.includes(q) && !ENTITY_LABELS[l.entity]?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [logs, filterEntity, filterAction, search]);

  const stats = useMemo(() => ({
    total: logs.length,
    creates: logs.filter(l => l.action === 'CREATE').length,
    updates: logs.filter(l => l.action === 'UPDATE').length,
    deletes: logs.filter(l => l.action === 'DELETE').length,
    today: logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length,
  }), [logs]);

  const paginated = filtered.slice(0, page * AUDIT_PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  const grouped = useMemo(() => {
    const groups: Record<string, AuditLogResponse[]> = {};
    paginated.forEach(log => {
      const d = new Date(log.createdAt);
      const isToday = d.toDateString() === new Date().toDateString();
      const isYesterday = d.toDateString() === new Date(Date.now() - 86400000).toDateString();
      const dateKey = isToday ? 'Hoje' : isYesterday ? 'Ontem' : d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      (groups[dateKey] = groups[dateKey] || []).push(log);
    });
    return Object.entries(groups);
  }, [paginated]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, icon: 'List' as IconName, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Criações', value: stats.creates, icon: 'Plus' as IconName, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'Atualizações', value: stats.updates, icon: 'Edit2' as IconName, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Exclusões', value: stats.deletes, icon: 'Trash2' as IconName, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          ].map(s => {
            const Ic = Icons[s.icon];
            return (
              <div key={s.label} className={cn('rounded-2xl p-4 flex items-center gap-3', s.bg)}>
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center bg-white/70 dark:bg-slate-900/50 shrink-0', s.color)}>
                  <Ic className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-900 dark:text-slate-100 leading-none">{s.value}</p>
                  <p className="text-xs text-blue-500 dark:text-slate-400 mt-0.5">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nos registros..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)} className="text-sm px-3 py-2 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">Todas entidades</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="text-sm px-3 py-2 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">Todas ações</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-xs text-blue-400 dark:text-slate-500 font-medium whitespace-nowrap">
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="py-20 text-center">
          <div className="w-14 h-14 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
            <Icons.List className="w-6 h-6 text-blue-300 dark:text-slate-500" />
          </div>
          <p className="font-semibold text-blue-900 dark:text-slate-100">Nenhum registro encontrado</p>
          <p className="text-sm text-blue-400 dark:text-slate-500 mt-1">Tente ajustar os filtros de busca</p>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-8">
        {grouped.map(([dateLabel, dayLogs]) => (
          <div key={dateLabel}>
            {/* Day separator */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-blue-100 dark:bg-slate-700/60" />
              <span className="text-[11px] font-bold text-blue-500 dark:text-slate-400 uppercase tracking-widest capitalize px-2 py-1 rounded-full bg-blue-50 dark:bg-slate-800 whitespace-nowrap">
                {dateLabel}
              </span>
              <div className="h-px flex-1 bg-blue-100 dark:bg-slate-700/60" />
            </div>

            {/* Log entries */}
            <div className="space-y-2">
              {dayLogs.map(log => {
                const entityStyle = ENTITY_STYLES[log.entity] ?? { icon: 'List' as IconName, color: 'text-blue-600 bg-blue-100' };
                const actionStyle = ACTION_STYLES[log.action] ?? ACTION_STYLES.CREATE;
                const EntityIcon = Icons[entityStyle.icon];
                const isExpanded = expandedId === log.id;
                let parsedPayload: Record<string, unknown> | null = null;
                try { parsedPayload = log.payload ? JSON.parse(log.payload) : null; } catch {}
                const description = humanizePayload(log.entity, parsedPayload);

                return (
                  <div
                    key={log.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-800 overflow-hidden hover:border-blue-200 dark:hover:border-slate-700 transition-colors"
                  >
                    <div
                      className={cn('flex items-center gap-3 px-4 py-3', parsedPayload && 'cursor-pointer hover:bg-blue-50/40 dark:hover:bg-slate-800/40')}
                      onClick={() => parsedPayload && setExpandedId(isExpanded ? null : log.id)}
                    >
                      {/* Entity icon */}
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', entityStyle.color)}>
                        <EntityIcon className="w-4 h-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', actionStyle.badge)}>
                            {ACTION_LABELS[log.action]}
                          </span>
                          <span className="text-sm font-semibold text-blue-900 dark:text-slate-100">
                            {ENTITY_LABELS[log.entity]}
                          </span>
                          {description && (
                            <span className="text-xs text-blue-500 dark:text-slate-400 truncate max-w-[280px]">{description}</span>
                          )}
                        </div>
                        {log.entityId && (
                          <p className="text-[10px] text-blue-300 dark:text-slate-600 font-mono mt-0.5">#{log.entityId}</p>
                        )}
                      </div>

                      {/* Right: time + chevron */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-blue-400 dark:text-slate-500 font-medium tabular-nums">
                          {new Date(log.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {parsedPayload && (
                          <Icons.ChevronDown className={cn('w-3.5 h-3.5 text-blue-400 dark:text-slate-500 transition-transform duration-200', isExpanded && 'rotate-180')} />
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && parsedPayload && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                          <div className="px-4 pb-4 pt-2 border-t border-blue-50 dark:border-slate-800">
                            <p className="text-[10px] font-bold text-blue-400 dark:text-slate-500 uppercase tracking-widest mb-2">Dados do registro</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                              {Object.entries(parsedPayload).map(([k, v]) => (
                                <div key={k} className="flex items-start gap-2 text-xs">
                                  <span className="font-semibold text-blue-500 dark:text-slate-400 min-w-[90px] shrink-0">{k}</span>
                                  <span className="text-blue-800 dark:text-slate-200 break-all">{String(v)}</span>
                                </div>
                              ))}
                            </div>
                            {log.ip && (
                              <div className="flex items-center gap-2 text-xs pt-2 mt-2 border-t border-blue-50 dark:border-slate-800">
                                <Icons.Globe className="w-3 h-3 text-blue-400" />
                                <span className="text-blue-500 dark:text-slate-400 font-mono">{log.ip}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setPage(p => p + 1)}
            className="px-6 py-2.5 rounded-2xl border border-blue-200 dark:border-slate-700 text-sm font-semibold text-blue-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
          >
            Carregar mais ({filtered.length - paginated.length} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
