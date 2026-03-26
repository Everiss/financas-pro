# Especificação Funcional — Finanças Pro

> **Versão:** 1.0
> **Data:** 2026-03-26
> **Status:** Ativo

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Perfis de Usuário](#2-perfis-de-usuário)
3. [Planos e Permissões](#3-planos-e-permissões)
4. [Módulos Funcionais](#4-módulos-funcionais)
   - 4.1 [Autenticação](#41-autenticação)
   - 4.2 [Contas Bancárias](#42-contas-bancárias)
   - 4.3 [Transações](#43-transações)
   - 4.4 [Faturas do Cartão](#44-faturas-do-cartão)
   - 4.5 [Transferências](#45-transferências)
   - 4.6 [Categorias e Orçamentos](#46-categorias-e-orçamentos)
   - 4.7 [Lembretes](#47-lembretes)
   - 4.8 [Metas Financeiras](#48-metas-financeiras)
   - 4.9 [Investimentos](#49-investimentos)
   - 4.10 [Análises com IA](#410-análises-com-ia)
   - 4.11 [Saúde Financeira](#411-saúde-financeira)
   - 4.12 [Cupons Fiscais](#412-cupons-fiscais)
   - 4.13 [Open Finance](#413-open-finance)
   - 4.14 [Configurações](#414-configurações)
   - 4.15 [Notificações](#415-notificações)
   - 4.16 [Comunicação Ativa](#416-comunicação-ativa)
   - 4.17 [Assinatura e Pagamento](#417-assinatura-e-pagamento)
   - 4.18 [Auditoria](#418-auditoria)
5. [Regras de Negócio Críticas](#5-regras-de-negócio-críticas)
6. [Fluxos Principais](#6-fluxos-principais)

---

## 1. Visão Geral

O **Finanças Pro** é uma aplicação web de gestão financeira pessoal que combina:

- Controle de contas, cartões, transações e transferências
- Análises e insights gerados por IA (Claude AI)
- Integração com bancos via Open Finance Brasil (Pluggy)
- Leitura automática de cupons fiscais por visão computacional
- Motor de saúde financeira baseado em frameworks acadêmicos
- Modelo de assinatura com planos FREE, PRO e FAMILY

---

## 2. Perfis de Usuário

| Perfil | Descrição |
|--------|-----------|
| **Usuário FREE** | Acesso às funcionalidades básicas: contas, transações, categorias, lembretes, metas, calendário |
| **Usuário PRO** | Acesso completo: IA, Open Finance, cupom fiscal, relatórios; 14 dias de trial automático |
| **Usuário FAMILY** | PRO + suporte a múltiplos membros (em roadmap) |

**Trial:** todo novo usuário recebe automaticamente 14 dias de acesso PRO.

---

## 3. Planos e Permissões

| Funcionalidade | FREE | PRO | FAMILY |
|----------------|------|-----|--------|
| Contas e Transações | ✅ | ✅ | ✅ |
| Categorias com orçamento | ✅ | ✅ | ✅ |
| Lembretes e metas | ✅ | ✅ | ✅ |
| Calendário financeiro | ✅ | ✅ | ✅ |
| Faturas do cartão | ✅ | ✅ | ✅ |
| Análises com IA (Claude) | ❌ | ✅ | ✅ |
| Open Finance (Pluggy) | ❌ | ✅ | ✅ |
| Cupom fiscal (Vision) | ❌ | ✅ | ✅ |
| Relatórios semanais/mensais | ❌ | ✅ | ✅ |
| Múltiplos usuários | ❌ | ❌ | ✅ |

---

## 4. Módulos Funcionais

### 4.1 Autenticação

**Mecanismo:** Google OAuth via Firebase Authentication.

**Fluxo de login:**
1. Usuário clica em "Entrar com Google"
2. Firebase realiza OAuth e retorna ID Token
3. Frontend envia token no header `Authorization: Bearer <token>` em todas as requisições
4. Backend valida com Firebase Admin SDK
5. Se usuário novo: cria perfil com padrões (BRL, plano FREE, trial PRO por 14 dias)
6. Retorna objeto de usuário autenticado

**Não existe senha própria** — autenticação exclusivamente via Google OAuth.

---

### 4.2 Contas Bancárias

**Tipos de conta suportados:**

| Tipo | Descrição |
|------|-----------|
| `checking` | Conta corrente |
| `savings` | Conta poupança |
| `investment` | Conta de investimentos |
| `credit` | Cartão de crédito |
| `loan` | Empréstimo |
| `financing` | Financiamento |

**Atributos específicos de cartão de crédito:**
- `creditLimit` — limite total
- `closingDay` — dia de fechamento da fatura
- `dueDay` — dia de vencimento

**Atributos específicos de investimento:**
- `investmentType`: cdb / stock / fund / fii / tesouro / previdencia / crypto
- `subtype`: subtipo definido pelo usuário (ex: "Fundo de Ações")

**Suporte multi-moeda:** cada conta pode ter moeda própria (BRL, USD, EUR, etc.)

**Logos de banco:** integração com Simple Icons CDN para 40+ instituições; fallback para iniciais coloridas.

**Regras:**
- Saldo de cartão de crédito representa dívida (positivo = deve)
- Saldo de empréstimo/financiamento representa saldo devedor
- Deletar conta remove todas as transações vinculadas (CASCADE)

---

### 4.3 Transações

**Tipos:** `income` (receita) | `expense` (despesa)

**Estados:**
- `isPending: false` — confirmada, afeta o saldo imediatamente
- `isPending: true` — pendente, não afeta saldo até confirmação manual

**Campos principais:**
- `amount` — valor (Decimal 15,2)
- `type` — income ou expense
- `date` — data da transação
- `description` — texto livre
- `paymentMethod` — debit | credit | null
- `categoryId` — categoria opcional
- `accountId` — conta obrigatória
- `isTransfer` — flag para ocultar em telas de transações normais
- `installmentRef` — UUID que agrupa parcelas de um parcelamento

**Parcelamento:**
- Exclusivo para despesas em cartão de crédito
- A **1ª parcela** é criada com `isPending: false` e atualiza o saldo imediatamente
- As **demais parcelas** ficam `isPending: true` e são confirmadas automaticamente nos meses seguintes
- Todas as parcelas compartilham o mesmo `installmentRef`

**Regra de saldo por tipo de conta:**

| Tipo de conta | Despesa | Receita |
|---------------|---------|---------|
| checking/savings/investment | `balance -= amount` | `balance += amount` |
| credit | `balance += amount` (aumenta dívida) | `balance -= amount` (reduz dívida) |

**Importação de fatura:**
- Suporta PDF, Excel (.xlsx/.xls) e CSV
- IA extrai transações e tenta reconciliar com transações já existentes
- Usuário confirma o que vincular, criar ou ignorar

---

### 4.4 Faturas do Cartão

**Período de fatura:** calculado a partir do `closingDay` e `dueDay` da conta:
- Início: `closingDay + 1` do mês anterior
- Fechamento: `closingDay` do mês atual (23:59:59)
- Vencimento: `dueDay` do mês corrente ou seguinte (conforme configuração)

**Cards informativos:**
- **Total da Fatura** — soma das despesas confirmadas no período
- **Limite Disponível** — `creditLimit - effectiveBalance`
- **Uso do Limite** — percentual em uso
- **Pagar Fatura** — valor efetivo a pagar com botão de pagamento

**effectiveBalance:** `max(0, card.balance) + pendingTransactionsInPeriod`
- Garante visibilidade de parcelas pendentes ainda não refletidas no saldo
- Zera corretamente após pagamento da fatura

**Navegação:** setas para mês anterior / próximo com marcação do mês atual.

**Status da fatura:** "Fechada" (closeDate no passado) | "Atual" | "Futura".

**Breakdown por categoria:** gráfico de barras horizontal com % de cada categoria.

---

### 4.5 Transferências

**Fluxo:** cria duas transações vinculadas:
1. Despesa (`isTransfer: true`) na conta de origem
2. Receita (`isTransfer: true`) na conta de destino

**Pagamento de fatura (`isBillPayment: true`):**
- Detectado automaticamente quando destino é conta do tipo `credit`
- Descrição padrão: "Pagamento de fatura — [nome do cartão]"
- Reduz saldo do cartão (dívida diminui)

**Reversão:** deletar transferência reverte ambos os saldos e deleta ambas as transações.

---

### 4.6 Categorias e Orçamentos

**Atributos:** nome, ícone (Lucide), cor (hex), orçamento mensal opcional.

**Categorias padrão:** criadas automaticamente na primeira vez (Alimentação, Moradia, Transporte, etc.) — marcadas com `isDefault: true`.

**Estatísticas:** endpoint `/categories/stats?month=YYYY-MM` retorna gasto real do mês por categoria para comparação com orçamento.

**Uso no orçamento:** alerta disparado quando o gasto atinge o limiar configurado nas Settings (padrão: 80%).

---

### 4.7 Lembretes

**Tipos:** income | expense

**Frequências:** once | daily | weekly | monthly | yearly

**Antecedência:** configurável nas Settings (`reminderAdvanceDays`, padrão: 3 dias)

**Fluxo de pagamento:** ao marcar como pago, cria uma transação na conta vinculada com a data e valor do lembrete.

---

### 4.8 Metas Financeiras

**Categorias de meta:** Viagem | Casa | Carro | Educação | Reserva de Emergência | Aposentadoria | Outros

**Depósito:** debita valor de uma conta (opcional) e adiciona ao `currentAmount` da meta.

**Conclusão:** quando `currentAmount >= targetAmount`, notificação "Meta atingida" é gerada.

**Estratégia IA:** endpoint de análise de viabilidade, prazo e valor mensal necessário (PRO).

---

### 4.9 Investimentos

**Visualização:** agrupamento por tipo de investimento (CDB, ações, fundos, FII, Tesouro, previdência, crypto) com gráfico pizza.

**Saldo total:** soma de todas as contas do tipo `investment`.

**Alocação alvo:** configurável nas Settings (`fixedIncomeTarget`, `variableTarget`, `internationalTarget`).

**Alerta de rebalanceamento:** quando desvio da alocação alvo supera `rebalanceThreshold` (padrão: 5%).

---

### 4.10 Análises com IA

Todas as análises usam **Claude Sonnet 4** com contexto financeiro do usuário (últimos 30 dias de transações, saldos, metas).

| Análise | Endpoint | Retorno |
|---------|----------|---------|
| Insights financeiros | `POST /ai/insights` | 3 dicas personalizadas (tipo: tip/warning/success) |
| Estratégia de metas | `POST /ai/goals-strategy` | Viabilidade, prazo, valor mensal necessário |
| Score de saúde | `POST /ai/health-score` | Score 0-100, 6 componentes, recomendações |
| Previsão de gastos | `POST /ai/spending-forecast` | Projeção por categoria com indicadores de tendência |
| Análise de investimentos | `POST /ai/investment-analysis` | Score de diversificação, riscos, rebalanceamento |
| Chat financeiro | `POST /ai/chat` | Resposta contextual a perguntas livres |

**Cache:** resultados armazenados em `AiInsightCache` com flag `isDirty`. Invalidado automaticamente em qualquer criação/atualização/deleção de transação, conta, meta ou transferência.

---

### 4.11 Saúde Financeira

**Score:** 0 a 100, composto por 6 indicadores com pesos distintos.

| Indicador | Peso | Benchmark saudável |
|-----------|------|---------------------|
| Reserva de emergência | 25% | ≥ 6 meses de despesas |
| Taxa de poupança | 20% | ≥ 20% da renda |
| Comprometimento de dívida (DTI) | 20% | ≤ 30% |
| Uso do crédito | 15% | ≤ 30% do limite |
| Índice de liquidez | 10% | ativos líquidos / despesas mensais |
| Comprometimento de renda | 10% | despesas fixas / renda |

**Benchmarks configuráveis** nas Settings (`emergencyFundMonths`, `savingsRateTarget`, `debtIncomeLimit`).

**Status:**
- **Saudável** (≥ 75): Verde
- **Equilíbrio** (≥ 50): Amarelo
- **Atenção** (≥ 25): Laranja
- **Vulnerável** (< 25): Vermelho

---

### 4.12 Cupons Fiscais

**Wizard de 4 etapas:**

1. **Upload** — drag & drop ou seleção de arquivo (JPG, PNG, WEBP, até 10MB)
2. **Processamento IA** — Claude Vision analisa a imagem e extrai:
   - Nome e CNPJ do estabelecimento
   - Data de emissão, valor total, chave de acesso (44 dígitos)
   - Todos os itens: descrição, quantidade, unidade (UN/KG/L), preço unitário e total
   - Sugestão de categoria por item (com base nas categorias do usuário)
3. **Revisão** — usuário edita categorias de cada item antes de confirmar
4. **Confirmação** — operação atômica cria:
   - `Transaction` (despesa na conta selecionada)
   - `Receipt` (cabeçalho do cupom)
   - `ReceiptItem[]` (um por item extraído)

**Acesso:** botão "Cupom Fiscal" na tela de Transações (plano PRO).

---

### 4.13 Open Finance

**Integração:** Pluggy SDK com widget embarcado.

**Fluxo de conexão:**
1. Backend gera `connectToken` via Pluggy API
2. Frontend abre Pluggy Connect Widget com o token
3. Usuário autentica com o banco desejado
4. Item (conexão) é criado e fica disponível no dashboard

**Funcionalidades:**
- Listar conectores disponíveis (busca por nome do banco)
- Criar e visualizar itens (conexões bancárias)
- Importar contas e transações do banco conectado
- Modo sandbox para testes sem credenciais reais

**Plano:** exclusivo PRO.

---

### 4.14 Configurações

**Seções da tela de configurações:**

#### Perfil
- Nome de exibição, e-mail (somente leitura), foto, moeda padrão

#### Comunicação
- `emailNotifications` — alertas por e-mail
- `pushNotifications` — notificações push no navegador
- `weeklyReport` — relatório semanal toda segunda-feira
- `monthlyReport` — relatório mensal no primeiro dia útil

#### Lembretes
- `reminderAdvanceDays` (1–14 dias, padrão: 3)
- `reminderFrequency` — Diária | Semanal

#### Alertas & Limites
- `budgetAlertThreshold` (%, padrão: 80) — alerta quando categoria atinge X% do orçamento
- `creditUsageAlert` (%, padrão: 70) — alerta quando cartão atinge X% do limite
- `lowBalanceAlert` (R$, padrão: 100) — alerta quando conta cai abaixo deste valor
- `largeTransactionAlert` (R$, padrão: 500) — alerta quando transação supera este valor

#### Saúde Financeira
- `emergencyFundMonths` (meses, padrão: 6)
- `savingsRateTarget` (%, padrão: 20)
- `debtIncomeLimit` (%, padrão: 30)

#### Investimentos
- `riskProfile` — Conservador | Moderado | Arrojado
- `rebalanceAlert` — ativar alerta de rebalanceamento
- `rebalanceThreshold` (%, padrão: 5) — desvio mínimo para disparar alerta
- `fixedIncomeTarget` / `variableTarget` / `internationalTarget` (%, soma = 100%)

#### Notícias & Informações
- `showMarketNews`, `showEconomicNews`, `showPersonalTips`

---

### 4.15 Notificações

**Notificações in-app** geradas dinamicamente (sem persistência, recalculadas a cada request):

| Tipo | Severidade | Condição |
|------|-----------|----------|
| `reminder_overdue` | danger | Lembrete com vencimento passado |
| `reminder_due` | warning/info | Lembrete a vencer em `reminderAdvanceDays` dias |
| `budget_exceeded` | warning | Categoria ultrapassou orçamento mensal |
| `goal_reached` | success | Meta atingiu valor alvo |
| `debt_due` | warning/info | Empréstimo/financiamento vence hoje ou amanhã |

**Planejado (ver 4.16):**
- `low_balance` — saldo abaixo do mínimo
- `large_transaction` — transação acima do limiar
- `credit_usage` — uso de cartão acima do limiar
- `rebalance_needed` — portfólio desviado da alocação alvo

---

### 4.16 Comunicação Ativa

> **Status:** planejado — ver análise em `.docs/MEMORY.md`

**Relatório semanal** (toda segunda-feira, se `weeklyReport = true`):
- Resumo de receitas e despesas da semana
- Top 3 categorias com maior gasto
- Comparativo com semana anterior

**Relatório mensal** (1º dia útil, se `monthlyReport = true`):
- Resumo completo do mês encerrado
- Score de saúde financeira
- Metas e progresso
- Previsão para o próximo mês

**Alertas por e-mail** (se `emailNotifications = true`):
- Enviados quando qualquer alerta da seção 4.15 é disparado
- E-mail imediato após a transação ou verificação diária

**Push notifications** (se `pushNotifications = true`):
- Web Push via Service Worker
- Mesmos gatilhos dos alertas in-app

---

### 4.17 Assinatura e Pagamento

**Plataforma:** Stripe

**Fluxo de upgrade:**
1. Usuário seleciona plano na tela Planos
2. Frontend chama `POST /subscription/checkout` com o `priceId`
3. Backend cria Stripe Checkout Session e retorna URL
4. Usuário completa pagamento no Stripe
5. Webhook Stripe atualiza `user.plan` e cria `Subscription` no banco

**Portal do cliente:** link para gerenciar assinatura, alterar plano, cancelar — via Stripe Customer Portal.

**Webhooks tratados:**
- `invoice.payment_succeeded` → status = active
- `customer.subscription.deleted` → status = canceled, plan = FREE
- `customer.subscription.updated` → atualiza período e status

---

### 4.18 Auditoria

**Interceptor automático:** toda operação de criação, atualização ou deleção é registrada em `AuditLog`.

**Entidades auditadas:** Transaction, Account, Bank, Goal, Reminder, Category, Transfer

**Campos do log:** userId, action (CREATE/UPDATE/DELETE), entity, entityId, payload (JSON com as alterações), IP, timestamp.

**Visualização:** tela Histórico com filtros por entidade, ação e paginação.

---

## 5. Regras de Negócio Críticas

### RN-01: Saldo de conta
- Toda transação confirmada (`isPending: false`) atualiza o saldo da conta no momento da criação
- Transações pendentes não afetam saldo
- A confirmação de uma transação pendente incrementa o saldo retroativamente

### RN-02: Parcelamento
- Apenas despesas em contas do tipo `credit` podem ser parceladas
- A 1ª parcela é confirmada imediatamente; demais ficam pendentes
- Todas as parcelas compartilham o mesmo `installmentRef`

### RN-03: Pagamento de fatura
- Pagamento via transferência para conta `credit`
- Reduz o saldo do cartão (`balance -= amount`)
- `effectiveBalance` na UI = `balance + parcelas_pendentes_no_período`

### RN-04: Transferência
- Sempre cria duas transações vinculadas
- Deletar a transferência reverte ambos os saldos e deleta ambas as transações

### RN-05: Cache de IA
- Qualquer mutação (transação, conta, meta, transferência) invalida o cache com `isDirty = true`
- Insights só são recalculados na próxima chamada explícita do usuário

### RN-06: Trial
- Duração: 14 dias a partir do primeiro login
- Ao expirar: plano volta para FREE automaticamente via `PlanGuard`

### RN-07: Isolamento de dados
- Todos os dados são associados a `userId` (Firebase UID)
- Nenhuma query retorna dados de outros usuários

---

## 6. Fluxos Principais

### Fluxo: Nova Transação com Parcelamento

```
Usuário → Tela Transações → "+ Nova Transação"
  → Preenche: conta (credit), tipo expense, valor, nº de parcelas
  → POST /transactions/installments
    → Backend cria N transações com installmentRef
    → Parcela 1: isPending=false → atualiza balance do cartão
    → Parcelas 2..N: isPending=true
  → Frontend exibe confirmação
  → FaturaView mostra effectiveBalance atualizado
```

### Fluxo: Pagamento de Fatura

```
Usuário → FaturaView → "Pagar"
  → Abre TransferenciaModal (prefill: toId=cartão, amount=effectiveBalance)
  → Preenche conta de origem, confirma
  → POST /transfers
    → Cria transação expense na conta origem
    → Cria transação income no cartão (isTransfer=true)
    → Atualiza saldos: conta origem -= amount, cartão.balance -= amount
  → FaturaView recarrega: effectiveBalance = max(0, balance=0) + pendingInPeriod = 0
```

### Fluxo: Leitura de Cupom Fiscal

```
Usuário → Transações → "Cupom Fiscal"
  → ScanCouponModal Step 1: upload da imagem
  → POST /coupon-scanner/scan (multipart)
    → Claude Vision extrai itens, categorias sugeridas, totais
  → Step 3: usuário revisa categorias por item
  → Seleciona conta, descrição, data
  → POST /coupon-scanner/confirm
    → Prisma $transaction:
      1. create Transaction (expense)
      2. update balance
      3. create Receipt
      4. createMany ReceiptItems
  → Step 4: sucesso com resumo
```

### Fluxo: Score de Saúde Financeira

```
Usuário → Saúde Financeira
  → GET /ai/health-score (ou cache válido)
  → Backend: coleta 30 dias de transações, saldos, metas
  → Calcula 6 indicadores com benchmarks das Settings do usuário
  → Claude gera análise narrativa + recomendações
  → Frontend exibe gauge circular 0-100 + breakdown por indicador
```
