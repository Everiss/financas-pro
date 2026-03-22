import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Icons } from '../components/Icons';
import { Button, Card } from '../components/ui';
import { subscriptionApi, SubscriptionStatus } from '../services/api';

export function PlanosView() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const STRIPE_PRICE_PRO = import.meta.env.VITE_STRIPE_PRICE_PRO ?? '';
  const STRIPE_PRICE_FAMILY = import.meta.env.VITE_STRIPE_PRICE_FAMILY ?? '';

  useEffect(() => {
    subscriptionApi.getStatus().then(setStatus).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleCheckout = async (priceId: string) => {
    if (!priceId) return alert('Stripe price ID não configurado.');
    setCheckoutLoading(priceId);
    try {
      const { url } = await subscriptionApi.checkout(priceId);
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    try {
      const { url } = await subscriptionApi.portal();
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
    }
  };

  const plans = [
    {
      id: 'FREE',
      name: 'Gratuito',
      price: 'R$ 0',
      period: '',
      color: 'from-slate-500 to-slate-600',
      priceId: '',
      features: [
        '50 transações por mês',
        '2 contas',
        '2 metas',
        'Dashboard básico',
        'Categorias',
      ],
      missing: ['IA financeira', 'Open Finance', 'Exportar Excel', 'Relatórios avançados'],
    },
    {
      id: 'PRO',
      name: 'Pro',
      price: 'R$ 19',
      period: '/mês',
      color: 'from-blue-600 to-blue-700',
      priceId: STRIPE_PRICE_PRO,
      badge: 'Mais popular',
      features: [
        'Transações ilimitadas',
        'Contas ilimitadas',
        'Metas ilimitadas',
        'IA financeira (insights)',
        'Open Finance Brasil',
        'Exportar Excel',
        'Suporte prioritário',
      ],
      missing: [],
    },
    {
      id: 'FAMILY',
      name: 'Família',
      price: 'R$ 39',
      period: '/mês',
      color: 'from-violet-600 to-violet-700',
      priceId: STRIPE_PRICE_FAMILY,
      features: [
        'Tudo do Pro',
        'Até 5 usuários',
        'Dashboard familiar',
        'Metas compartilhadas',
        'Suporte VIP',
      ],
      missing: [],
    },
  ];

  if (loading) {
    return <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  }

  const currentPlan = status?.plan ?? 'FREE';
  const isTrialActive = status?.trialActive;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Status atual */}
      {status?.subscription && (
        <Card className="p-5 border-none shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-blue-500 dark:text-slate-400">Assinatura ativa</p>
              <p className="font-semibold text-blue-900 dark:text-slate-100">
                Plano <span className="text-blue-600">{currentPlan}</span>
                {status.subscription.cancelAtPeriodEnd && <span className="ml-2 text-xs text-amber-500">(cancela em {new Date(status.subscription.currentPeriodEnd).toLocaleDateString('pt-BR')})</span>}
              </p>
            </div>
            <Button variant="secondary" onClick={handlePortal} className="text-sm">
              Gerenciar assinatura
            </Button>
          </div>
        </Card>
      )}

      {isTrialActive && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center gap-2">
          <Icons.Sparkles className="w-4 h-4 shrink-0" />
          Trial PRO ativo até {new Date(status!.trialEndsAt!).toLocaleDateString('pt-BR')} — aproveite todas as funcionalidades!
        </div>
      )}

      {/* Cards dos planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {plans.map(plan => {
          const isCurrent = currentPlan === plan.id;
          const isUpgrade = plan.id !== 'FREE' && !isCurrent;

          return (
            <div
              key={plan.id}
              className={cn(
                'rounded-3xl overflow-hidden shadow-sm border transition-all duration-300',
                isCurrent
                  ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/30'
                  : 'border-blue-100 dark:border-slate-700 hover:shadow-md',
              )}
            >
              {/* Header */}
              <div className={`bg-gradient-to-br ${plan.color} p-6 text-white relative`}>
                {(plan as any).badge && !isCurrent && (
                  <span className="absolute top-4 right-4 text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                    {(plan as any).badge}
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute top-4 right-4 text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                    Plano atual
                  </span>
                )}
                <p className="text-white/70 text-sm font-medium mb-1">{plan.name}</p>
                <p className="text-4xl font-bold tracking-tight">
                  {plan.price}<span className="text-lg font-normal text-white/70">{plan.period}</span>
                </p>
              </div>

              {/* Features */}
              <div className="p-6 bg-white dark:bg-slate-900 space-y-3">
                {plan.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-blue-800 dark:text-slate-200">
                    <Icons.Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    {f}
                  </div>
                ))}
                {plan.missing.map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-blue-300 dark:text-slate-600 line-through">
                    <Icons.X className="w-4 h-4 shrink-0" />
                    {f}
                  </div>
                ))}

                <div className="pt-4">
                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-full text-center text-sm font-medium bg-blue-50 dark:bg-slate-800 text-blue-500 dark:text-slate-400">
                      Plano atual
                    </div>
                  ) : isUpgrade ? (
                    <Button
                      variant="primary"
                      className="w-full"
                      disabled={checkoutLoading === plan.priceId}
                      onClick={() => handleCheckout(plan.priceId)}
                    >
                      {checkoutLoading === plan.priceId ? 'Aguarde...' : `Assinar ${plan.name}`}
                    </Button>
                  ) : (
                    <div className="w-full py-2.5 rounded-full text-center text-sm font-medium bg-slate-50 dark:bg-slate-800 text-slate-400">
                      Gratuito para sempre
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-blue-400 dark:text-slate-500 text-center">
        Pagamento seguro via Stripe. Cancele a qualquer momento.
      </p>
    </div>
  );
}
