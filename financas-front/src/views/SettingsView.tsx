import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Icons } from '../components/Icons';
import { settingsApi, usersApi, UpdateUserPayload } from '../services/api';
import { UserSettings, UserProfile } from '../types';
import { User } from '../firebase';
import { CURRENCIES } from '../lib/constants';

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({ title, icon, color, children }: {
  title: string; icon: keyof typeof Icons; color: string; children: React.ReactNode;
}) {
  const Icon = Icons[icon];
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-100/60 dark:border-slate-700/60 shadow-sm overflow-hidden">
      <div className={cn('flex items-center gap-3 px-5 py-4 border-b border-blue-50 dark:border-slate-800', color)}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/30 dark:bg-black/20">
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="font-bold text-sm tracking-wide uppercase">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-blue-900 dark:text-slate-100">{label}</p>
        {description && <p className="text-xs text-blue-400 dark:text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none',
          checked ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700',
        )}
      >
        <span className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 mt-0.5',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )} />
      </button>
    </div>
  );
}

function SliderField({ label, description, value, min, max, step = 1, suffix = '', onChange }: {
  label: string; description?: string; value: number; min: number; max: number;
  step?: number; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-blue-900 dark:text-slate-100">{label}</p>
          {description && <p className="text-xs text-blue-400 dark:text-slate-500">{description}</p>}
        </div>
        <span className="text-sm font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-lg">
          {value}{suffix}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-blue-100 dark:bg-slate-700 accent-blue-600 cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-blue-300 dark:text-slate-600">
        <span>{min}{suffix}</span><span>{max}{suffix}</span>
      </div>
    </div>
  );
}

function NumberField({ label, description, value, min, max, step = 1, suffix = '', prefix = '', onChange }: {
  label: string; description?: string; value: number; min: number; max: number;
  step?: number; suffix?: string; prefix?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-blue-900 dark:text-slate-100">{label}</p>
        {description && <p className="text-xs text-blue-400 dark:text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {prefix && <span className="text-xs text-blue-400">{prefix}</span>}
        <input
          type="number" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
          className="w-20 text-center text-sm font-bold rounded-xl border border-blue-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-900 dark:text-slate-100 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {suffix && <span className="text-xs text-blue-400">{suffix}</span>}
      </div>
    </div>
  );
}

function RadioGroup({ label, description, value, options, onChange }: {
  label: string; description?: string; value: string;
  options: { value: string; label: string; desc: string; color: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-blue-900 dark:text-slate-100">{label}</p>
        {description && <p className="text-xs text-blue-400 dark:text-slate-500">{description}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex flex-col items-center p-3 rounded-xl border-2 text-center transition-all',
              value === opt.value
                ? opt.color + ' border-current'
                : 'border-blue-100 dark:border-slate-700 text-blue-400 dark:text-slate-500 hover:border-blue-200 dark:hover:border-slate-600',
            )}
          >
            <span className="text-sm font-bold">{opt.label}</span>
            <span className="text-[10px] mt-0.5 opacity-75">{opt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AllocationBar({ fixed, variable, international }: { fixed: number; variable: number; international: number }) {
  const total = fixed + variable + international;
  const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-blue-500 dark:text-slate-400">Distribuição alvo (total: {total}%)</p>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        <div className="bg-blue-500 transition-all" style={{ width: `${pct(fixed)}%` }} title={`Renda fixa ${pct(fixed)}%`} />
        <div className="bg-emerald-500 transition-all" style={{ width: `${pct(variable)}%` }} title={`Variável ${pct(variable)}%`} />
        <div className="bg-violet-500 transition-all" style={{ width: `${pct(international)}%` }} title={`Internacional ${pct(international)}%`} />
      </div>
      <div className="flex gap-3 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Renda Fixa {fixed}%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Variável {variable}%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" />Internacional {international}%</span>
      </div>
      {total !== 100 && (
        <p className="text-xs text-amber-500 font-medium">⚠ Total deve ser 100% (atual: {total}%)</p>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

interface Props {
  user: User;
  profile: UserProfile | null;
  onProfileUpdate: (data: UpdateUserPayload) => Promise<void>;
}

const DEFAULT_SETTINGS: UserSettings = {
  id: '', userId: '',
  emailNotifications: true, weeklyReport: true, monthlyReport: true, pushNotifications: true,
  reminderAdvanceDays: 3, reminderFrequency: 'daily',
  budgetAlertThreshold: 80, lowBalanceAlert: 100, largeTransactionAlert: 500, creditUsageAlert: 70,
  emergencyFundMonths: 6, savingsRateTarget: 20, debtIncomeLimit: 30,
  riskProfile: 'moderate', rebalanceAlert: true, rebalanceThreshold: 5,
  fixedIncomeTarget: 40, variableTarget: 40, internationalTarget: 20,
  showMarketNews: true, showEconomicNews: true, showPersonalTips: true,
};

export function SettingsView({ user, profile, onProfileUpdate }: Props) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile fields
  const [displayName, setDisplayName] = useState(profile?.displayName ?? user.displayName ?? '');
  const [currency, setCurrency] = useState(profile?.currency ?? 'BRL');

  useEffect(() => {
    settingsApi.get()
      .then(data => { setSettings(s => ({ ...s, ...data })); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) =>
    setSettings(s => ({ ...s, [key]: value }));

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await Promise.all([
        settingsApi.update(settings),
        onProfileUpdate({ displayName: displayName.trim() || undefined, currency }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">

      {/* ── Perfil ─────────────────────────────────────────────────────────── */}
      <SectionCard title="Perfil" icon="User" color="text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20">
        <div className="flex items-center gap-4 pb-2">
          <img src={user.photoURL || ''} className="w-14 h-14 rounded-full border-2 border-blue-200 dark:border-slate-600 object-cover" alt="" />
          <div className="min-w-0">
            <p className="font-bold text-blue-900 dark:text-slate-100 truncate">{user.displayName}</p>
            <p className="text-sm text-blue-400 dark:text-slate-500 truncate">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Nome de exibição</label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-blue-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-blue-900 dark:text-slate-100 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-blue-500 dark:text-slate-400 uppercase tracking-wider">Moeda padrão</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full rounded-xl border border-blue-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-blue-900 dark:text-slate-100 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.label} ({c.code})</option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      {/* ── Comunicação ────────────────────────────────────────────────────── */}
      <SectionCard title="Comunicação" icon="Bell" color="text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20">
        <Toggle label="Notificações por e-mail" description="Receba alertas financeiros no seu e-mail"
          checked={settings.emailNotifications} onChange={v => set('emailNotifications', v)} />
        <Toggle label="Notificações push" description="Alertas em tempo real no navegador"
          checked={settings.pushNotifications} onChange={v => set('pushNotifications', v)} />
        <Toggle label="Relatório semanal" description="Resumo das movimentações da semana toda segunda-feira"
          checked={settings.weeklyReport} onChange={v => set('weeklyReport', v)} />
        <Toggle label="Relatório mensal" description="Análise completa do mês no primeiro dia útil"
          checked={settings.monthlyReport} onChange={v => set('monthlyReport', v)} />
      </SectionCard>

      {/* ── Lembretes ──────────────────────────────────────────────────────── */}
      <SectionCard title="Lembretes" icon="Clock" color="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20">
        <SliderField
          label="Antecedência dos avisos"
          description="Quantos dias antes do vencimento você quer ser avisado"
          value={settings.reminderAdvanceDays} min={1} max={14} suffix=" dias"
          onChange={v => set('reminderAdvanceDays', v)}
        />
        <div className="space-y-2">
          <p className="text-sm font-medium text-blue-900 dark:text-slate-100">Frequência de lembretes</p>
          <div className="flex gap-2">
            {(['daily', 'weekly'] as const).map(f => (
              <button key={f} type="button"
                onClick={() => set('reminderFrequency', f)}
                className={cn(
                  'flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all',
                  settings.reminderFrequency === f
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    : 'border-blue-100 dark:border-slate-700 text-blue-400 dark:text-slate-500 hover:border-blue-200',
                )}
              >
                {f === 'daily' ? 'Diária' : 'Semanal'}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Alertas & Limites ──────────────────────────────────────────────── */}
      <SectionCard title="Alertas & Limites" icon="AlertCircle" color="text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20">
        <SliderField
          label="Alerta de orçamento"
          description="Notificação quando atingir este percentual do orçamento da categoria"
          value={settings.budgetAlertThreshold} min={50} max={100} suffix="%"
          onChange={v => set('budgetAlertThreshold', v)}
        />
        <SliderField
          label="Alerta de uso do cartão"
          description="Aviso quando o cartão de crédito atingir este percentual do limite"
          value={settings.creditUsageAlert} min={50} max={100} suffix="%"
          onChange={v => set('creditUsageAlert', v)}
        />
        <NumberField
          label="Saldo mínimo de alerta"
          description="Avisa quando o saldo de qualquer conta cair abaixo deste valor"
          value={settings.lowBalanceAlert} min={0} max={100000} step={50} prefix="R$"
          onChange={v => set('lowBalanceAlert', v)}
        />
        <NumberField
          label="Alerta de transação grande"
          description="Notifica quando uma única transação superar este valor"
          value={settings.largeTransactionAlert} min={0} max={1000000} step={100} prefix="R$"
          onChange={v => set('largeTransactionAlert', v)}
        />
      </SectionCard>

      {/* ── Saúde Financeira ───────────────────────────────────────────────── */}
      <SectionCard title="Saúde Financeira" icon="HeartPulse" color="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20">
        <SliderField
          label="Meta de reserva de emergência"
          description="Quantos meses de despesas você quer manter de reserva"
          value={settings.emergencyFundMonths} min={1} max={24} step={0.5} suffix=" meses"
          onChange={v => set('emergencyFundMonths', v)}
        />
        <SliderField
          label="Meta de taxa de poupança"
          description="Percentual da renda que você quer poupar mensalmente"
          value={settings.savingsRateTarget} min={1} max={80} suffix="%"
          onChange={v => set('savingsRateTarget', v)}
        />
        <SliderField
          label="Limite de endividamento"
          description="Percentual máximo da renda comprometida com dívidas (saudável: abaixo de 30%)"
          value={settings.debtIncomeLimit} min={5} max={80} suffix="%"
          onChange={v => set('debtIncomeLimit', v)}
        />

        {/* Health score preview */}
        <div className="mt-2 p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Parâmetros configurados</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Reserva', value: `${settings.emergencyFundMonths} meses` },
              { label: 'Poupança', value: `${settings.savingsRateTarget}%` },
              { label: 'Dívida', value: `≤ ${settings.debtIncomeLimit}%` },
            ].map(item => (
              <div key={item.label} className="bg-white dark:bg-slate-800 rounded-xl p-2.5 border border-emerald-100 dark:border-emerald-900/40">
                <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">{item.value}</p>
                <p className="text-[10px] text-emerald-500 dark:text-emerald-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Investimentos ──────────────────────────────────────────────────── */}
      <SectionCard title="Investimentos" icon="TrendingUp" color="text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/20">
        <RadioGroup
          label="Perfil de risco"
          description="Define sua tolerância a volatilidade e define alertas automáticos"
          value={settings.riskProfile}
          options={[
            { value: 'conservative', label: 'Conservador', desc: 'Estabilidade', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' },
            { value: 'moderate',     label: 'Moderado',    desc: 'Equilíbrio',   color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30' },
            { value: 'aggressive',   label: 'Arrojado',    desc: 'Crescimento',  color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30' },
          ]}
          onChange={v => set('riskProfile', v as any)}
        />

        <Toggle label="Alerta de rebalanceamento"
          description="Notifica quando a carteira divergir da alocação alvo"
          checked={settings.rebalanceAlert} onChange={v => set('rebalanceAlert', v)} />

        {settings.rebalanceAlert && (
          <SliderField
            label="Tolerância de desvio"
            description="Percentual de diferença para disparar o alerta"
            value={settings.rebalanceThreshold} min={1} max={30} suffix="%"
            onChange={v => set('rebalanceThreshold', v)}
          />
        )}

        <div className="space-y-3 pt-1">
          <p className="text-sm font-medium text-blue-900 dark:text-slate-100">Alocação alvo da carteira</p>
          <NumberField label="Renda Fixa" value={settings.fixedIncomeTarget} min={0} max={100} suffix="%" onChange={v => set('fixedIncomeTarget', v)} />
          <NumberField label="Renda Variável" value={settings.variableTarget} min={0} max={100} suffix="%" onChange={v => set('variableTarget', v)} />
          <NumberField label="Internacional" value={settings.internationalTarget} min={0} max={100} suffix="%" onChange={v => set('internationalTarget', v)} />
          <AllocationBar fixed={settings.fixedIncomeTarget} variable={settings.variableTarget} international={settings.internationalTarget} />
        </div>
      </SectionCard>

      {/* ── Notícias & Informações ─────────────────────────────────────────── */}
      <SectionCard title="Notícias & Informações" icon="Globe" color="text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20">
        <Toggle label="Notícias do mercado financeiro"
          description="Atualidades sobre bolsa, câmbio e juros"
          checked={settings.showMarketNews} onChange={v => set('showMarketNews', v)} />
        <Toggle label="Notícias econômicas"
          description="IPCA, SELIC, PIB e indicadores macroeconômicos"
          checked={settings.showEconomicNews} onChange={v => set('showEconomicNews', v)} />
        <Toggle label="Dicas de finanças pessoais"
          description="Conteúdo educativo sobre gestão financeira e investimentos"
          checked={settings.showPersonalTips} onChange={v => set('showPersonalTips', v)} />
      </SectionCard>

      {/* ── Save bar ───────────────────────────────────────────────────────── */}
      <div className="sticky bottom-4 z-10">
        <div className="bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-700 rounded-2xl shadow-lg px-5 py-4 flex items-center justify-between gap-4">
          {error ? (
            <p className="text-sm text-rose-500 font-medium flex items-center gap-2">
              <Icons.AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </p>
          ) : saved ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-2">
              <Icons.CheckCircle className="w-4 h-4" /> Configurações salvas com sucesso!
            </p>
          ) : (
            <p className="text-sm text-blue-400 dark:text-slate-500">Ajuste as configurações e salve quando quiser.</p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors shadow-sm shadow-blue-600/20"
          >
            {saving
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Salvando...</>
              : <><Icons.Check className="w-4 h-4" />Salvar configurações</>
            }
          </button>
        </div>
      </div>
    </motion.div>
  );
}
