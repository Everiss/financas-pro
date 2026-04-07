# Backend — Finanças Pro

> **Versão:** 2.0
> **Atualizado em:** 2026-04-06

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Módulos NestJS](#2-módulos-nestjs)
3. [Autenticação e Guards](#3-autenticação-e-guards)
4. [Padrão de Serviço](#4-padrão-de-serviço)
5. [Endpoints — Referência Rápida](#5-endpoints--referência-rápida)
6. [Transações Atômicas](#6-transações-atômicas)
7. [Regras de Saldo](#7-regras-de-saldo)
8. [Notificações In-App](#8-notificações-in-app)
9. [Cache de IA](#9-cache-de-ia)

---

## 1. Visão Geral

O backend é um **monolito NestJS** servindo uma REST API JSON. Não há GraphQL, WebSocket ou filas de mensagem no momento.

```
Porta: 5000
Prefixo global: /api  (Swagger em /api/docs)
```

Configurado em `main.ts`:
- `ValidationPipe` global (whitelist + transform)
- CORS com origem do frontend (`FRONTEND_URL`)
- Swagger com bearer token

---

## 2. Módulos NestJS

| Módulo | Rota base | Responsabilidade |
|--------|-----------|-----------------|
| `AuthModule` | — | Valida Firebase tokens, cria usuário na 1ª entrada |
| `UsersModule` | `/users` | CRUD de perfil do usuário |
| `AccountsModule` | `/accounts` | Contas bancárias (CRUD + extrato) |
| `BanksModule` | `/banks` | Instituições bancárias |
| `TransactionsModule` | `/transactions` | Transações CRUD + parcelamento + confirmação |
| `TransfersModule` | `/transfers` | Transferências entre contas (atomicamente) |
| `CategoriesModule` | `/categories` | Categorias + estatísticas de orçamento |
| `RemindersModule` | `/reminders` | Lembretes + `POST /:id/confirm` |
| `GoalsModule` | `/goals` | Metas + `POST /:id/deposit` |
| `NotificationsModule` | `/notifications` | Alertas dinâmicos (recalculados por request) |
| `SettingsModule` | `/settings` | Preferências do usuário |
| `AiModule` | `/ai` | Claude AI (insights, health, chat, forecast, investment) |
| `FaturaImportModule` | `/fatura-import` | Importação de fatura PDF/Excel/CSV |
| `CouponScannerModule` | `/coupon-scanner` | Leitura de cupom fiscal via Vision |
| `OpenFinanceModule` | `/openfinance` | Pluggy connect token + items |
| `SubscriptionModule` | `/subscription` | Stripe checkout + portal + webhook |
| `AuditModule` | `/audit` | Log de auditoria |
| `PrismaModule` | — | Serviço global de banco (injetado em todos) |

**Regra:** todo módulo que usa `@UseGuards(FirebaseAuthGuard)` deve importar `AuthModule`.

---

## 3. Autenticação e Guards

### FirebaseAuthGuard
Valida o `Bearer <token>` no header via Firebase Admin SDK. Injeta `request.user` (objeto `User` do banco).

### PlanGuard
Verificado via `@RequireFeature('ai')` nos controllers PRO. Checa `user.plan` e `user.trialEndsAt`.

Planos: `FREE | PRO | FAMILY`
Trial: 14 dias de PRO para novos usuários.

### AuditInterceptor
Interceptor global que loga toda mutação (POST/PATCH/DELETE) na tabela `audit_logs`.

---

## 4. Padrão de Serviço

Todos os services seguem o padrão:
1. `findOne(id, userId)` — valida ownership, lança `NotFoundException` ou `ForbiddenException`
2. Operações de escrita usam `prisma.$transaction()` quando afetam múltiplas tabelas
3. Após qualquer mutação financeira: `aiCache.invalidate(userId)`

---

## 5. Endpoints — Referência Rápida

### Contas
```
GET    /accounts                  Lista contas do usuário
POST   /accounts                  Cria conta
PATCH  /accounts/:id              Atualiza conta
DELETE /accounts/:id              Remove conta (CASCADE transações)
GET    /accounts/:id/statement    Extrato da conta (query: startDate, endDate)
```

### Transações
```
GET    /transactions              Lista (query: type, categoryId, accountId, startDate, endDate)
POST   /transactions              Cria transação única
POST   /transactions/installments Cria parcelamento (N parcelas)
POST   /transactions/:id/confirm  Confirma transação pendente
PATCH  /transactions/:id          Atualiza transação
DELETE /transactions/:id          Remove (cascata pending siblings em parcelamento)
```

### Transferências
```
GET    /transfers                 Lista transferências
POST   /transfers                 Cria transferência (cria 2 transações + valida saldo)
DELETE /transfers/:id             Reverte transferência (desfaz 2 transações)
```

### Categorias
```
GET    /categories                Lista categorias (padrão + do usuário)
POST   /categories                Cria categoria personalizada
PATCH  /categories/:id            Atualiza (não permite padrões)
DELETE /categories/:id            Remove (transações → categoryId=null via SetNull)
GET    /categories/stats          Gastos por categoria (query: month=YYYY-MM)
```

### Lembretes
```
GET    /reminders                 Lista lembretes
POST   /reminders                 Cria lembrete
PATCH  /reminders/:id             Atualiza lembrete
POST   /reminders/:id/confirm     Marca como concluído (seta completedAt)
DELETE /reminders/:id             Remove lembrete
```

### Metas
```
GET    /goals                     Lista metas
POST   /goals                     Cria meta
PATCH  /goals/:id                 Atualiza meta
POST   /goals/:id/deposit         Deposita valor (seta completedAt se atingiu alvo)
DELETE /goals/:id                 Remove meta
```

### Notificações
```
GET    /notifications             Lista alertas dinâmicos do usuário
```

### IA (PRO)
```
POST   /ai/insights               3 insights personalizados
POST   /ai/goals-strategy         Estratégia para metas
POST   /ai/health-score           Score de saúde financeira (IA)
POST   /ai/spending-forecast      Previsão de gastos
POST   /ai/investment-analysis    Análise de portfólio
POST   /ai/chat                   Chat financeiro livre
POST   /ai/import-statement       Importar extrato bancário via IA
```

### Cupom Fiscal (PRO)
```
POST   /coupon-scanner/scan       Analisa imagem de cupom (multipart/form-data)
POST   /coupon-scanner/confirm    Confirma: cria Transaction + Receipt + ReceiptItems
GET    /coupon-scanner            Lista cupons do usuário
```

### Open Finance (PRO)
```
GET    /openfinance/connectors    Lista conectores disponíveis
POST   /openfinance/connect-token Gera token para Pluggy Widget
GET    /openfinance/items         Lista conexões do usuário
DELETE /openfinance/items/:id     Remove conexão
```

### Configurações
```
GET    /settings                  Retorna settings (cria com defaults se não existir)
PATCH  /settings                  Atualiza settings
```

### Assinatura
```
GET    /subscription/status       Retorna plano atual e status
POST   /subscription/checkout     Cria Stripe Checkout Session
POST   /subscription/portal       Cria link do Customer Portal
POST   /subscription/webhook      Recebe eventos Stripe
```

---

## 6. Transações Atômicas

Toda operação que afeta múltiplas tabelas usa `prisma.$transaction()`:

| Operação | Tabelas afetadas |
|----------|-----------------|
| Criar transferência | Transfer + 2× Transaction + 2× BankAccount |
| Confirmar parcela | Transaction + BankAccount |
| Deletar transferência | Transfer + 2× Transaction + 2× BankAccount |
| Deletar transação parcelada | Transaction + irmãs pendentes + BankAccount |
| Confirmar cupom fiscal | Transaction + Receipt + ReceiptItems + BankAccount |
| Depositar em meta | Goal + Transaction (se conta) + BankAccount (se conta) |

---

## 7. Regras de Saldo

```typescript
// financas-back/src/transactions/transactions.service.ts
function balanceDelta(type, amount, accountType, revert = false): number {
  const isCredit = accountType === 'credit';
  const delta = isCredit
    ? type === 'expense' ? amount : -amount    // crédito: despesa aumenta dívida
    : type === 'income'  ? amount : -amount;   // demais: receita aumenta saldo
  return revert ? -delta : delta;
}
```

Transações `isPending: true` **nunca** afetam o saldo.

**Parcelamento:**
- Parcela 0: `isPending: false` → afeta saldo imediatamente
- Parcelas 1..N: `isPending: true` → afetam saldo quando confirmadas
- Rounding: `Math.floor(amount/n * 100)/100` para base; última parcela absorve centavos restantes

**Validações antes de debitar:**
- Transferências: valida saldo disponível ou limite de crédito disponível
- Depósito em meta: valida saldo disponível (não aplica a contas credit)

---

## 8. Notificações In-App

`GET /notifications` — recalculadas a cada chamada, sem persistência.

Carrega `user_settings` no início via `$queryRawUnsafe` (fallback para defaults se não existir).

| Tipo | Fonte de configuração |
|------|-----------------------|
| `reminder_overdue` | Lembretes com `completedAt = null` e `dueDate < hoje` |
| `reminder_due` | Lembretes com `completedAt = null` e `dueDate` dentro de `reminderAdvanceDays` |
| `budget_alert` | Categoria atingiu `budgetAlertThreshold`% do orçamento |
| `budget_exceeded` | Categoria ultrapassou 100% do orçamento |
| `goal_reached` | Meta com `completedAt = null` e `currentAmount >= targetAmount` |
| `debt_due` | Conta loan/financing com `dueDay` = hoje ou amanhã |
| `low_balance` | Conta checking/savings com `balance < lowBalanceAlert` |
| `large_transaction` | Despesa confirmada nos últimos 7 dias > `largeTransactionAlert` |
| `credit_usage_alert` | Cartão com `balance/creditLimit >= creditUsageAlert`% |
| `rebalance_needed` | Desvio da alocação alvo >= `rebalanceThreshold`% |

Ordenação: `danger → warning → info → success`

---

## 9. Cache de IA

`AiInsightCache` — uma linha por usuário com flag `isDirty`.

- `isDirty = true` → próxima chamada recalcula com Claude
- Invalidado via `aiCache.invalidate(userId)` após qualquer mutação

Campos armazenados:
- `insightsJson` — array de insights
- `strategyJson` — estratégia de metas
- `extraJson` — análises adicionais

> **Importante:** o módulo `AiModule` deve ser importado em qualquer módulo que chame `aiCache.invalidate()`. Atualmente injetado via `TransactionsModule`, `GoalsModule`, `TransfersModule`.
