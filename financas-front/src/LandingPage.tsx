import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LandingPageProps {
  onLogin: () => void;
}

const FEATURES = [
  {
    icon: '📊',
    title: 'Dashboard inteligente',
    desc: 'Visão completa das suas finanças: receitas, despesas, saldo e tendências em um único lugar.',
  },
  {
    icon: '🤖',
    title: 'IA Financeira',
    desc: 'Insights personalizados gerados por inteligência artificial com base no seu perfil de gastos.',
  },
  {
    icon: '🏦',
    title: 'Open Finance',
    desc: 'Conecte suas contas bancárias reais via Open Finance Brasil e veja tudo centralizado.',
  },
  {
    icon: '🎯',
    title: 'Metas & Objetivos',
    desc: 'Defina metas financeiras, acompanhe o progresso e receba estratégias para alcançá-las mais rápido.',
  },
  {
    icon: '📅',
    title: 'Calendário Financeiro',
    desc: 'Visualize vencimentos, lembretes e períodos críticos em um calendário interativo.',
  },
  {
    icon: '📈',
    title: 'Investimentos',
    desc: 'Acompanhe seu patrimônio investido, alocação de ativos e evolução ao longo do tempo.',
  },
];

const STEPS = [
  { num: '01', title: 'Crie sua conta grátis', desc: 'Cadastro em segundos com o Google. Sem cartão de crédito.' },
  { num: '02', title: 'Configure suas finanças', desc: 'Adicione contas, categorias e importe transações automaticamente.' },
  { num: '03', title: 'Tome decisões melhores', desc: 'Receba insights da IA e alcance seus objetivos financeiros.' },
];

const PLANS = [
  {
    name: 'Gratuito',
    price: 'R$ 0',
    period: '',
    color: '#64748b',
    highlight: false,
    features: ['50 transações/mês', '2 contas', '2 metas', 'Dashboard básico', 'Categorias'],
    cta: 'Começar grátis',
  },
  {
    name: 'Pro',
    price: 'R$ 19',
    period: '/mês',
    color: '#2563eb',
    highlight: true,
    badge: 'Mais popular',
    features: ['Transações ilimitadas', 'Contas ilimitadas', 'IA financeira', 'Open Finance', 'Exportar Excel', 'Suporte prioritário'],
    cta: 'Assinar Pro',
  },
  {
    name: 'Família',
    price: 'R$ 39',
    period: '/mês',
    color: '#7c3aed',
    highlight: false,
    features: ['Tudo do Pro', 'Até 5 usuários', 'Metas compartilhadas', 'Dashboard familiar', 'Suporte VIP'],
    cta: 'Assinar Família',
  },
];

const TESTIMONIALS = [
  {
    name: 'Ana Carolina',
    role: 'Professora',
    avatar: 'AC',
    color: '#ec4899',
    text: 'Finalmente consegui organizar minhas finanças. Os insights da IA me ajudaram a reduzir gastos em 30% no primeiro mês!',
  },
  {
    name: 'Ricardo Mendes',
    role: 'Engenheiro',
    avatar: 'RM',
    color: '#2563eb',
    text: 'O melhor app financeiro que já usei. A integração com Open Finance é perfeita — tudo em um lugar só.',
  },
  {
    name: 'Fernanda Lima',
    role: 'Empreendedora',
    avatar: 'FL',
    color: '#10b981',
    text: 'Uso com minha família no plano Família. Conseguimos juntar para a viagem dos sonhos em 8 meses!',
  },
];

const FAQS = [
  { q: 'Preciso informar dados bancários?', a: 'Não. A conexão via Open Finance é feita de forma segura e regulamentada pelo Banco Central. Você autoriza somente leitura dos dados.' },
  { q: 'Posso cancelar a qualquer momento?', a: 'Sim. Não há fidelidade. Cancele quando quiser pelo portal de assinatura e não será cobrado no próximo ciclo.' },
  { q: 'Como funciona o trial de 14 dias?', a: 'Ao criar sua conta, você tem 14 dias de acesso gratuito a todos os recursos PRO, sem precisar inserir cartão de crédito.' },
  { q: 'Meus dados são seguros?', a: 'Sim. Seus dados são criptografados, nunca compartilhados com terceiros e armazenados em servidores seguros na AWS.' },
  { q: 'O app funciona no celular?', a: 'Sim. A interface é totalmente responsiva e funciona perfeitamente em qualquer dispositivo.' },
];

const STATS = [
  { value: '10.000+', label: 'Usuários ativos' },
  { value: 'R$ 2M+', label: 'Transações gerenciadas' },
  { value: '4.9 ★', label: 'Avaliação média' },
  { value: '14 dias', label: 'Trial gratuito' },
];

export function LandingPage({ onLogin }: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased overflow-x-hidden">

      {/* ─── NAVBAR ──────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/30">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">Finanças Pro</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Funcionalidades</a>
            <a href="#como-funciona" className="hover:text-blue-600 transition-colors">Como funciona</a>
            <a href="#planos" className="hover:text-blue-600 transition-colors">Planos</a>
            <a href="#faq" className="hover:text-blue-600 transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="hidden sm:block text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors px-3 py-2"
            >
              Entrar
            </button>
            <button
              onClick={onLogin}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all shadow-md shadow-blue-600/20 hover:shadow-blue-600/40 active:scale-95"
            >
              Começar grátis
            </button>
            {/* Mobile menu */}
            <button className="md:hidden p-2" onClick={() => setMenuOpen(v => !v)}>
              <span className="block w-5 h-0.5 bg-slate-600 mb-1" />
              <span className="block w-5 h-0.5 bg-slate-600 mb-1" />
              <span className="block w-5 h-0.5 bg-slate-600" />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-slate-100 bg-white px-4 py-4 flex flex-col gap-4 text-sm font-medium text-slate-700"
            >
              {['#features', '#como-funciona', '#planos', '#faq'].map((href, i) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)} className="hover:text-blue-600">
                  {['Funcionalidades', 'Como funciona', 'Planos', 'FAQ'][i]}
                </a>
              ))}
              <button onClick={onLogin} className="text-left text-blue-600 font-semibold">Entrar com Google →</button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─── HERO ────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-4 sm:px-6 bg-gradient-to-b from-blue-50/60 to-white relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              Trial PRO grátis por 14 dias — sem cartão
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tighter text-slate-900 leading-[1.05] mb-6">
              Suas finanças,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">
                finalmente sob controle
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-500 font-medium mb-10 max-w-xl mx-auto leading-relaxed">
              Dashboard completo, IA financeira, Open Finance e muito mais. Tudo que você precisa para organizar e fazer seu dinheiro crescer.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={onLogin}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-xl shadow-blue-600/25 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" opacity=".9"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" opacity=".8"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" opacity=".9"/>
                </svg>
                Começar grátis com Google
              </button>
              <a
                href="#como-funciona"
                className="w-full sm:w-auto text-slate-600 hover:text-blue-600 font-semibold px-6 py-4 rounded-2xl border border-slate-200 hover:border-blue-200 transition-all text-base text-center"
              >
                Ver como funciona →
              </a>
            </div>

            <p className="text-xs text-slate-400 mt-4">Sem cartão de crédito • Cancele quando quiser • 14 dias PRO grátis</p>
          </motion.div>

          {/* Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-16 relative"
          >
            <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden max-w-4xl mx-auto">
              {/* Browser chrome */}
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <div className="ml-4 flex-1 bg-white rounded-lg px-3 py-1 text-xs text-slate-400 border border-slate-200 max-w-xs">
                  app.financaspro.com.br
                </div>
              </div>
              {/* Dashboard preview */}
              <div className="p-6 bg-slate-950">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Saldo Total', value: 'R$ 12.450', color: '#2563eb', icon: '💰' },
                    { label: 'Receitas', value: 'R$ 8.200', color: '#10b981', icon: '📈' },
                    { label: 'Despesas', value: 'R$ 3.750', color: '#ef4444', icon: '📉' },
                  ].map(card => (
                    <div key={card.label} className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
                      <p className="text-slate-400 text-xs mb-1">{card.icon} {card.label}</p>
                      <p className="text-white font-bold text-lg tracking-tight">{card.value}</p>
                      <p className="text-emerald-400 text-xs mt-1">▲ 8% este mês</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-3">
                  <div className="col-span-3 bg-slate-900 rounded-2xl p-4 border border-slate-800 h-28 flex flex-col justify-between">
                    <p className="text-slate-400 text-xs">Evolução do saldo</p>
                    <div className="flex items-end gap-1 h-14">
                      {[40, 65, 45, 75, 60, 85, 70, 95, 80, 100, 88, 100].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === 11 ? '#2563eb' : '#1e3a5f' }} />
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2 bg-slate-900 rounded-2xl p-4 border border-slate-800 h-28 flex flex-col gap-2">
                    <p className="text-slate-400 text-xs">💡 Insight IA</p>
                    <p className="text-slate-300 text-xs leading-relaxed">Você gastou 23% mais em alimentação este mês. Considere revisar esse orçamento.</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Floating cards */}
            <div className="absolute -left-4 top-1/3 bg-white rounded-2xl shadow-xl p-3 border border-slate-100 hidden lg:flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center text-sm">✅</div>
              <div>
                <p className="text-xs font-semibold text-slate-800">Meta atingida!</p>
                <p className="text-xs text-slate-400">Reserva de emergência</p>
              </div>
            </div>
            <div className="absolute -right-4 top-1/4 bg-white rounded-2xl shadow-xl p-3 border border-slate-100 hidden lg:flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center text-sm">🏦</div>
              <div>
                <p className="text-xs font-semibold text-slate-800">Open Finance</p>
                <p className="text-xs text-slate-400">3 bancos conectados</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── STATS ───────────────────────────────────────────── */}
      <section className="py-14 border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <p className="text-3xl font-extrabold text-blue-600 tracking-tight">{s.value}</p>
              <p className="text-sm text-slate-500 font-medium mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ────────────────────────────────────────── */}
      <section id="features" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Funcionalidades</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
              Tudo que suas finanças precisam
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Do controle do dia a dia até investimentos e metas de longo prazo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-white border border-slate-100 rounded-3xl p-6 hover:shadow-lg hover:shadow-slate-100 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────────── */}
      <section id="como-funciona" className="py-24 px-4 sm:px-6 bg-slate-950 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-blue-400 font-semibold text-sm uppercase tracking-widest mb-3">Como funciona</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              Comece em 3 passos simples
            </h2>
            <p className="text-slate-400 text-lg">Sem complicação. Do cadastro ao controle total em minutos.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-blue-600/40 to-transparent -translate-x-8 z-0" />
                )}
                <div className="relative z-10 bg-slate-900 border border-slate-800 rounded-3xl p-6">
                  <div className="text-5xl font-extrabold text-blue-600/20 mb-4 tracking-tighter">{s.num}</div>
                  <h3 className="font-bold text-white text-lg mb-2">{s.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={onLogin}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-xl shadow-blue-600/20 hover:-translate-y-0.5 active:scale-95"
            >
              Criar conta grátis agora
            </button>
          </div>
        </div>
      </section>

      {/* ─── PRICING ─────────────────────────────────────────── */}
      <section id="planos" className="py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Planos</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
              Preço justo para cada momento
            </h2>
            <p className="text-slate-500 text-lg">Comece grátis. Faça upgrade quando precisar.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-3xl overflow-hidden border transition-all ${
                  plan.highlight
                    ? 'border-blue-400 ring-4 ring-blue-400/10 shadow-2xl shadow-blue-500/10'
                    : 'border-slate-200 hover:shadow-lg'
                }`}
              >
                {plan.highlight && (
                  <div className="bg-blue-600 text-white text-xs font-bold text-center py-2 tracking-widest uppercase">
                    {plan.badge}
                  </div>
                )}
                <div className="p-6 bg-white">
                  <p className="text-slate-500 font-medium text-sm mb-2">{plan.name}</p>
                  <p className="text-4xl font-extrabold tracking-tight text-slate-900 mb-1">
                    {plan.price}<span className="text-lg font-normal text-slate-400">{plan.period}</span>
                  </p>
                  <div className="mt-6 space-y-3 mb-8">
                    {plan.features.map(f => (
                      <div key={f} className="flex items-center gap-2 text-sm text-slate-700">
                        <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {f}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={onLogin}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                      plan.highlight
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-6">
            Todos os planos incluem 14 dias de trial PRO. Pagamento seguro via Stripe.
          </p>
        </div>
      </section>

      {/* ─── TESTIMONIALS ────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Depoimentos</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Quem usa, aprova
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm"
              >
                <div className="flex mb-3">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed mb-5 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Perguntas frequentes
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-slate-900 text-sm pr-4">{faq.q}</span>
                  <svg
                    className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-4 text-sm text-slate-500 leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ───────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 bg-gradient-to-br from-blue-600 to-violet-700 text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
            Pronto para tomar o controle?
          </h2>
          <p className="text-blue-100 text-lg mb-10">
            Junte-se a milhares de pessoas que já transformaram sua relação com o dinheiro.
          </p>
          <button
            onClick={onLogin}
            className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-10 py-4 rounded-2xl text-base transition-all shadow-2xl shadow-black/20 hover:-translate-y-0.5 active:scale-95 inline-flex items-center gap-2"
          >
            Começar grátis agora
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
          <p className="text-blue-200 text-sm mt-4">14 dias PRO grátis • Sem cartão de crédito</p>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────── */}
      <footer className="bg-slate-950 text-slate-400 py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              </div>
              <span className="font-bold text-white">Finanças Pro</span>
            </div>
            <nav className="flex flex-wrap justify-center gap-6 text-sm">
              <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
              <a href="#planos" className="hover:text-white transition-colors">Planos</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              <button onClick={onLogin} className="hover:text-white transition-colors">Entrar</button>
            </nav>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p>© {new Date().getFullYear()} Finanças Pro. Todos os direitos reservados.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white transition-colors">Termos de uso</a>
              <a href="#" className="hover:text-white transition-colors">Privacidade</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
