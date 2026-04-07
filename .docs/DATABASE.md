# Banco de Dados — Finanças Pro

> **Versão:** 2.0
> **Atualizado em:** 2026-04-06
> **Banco:** MySQL 8.0 — gerenciado via Prisma ORM

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Modelos e Tabelas](#2-modelos-e-tabelas)
3. [Enums](#3-enums)
4. [Relações e Chaves Estrangeiras](#4-relações-e-chaves-estrangeiras)
5. [Migrations](#5-migrations)
6. [Convenções](#6-convenções)

---

## 1. Visão Geral

```
ORM:      Prisma 5.22
Provider: MySQL
Database: financas_pro
```

Schema em: `financas-back/prisma/schema.prisma`
Migrations em: `financas-back/prisma/migrations/`

**Comandos úteis:**
```bash
npx prisma generate          # Regenerar client TypeScript após alterar schema
npx prisma migrate deploy    # Aplicar migrations pendentes no banco
npx prisma migrate dev       # Criar nova migration (dev)
npx prisma studio            # GUI visual do banco
```

---

## 2. Modelos e Tabelas

### `users` → `User`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | VARCHAR(191) PK | UUID gerado pelo app |
| `firebase_uid` | VARCHAR(191) UNIQUE | UID do Firebase |
| `display_name` | VARCHAR(191) | Nome do usuário |
| `email` | VARCHAR(191) UNIQUE | Email |
| `photo_url` | TEXT | URL da foto de perfil |
| `currency` | VARCHAR(3) | Moeda padrão (BRL) |
| `plan` | ENUM | FREE \| PRO \| FAMILY |
| `stripe_customer_id` | VARCHAR(191) | ID Stripe |
| `trial_ends_at` | DATETIME | Fim do trial PRO |
| `created_at` | DATETIME | — |
| `updated_at` | DATETIME | — |

---

### `user_settings` → `UserSettings`
| Coluna | Tipo | Padrão |
|--------|------|--------|
| `id` | UUID PK | — |
| `user_id` | FK → users | — |
| `email_notifications` | BOOLEAN | true |
| `push_notifications` | BOOLEAN | true |
| `weekly_report` | BOOLEAN | true |
| `monthly_report` | BOOLEAN | true |
| `reminder_advance_days` | INT | 3 |
| `reminder_frequency` | VARCHAR(20) | "daily" |
| `budget_alert_threshold` | INT (%) | 80 |
| `low_balance_alert` | FLOAT (R$) | 100 |
| `large_transaction_alert` | FLOAT (R$) | 500 |
| `credit_usage_alert` | INT (%) | 70 |
| `emergency_fund_months` | FLOAT | 6 |
| `savings_rate_target` | INT (%) | 20 |
| `debt_income_limit` | INT (%) | 30 |
| `risk_profile` | VARCHAR(20) | "moderate" |
| `rebalance_alert` | BOOLEAN | true |
| `rebalance_threshold` | INT (%) | 5 |
| `fixed_income_target` | INT (%) | 40 |
| `variable_target` | INT (%) | 40 |
| `international_target` | INT (%) | 20 |
| `show_market_news` | BOOLEAN | true |
| `show_economic_news` | BOOLEAN | true |
| `show_personal_tips` | BOOLEAN | true |

> Criada automaticamente (lazy) na primeira leitura via `SettingsService.getOrCreate()`.

---

### `banks` → `Bank`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | — |
| `user_id` | FK → users CASCADE | — |
| `name` | VARCHAR | Nome da instituição |
| `color` | VARCHAR | Hex (#3b82f6) |
| `icon` | VARCHAR | Nome Lucide icon |

---

### `bank_accounts` → `BankAccount`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | — |
| `user_id` | FK → users CASCADE | — |
| `bank_id` | FK → banks SET NULL | Banco vinculado |
| `name` | VARCHAR | Nome da conta |
| `type` | ENUM AccountType | checking \| savings \| investment \| credit \| loan \| financing |
| `balance` | DECIMAL(15,2) | Saldo atual / dívida atual (cartão) |
| `credit_limit` | DECIMAL(15,2)? | Limite (só crédito) |
| `closing_day` | INT? | Dia fechamento (crédito) |
| `due_day` | INT? | Dia vencimento (crédito/loan/financing) |
| `investment_type` | ENUM InvestmentType? | cdb \| stock \| fund \| fii \| tesouro \| previdencia \| crypto \| other |
| `subtype` | VARCHAR(50)? | Subtipo livre |
| `currency` | VARCHAR(3) | Moeda (BRL) |
| `color` / `icon` | VARCHAR | Personalização visual |

---

### `categories` → `Category`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | — |
| `user_id` | FK → users CASCADE? | Null para categorias padrão |
| `name` | VARCHAR | — |
| `icon` | VARCHAR | Nome Lucide |
| `color` | VARCHAR | Hex |
| `budget` | DECIMAL(15,2)? | Orçamento mensal opcional |
| `is_default` | BOOLEAN | true = criada pelo sistema, imutável |

> Deletar categoria: FK em `transactions.category_id` e `reminders.category_id` usa `ON DELETE SET NULL`.

---

### `transactions` → `Transaction`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | — |
| `user_id` | FK → users CASCADE | — |
| `account_id` | FK → bank_accounts SET NULL | Conta vinculada |
| `category_id` | FK → categories SET NULL | Categoria (pode ser null) |
| `amount` | DECIMAL(15,2) | Valor |
| `type` | ENUM TransactionType | income \| expense |
| `date` | DATETIME | Data efetiva |
| `description` | TEXT? | Descrição livre |
| `payment_method` | ENUM PaymentMethod? | debit \| credit |
| `is_pending` | BOOLEAN | false = confirma; true = não afeta saldo |
| `installment_ref` | VARCHAR(64)? | UUID que agrupa parcelas |
| `is_transfer` | BOOLEAN | true = gerada por transferência |
| `transfer_id` | VARCHAR? | ID da transferência pai |

**Índices:** `(user_id, date)`, `(user_id, type)`, `(account_id)`, `(category_id)`

---

### `reminders` → `Reminder`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | — |
| `user_id` | FK → users CASCADE | — |
| `account_id` | FK → bank_accounts SET NULL | Conta preferencial |
| `category_id` | FK → categories SET NULL | Categoria |
| `title` | VARCHAR | — |
| `amount` | DECIMAL(15,2) | Valor do lembrete |
| `type` | ENUM TransactionType | income \| expense |
| `due_date` | DATETIME | Próximo vencimento |
| `frequency` | ENUM FrequencyType | once \| daily \| weekly \| monthly \| yearly |
| `notes` | TEXT? | Observações |
| `completed_at` | DATETIME? | Quando foi confirmado (null = pendente) |

---

### `goals` → `Goal`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | — |
| `user_id` | FK → users CASCADE | — |
| `name` | VARCHAR | Nome da meta |
| `target_amount` | DECIMAL(15,2) | Valor alvo |
| `current_amount` | DECIMAL(15,2) | Valor atual |
| `deadline` | DATETIME? | Prazo opcional |
| `category` | ENUM GoalCategory | viagem \| casa \| carro \| educacao \| emergencia \| aposentadoria \| outros |
| `color` / `icon` | VARCHAR? | Visual |
| `completed_at` | DATETIME? | Seta automaticamente quando `current_amount >= target_amount` |

---

### `transfers` → `Transfer`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | — |
| `user_id` | FK → users CASCADE | — |
| `from_account_id` | FK → bank_accounts CASCADE | Conta origem |
| `to_account_id` | FK → bank_accounts CASCADE | Conta destino |
| `from_tx_id` | FK → transactions CASCADE UNIQUE | Transação de saída |
| `to_tx_id` | FK → transactions CASCADE UNIQUE | Transação de entrada |
| `amount` | DECIMAL(15,2) | Valor |
| `date` | DATETIME | — |
| `description` | TEXT? | — |
| `is_bill_payment` | BOOLEAN | true quando destino é `credit` |

---

### `receipts` → `Receipt`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | — |
| `user_id` | FK → users CASCADE | — |
| `transaction_id` | FK → transactions SET NULL UNIQUE | Transação vinculada |
| `issuer_name` | VARCHAR(200)? | Nome do estabelecimento |
| `issuer_cnpj` | VARCHAR(20)? | CNPJ |
| `total_amount` | DECIMAL(15,2) | Total do cupom |
| `issue_date` | DATETIME? | Data de emissão |
| `access_key` | VARCHAR(50)? | Chave NF-e (44 dígitos) |
| `source` | VARCHAR(20) | "image" |

---

### `receipt_items` → `ReceiptItem`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | — |
| `receipt_id` | FK → receipts CASCADE | — |
| `category_id` | FK → categories SET NULL | — |
| `description` | VARCHAR(300) | Nome do produto |
| `quantity` | DECIMAL(10,3) | Quantidade |
| `unit` | VARCHAR(10)? | UN, KG, L, M... |
| `unit_price` | DECIMAL(15,2) | Preço unitário |
| `total_price` | DECIMAL(15,2) | quantity × unit_price |

---

### `ai_insight_cache` → `AiInsightCache`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | — |
| `user_id` | FK → users CASCADE UNIQUE | — |
| `insights_json` | TEXT? | Cache de insights |
| `strategy_json` | TEXT? | Cache de estratégia |
| `extra_json` | TEXT? | Cache adicional |
| `is_dirty` | BOOLEAN | true = precisa recalcular |
| `updated_at` | DATETIME | — |

---

### `audit_logs` → `AuditLog`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | — |
| `user_id` | FK → users CASCADE | — |
| `action` | ENUM AuditAction | CREATE \| UPDATE \| DELETE |
| `entity` | ENUM AuditEntity | Transaction \| Account \| Goal... |
| `entity_id` | VARCHAR? | ID do objeto modificado |
| `payload` | TEXT? | JSON com os dados alterados |
| `ip` | VARCHAR? | IP do request |
| `created_at` | DATETIME | — |

---

### `subscriptions` → `Subscription`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | — |
| `user_id` | FK → users CASCADE UNIQUE | — |
| `stripe_subscription_id` | VARCHAR UNIQUE | — |
| `stripe_price_id` | VARCHAR | — |
| `status` | ENUM SubscriptionStatus | active \| canceled \| past_due \| trialing |
| `current_period_start/end` | DATETIME | — |
| `cancel_at_period_end` | BOOLEAN | — |

---

## 3. Enums

```prisma
enum AccountType    { checking savings investment credit loan financing }
enum InvestmentType { cdb stock fund fii tesouro previdencia crypto other }
enum TransactionType { income expense }
enum PaymentMethod  { debit credit }
enum FrequencyType  { once daily weekly monthly yearly }
enum GoalCategory   { viagem casa carro educacao emergencia aposentadoria outros }
enum PlanType       { FREE PRO FAMILY }
enum SubscriptionStatus { active canceled past_due trialing incomplete }
enum AuditAction    { CREATE UPDATE DELETE }
enum AuditEntity    { Transaction Account Bank Goal Reminder Category Transfer }
```

---

## 4. Relações e Chaves Estrangeiras

| Relação | OnDelete |
|---------|----------|
| users → bank_accounts | CASCADE |
| users → transactions | CASCADE |
| users → categories | CASCADE |
| users → reminders | CASCADE |
| users → goals | CASCADE |
| users → transfers | CASCADE |
| users → receipts | CASCADE |
| bank_accounts → transactions | SET NULL (account_id fica null) |
| categories → transactions | SET NULL (category_id fica null) |
| categories → reminders | SET NULL |
| receipts → transactions | SET NULL |
| transfers → transactions | CASCADE (deleta ambas as transações) |
| bank_accounts → transfers | CASCADE |

---

## 5. Migrations

| Número | Nome | Data |
|--------|------|------|
| 20260319000000 | init | 2026-03-19 |
| 20260319100000 | add_investment_fields | 2026-03-19 |
| 20260319200000 | add_banks | 2026-03-19 |
| 20260320000000 | add_audit_logs | 2026-03-20 |
| 20260320100000 | add_subscription | 2026-03-20 |
| 20260320200000 | add_openfinance | 2026-03-20 |
| 20260320300000 | add_plan_type | 2026-03-20 |
| 20260321000000 | add_ai_cache | 2026-03-21 |
| 20260321100000 | add_transfers | 2026-03-21 |
| 20260321200000 | add_financing_loan | 2026-03-21 |
| 20260322230000 | add_pending_installments | 2026-03-22 |
| 20260322240000 | add_account_currency | 2026-03-22 |
| 20260322250000 | add_user_settings | 2026-03-22 |
| 20260323000000 | add_receipts | 2026-03-23 |
| 20260405000000 | add_completed_at | 2026-04-05 |

---

## 6. Convenções

- **IDs:** UUID gerado pelo app (não auto_increment)
- **snake_case** nas colunas; PascalCase nos modelos Prisma
- **Decimais:** `DECIMAL(15,2)` para valores monetários; `DECIMAL(10,3)` para quantidades
- **Timestamps:** todos os modelos têm `created_at` e `updated_at`; `updated_at` usa `@updatedAt` (automático)
- **Soft delete:** não utilizado — remoções são físicas com cascata adequada
- **Timezone:** banco usa UTC; frontend converte para local via `fakeTimestamp()` em `mappers.ts`
