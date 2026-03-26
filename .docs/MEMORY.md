# MEMORY — Finanças Pro

> Registro vivo de decisões, contexto e estado do projeto.
> Atualizar sempre que uma decisão relevante for tomada ou um problema resolvido.
> **Última atualização:** 2026-03-26

---

## Sumário

1. [Contexto do Projeto](#1-contexto-do-projeto)
2. [Histórico de Decisões Técnicas](#2-histórico-de-decisões-técnicas)
3. [Bugs Resolvidos e Causa Raiz](#3-bugs-resolvidos-e-causa-raiz)
4. [Módulos em Desenvolvimento](#4-módulos-em-desenvolvimento)
5. [Débitos Técnicos](#5-débitos-técnicos)
6. [Roadmap de Funcionalidades](#6-roadmap-de-funcionalidades)
7. [Integrações e Credenciais](#7-integrações-e-credenciais)
8. [Padrões que Não São Óbvios](#8-padrões-que-não-são-óbvios)

---

## 1. Contexto do Projeto

- **Nome:** Finanças Pro
- **Tipo:** Aplicação web SaaS de gestão financeira pessoal
- **Stack:** React 19 + NestJS 10 + MySQL 8 + Prisma 5
- **Ambiente local:** Windows 11 + WAMP (MySQL local)
- **Repositório:** GitHub (main branch)
- **Deploy alvo:** VPS Linux com Docker Compose + Nginx + Let's Encrypt
- **Status atual:** em desenvolvimento ativo, sistema funcional localmente

---

## 2. Histórico de Decisões Técnicas

### 2026-03-19 — Schema inicial
- Escolhido MySQL 8.0 (não PostgreSQL) por familiaridade do desenvolvedor com WAMP
- Prisma como ORM por geração de tipos TypeScript
- Firebase Auth (não JWT próprio) para evitar gerenciar senhas

### 2026-03-22 — Parcelamento de transações
**Problema:** todas as parcelas eram criadas com `isPending: true`, nenhuma afetava o saldo.

**Decisão:** A 1ª parcela (`i=0`) é criada com `isPending: false` e atualiza o saldo imediatamente. As demais ficam `isPending: true`. Todas compartilham o mesmo `installmentRef`.

**Por que assim:** reflete o comportamento real do cartão — a compra é registrada imediatamente na fatura atual, as parcelas futuras em faturas posteriores.

### 2026-03-22 — effectiveBalance na FaturaView
**Problema original:** `Math.max(card.balance, totalFatura)` foi introduzido para cobrir o caso onde `card.balance = 0` mas há parcelas pendentes no período.

**Problema gerado:** após pagar a fatura, `card.balance = 0` mas `totalFatura` (soma das transações do período) continuava igual → fatura mostrava valor cheio mesmo após pagamento.

**Decisão final:** `effectiveBalance = Math.max(0, card.balance) + pendingInPeriod`
- `pendingInPeriod` = soma de transações `isPending: true` do período atual
- Garante: parcelas pendentes aparecem no total; após pagamento o valor zera corretamente
- `isPending` mapeado em `toTransaction()` nos mappers do frontend

### 2026-03-22 — Logos de banco via CDN
**Decisão:** Simple Icons CDN (`https://cdn.simpleicons.org/{slug}/{colorHex}`) em vez de npm package.
- Zero dependência adicional
- 40+ bancos mapeados em `financas-front/src/lib/bankLogos.ts`
- Fallback para círculo colorido com iniciais quando slug não encontrado ou CDN falha
- `onError` no `<img>` ativa o fallback

### 2026-03-22 — Docker para VPS
**Contexto:** ambiente local é WAMP (MySQL separado). Para produção, optou-se por MySQL containerizado.

**Decisão de segurança:** rede `internal: true` no Docker Compose — MySQL e backend não expostos externamente. Apenas Nginx responde nas portas 80/443.

**Migrations em produção:** `CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]` executa as migrations automaticamente ao iniciar o container.

**Razão de remover migrations do .gitignore:** `prisma migrate deploy` (não `dev`) precisa das migrations versionadas no repositório para funcionar na VPS.

### 2026-03-23 — Cupom fiscal com Claude Vision
**Decisão:** Claude Vision (não Tesseract/Google Vision) para extrair itens do cupom.
- Retorna JSON estruturado com todos os itens, quantidades, unidades, preços
- Sugere categorias com base nas categorias cadastradas pelo usuário (passadas no prompt)
- Operação de confirmação é atômica: `$transaction` cria Transaction + Receipt + ReceiptItems juntos

**Formato do prompt:** lista de categorias passada como `id|name` separado por `\n` para o Claude sugerir o `categoryId` diretamente.

### 2026-03-26 — AuthModule no CouponScannerModule
**Problema:** `Nest can't resolve dependencies of the FirebaseAuthGuard (?) — AuthService at index [0]`

**Causa:** `CouponScannerModule` usava `FirebaseAuthGuard` mas não importava `AuthModule`.

**Regra derivada:** todo módulo que usa `@UseGuards(FirebaseAuthGuard)` deve importar `AuthModule` nos seus `imports: [...]`.

---

## 3. Bugs Resolvidos e Causa Raiz

### BUG-01: Fatura mostrando R$ 0,00 em cartão com parcelamento
- **Sintoma:** PicPay-Black com R$ 5,35 de parcela mostrava R$ 0,00 no Total da Fatura
- **Causa raiz:** `createInstallments` criava todas as parcelas com `isPending: true` → nenhuma atualizava `card.balance`
- **Fix backend:** 1ª parcela criada com `isPending: false`, atualiza balance via `balanceDelta()`
- **Fix frontend:** `effectiveBalance = Math.max(balance, totalFatura)` como fallback temporário (depois substituído)
- **Fix definitivo frontend:** `effectiveBalance = Math.max(0, balance) + pendingInPeriod` (ver decisão 2026-03-22)

### BUG-02: Fatura mantendo valor após pagamento
- **Sintoma:** após pagar R$ 1.547,67, os cards "Total da Fatura" e "Pagar Fatura" continuavam mostrando R$ 1.547,67
- **Causa raiz:** `effectiveBalance = Math.max(card.balance, totalFatura)` — após pagamento `card.balance = 0` mas `totalFatura` (soma das transações do período) permanecia igual
- **Fix:** substituído por `balance + pendingInPeriod`; `isPending` agora mapeado em `toTransaction()`
- **Arquivo:** `financas-front/src/views/FaturaView.tsx` + `financas-front/src/lib/mappers.ts`

### BUG-03: Prisma não reconhecia `receipt` e `receiptItem`
- **Sintoma:** `TS2339: Property 'receipt' does not exist on PrismaClient`
- **Causa:** novos modelos adicionados ao `schema.prisma` mas `prisma generate` não foi executado
- **Fix:** `cd financas-back && npx prisma generate`
- **Lição:** sempre rodar `prisma generate` após modificar o schema

### BUG-04: Nest não resolvia AuthService no CouponScannerModule
- **Sintoma:** `FirebaseAuthGuard (?). AuthService at index [0] is available in the CouponScannerModule context`
- **Causa:** módulo não importava `AuthModule`
- **Fix:** adicionado `AuthModule` em `imports` do `CouponScannerModule`

---

## 4. Módulos em Desenvolvimento

### Comunicação Ativa (Fase 1 — In-App) — PLANEJADO

**Objetivo:** fazer as configurações da tela Settings serem utilizadas de fato no serviço de notificações.

**Mudanças planejadas em `notifications.service.ts`:**
1. Carregar `UserSettings` no início do `getAll()`
2. Usar `settings.reminderAdvanceDays` em vez de 3 dias fixo
3. Trocar `>100%` de orçamento por `>= settings.budgetAlertThreshold / 100`
4. Adicionar tipo `low_balance`: contas com `balance < settings.lowBalanceAlert`
5. Adicionar tipo `large_transaction`: transações dos últimos 7 dias com `amount > settings.largeTransactionAlert`
6. Adicionar tipo `credit_usage`: cartões com `balance/creditLimit*100 >= settings.creditUsageAlert`
7. Adicionar tipo `rebalance_needed`: quando desvio da alocação supera `settings.rebalanceThreshold`

**Novos tipos para `NotificationType`:**
```typescript
| 'low_balance'
| 'large_transaction'
| 'credit_usage_alert'
| 'rebalance_needed'
```

### Comunicação Ativa (Fase 2 — Email + Cron) — PLANEJADO

**Dependências a instalar:**
```bash
npm install @nestjs/schedule nodemailer
npm install -D @types/nodemailer
```

**Variáveis de ambiente novas:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@dominio.com
SMTP_PASS=app_password
SMTP_FROM="Finanças Pro <noreply@dominio.com>"
```

**Novo módulo:** `email.module.ts` + `email.service.ts`

**Cron jobs:**
- `@Cron('0 8 * * 1')` — toda segunda às 8h → relatório semanal (se `weeklyReport = true`)
- `@Cron('0 8 1 * *')` — primeiro dia do mês às 8h → relatório mensal (se `monthlyReport = true`)
- `@Cron('0 7 * * *')` — diário às 7h → verificar todos os alertas e enviar email se `emailNotifications = true`

---

## 5. Débitos Técnicos

| ID | Descrição | Impacto | Prioridade |
|----|-----------|---------|-----------|
| TD-01 | `user_settings` usa `$queryRawUnsafe` em vez de model Prisma | Manutenção | Baixa |
| TD-02 | Paginação de transações é client-side (20 itens fixos) | Performance com histórico longo | Média |
| TD-03 | Sem rate limiting nos endpoints de IA | Custo de API | Alta |
| TD-04 | `pushNotifications` salvo nas settings mas sem implementação real | Funcionalidade prometida | Média |
| TD-05 | Alertas in-app não usam settings do usuário (thresholds hardcoded) | Funcionalidade incorreta | Alta |
| TD-06 | Sem testes automatizados | Regressões não detectadas | Alta |
| TD-07 | `internationalTarget` do portfólio não é calculado (só exibido) | Análise incompleta | Baixa |
| TD-08 | `reminderFrequency` salvo mas não gera recorrência automática | Funcionalidade incompleta | Média |
| TD-09 | Webhook Stripe sem validação de assinatura (verificação da origem) | Segurança | Alta |

---

## 6. Roadmap de Funcionalidades

### Próximo — Alta Prioridade
- [ ] **Comunicação Ativa Fase 1:** conectar settings às notificações in-app (TD-05)
- [ ] **Comunicação Ativa Fase 2:** email service com Nodemailer + cron jobs
- [ ] **Rate limiting:** throttle em endpoints de IA para controle de custos (TD-03)

### Médio Prazo
- [ ] **Push notifications:** Service Worker + Web Push API
- [ ] **Paginação server-side** em `/transactions` para históricos longos (TD-02)
- [ ] **Recorrência automática de lembretes** baseada em `reminderFrequency` (TD-08)
- [ ] **Validação de webhook Stripe** com `stripe.webhooks.constructEvent()` (TD-09)

### Longo Prazo
- [ ] **App mobile** React Native
- [ ] **WebSocket** para atualizações em tempo real
- [ ] **Exportação de dados** (PDF relatório mensal, Excel de transações)
- [ ] **FAMILY plan** — múltiplos usuários com contas compartilhadas
- [ ] **OCR de XML NF-e** — além da leitura por imagem, processar XML diretamente
- [ ] **Regras automáticas** — categorização automática por descrição/CNPJ

---

## 7. Integrações e Credenciais

> ⚠️ Não armazenar valores reais aqui. Usar apenas referências.

| Serviço | Variável de Ambiente | Onde Obter |
|---------|---------------------|------------|
| Firebase Auth | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Firebase Console → Service Accounts |
| Anthropic Claude | `ANTHROPIC_API_KEY` | console.anthropic.com |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_FAMILY` | dashboard.stripe.com |
| Pluggy Open Finance | `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` | dashboard.pluggy.ai |
| SMTP (futuro) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Provedor SMTP (Gmail App Password, SendGrid, etc.) |

**Modelo Claude usado:** `claude-sonnet-4-20250514` (configurável via `ANTHROPIC_MODEL`)

---

## 8. Padrões que Não São Óbvios

### `balanceDelta(type, amount, accountType)`
Função utilitária em `transactions.service.ts` que calcula o delta de saldo correto:
- Conta corrente/poupança/investimento: despesa → `-amount`, receita → `+amount`
- Cartão de crédito: despesa → `+amount` (aumenta dívida), receita → `-amount` (reduz dívida)

### `toAccount()` não tem banco (`bank`)
O mapper `toAccount()` em `mappers.ts` não mapeia `bank` porque `AccountResponse` retorna `bankId` mas não o objeto `Bank`. Para exibir logos e nome do banco, verificar se `acc.bank?.name` está disponível — o endpoint `/accounts` inclui `bank` via `include` no Prisma.

### Faturas filtram `isTransfer: true`
`FaturaView` carrega o extrato via `accountsApi.getStatement()` e filtra `.filter(t => !t.isTransfer)` — transações de pagamento de fatura não aparecem nos lançamentos da fatura.

### `user_settings` — linha criada lazy
A linha em `user_settings` é criada automaticamente pelo `SettingsService.getOrCreate()` na primeira leitura. Não existe na criação do usuário — é gerada quando o usuário acessa a tela de Configurações pela primeira vez.

### `closingDay` e período da fatura
- O período começa no dia `closingDay + 1` do mês anterior (00:00:00)
- Termina no dia `closingDay` do mês atual (23:59:59)
- Se `dueDay <= closingDay`, o vencimento é no mês seguinte

### Datas com timezone no frontend
O frontend usa `fakeTimestamp()` em `mappers.ts` que parseia apenas `YYYY-MM-DD` como meia-noite local, evitando deslocamento por UTC-3. Datas exibidas são sempre locais, não UTC.

### Invalidação de cache de IA
O `AiCacheService.invalidate(userId)` é chamado após toda mutação de dados (transação, transferência, conta, meta). O cache só é reconstruído quando o usuário clica em "Gerar" nas telas de análise.

### Prisma `$transaction` vs transação de banco
`$transaction(async tx => { ... })` garante rollback automático se qualquer operação dentro falhar. Usado em: `createInstallments`, `createTransfer`, `confirmCoupon`, `deleteTransfer`.
