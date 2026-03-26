# Arquitetura — Finanças Pro

> **Versão:** 1.0
> **Data:** 2026-03-26

---

## Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estrutura de Diretórios](#3-estrutura-de-diretórios)
4. [Camadas da Aplicação](#4-camadas-da-aplicação)
5. [Banco de Dados](#5-banco-de-dados)
6. [Autenticação e Segurança](#6-autenticação-e-segurança)
7. [Integrações Externas](#7-integrações-externas)
8. [API — Endpoints](#8-api--endpoints)
9. [Infraestrutura e Deploy](#9-infraestrutura-e-deploy)
10. [Variáveis de Ambiente](#10-variáveis-de-ambiente)
11. [Migrações de Banco](#11-migrações-de-banco)
12. [Padrões e Decisões de Design](#12-padrões-e-decisões-de-design)

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                      USUÁRIO (Browser)                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Nginx (porta 80/443)                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Static Files (React SPA — /*)                             │   │
│  │  Proxy Pass  (/api/* → backend:5000)                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Internal Docker Network
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  NestJS Backend (porta 5000)                        │
│                                                                     │
│  FirebaseAuthGuard → Controllers → Services → Prisma ORM           │
│                                                                     │
│  ┌──────────────────┬──────────────────┬─────────────────────────┐ │
│  │  Feature Modules │  Shared Services │  External Integrations  │ │
│  │  (16 módulos)    │  Prisma, Config  │  Claude, Stripe, Pluggy │ │
│  └──────────────────┴──────────────────┴─────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Internal Network
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MySQL 8.0 (porta 3306)                          │
│                    Volume persistente: db_data                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Fluxo de request:**
```
Browser → Firebase getIdToken() → Bearer Token
       → Nginx → NestJS → FirebaseAuthGuard → Controller → Service → Prisma → MySQL
                                           ↘ Claude AI (quando análise solicitada)
                                           ↘ Stripe (assinatura/checkout)
                                           ↘ Pluggy (Open Finance)
```

---

## 2. Stack Tecnológico

### Frontend

| Tecnologia | Versão | Papel |
|------------|--------|-------|
| React | 19.0 | UI framework com Server Components (futuro) |
| TypeScript | 5.8 | Type safety end-to-end |
| Vite | 6.2 | Build tool e dev server |
| Tailwind CSS | 4.1 | Estilização utility-first |
| Recharts | 3.8 | Gráficos (barras, pizza, gauge) |
| Motion (Framer) | 12.x | Animações de UI |
| Lucide React | 0.546 | Biblioteca de ícones |
| date-fns | 4.1 | Manipulação de datas (locale ptBR) |
| Firebase | 12.x | Autenticação Google OAuth |
| react-pluggy-connect | 2.x | Widget Open Finance |
| xlsx | 0.18 | Parsing de Excel/CSV |

### Backend

| Tecnologia | Versão | Papel |
|------------|--------|-------|
| NestJS | 10.0 | Framework Node.js modular |
| TypeScript | 5.x | Type safety |
| Prisma ORM | 5.22 | Database access, migrations |
| MySQL | 8.0 | Banco de dados relacional |
| Firebase Admin SDK | 13.x | Validação de tokens Firebase |
| @anthropic-ai/sdk | 0.80 | Claude AI (chat, vision, insights) |
| Stripe | 20.x | Pagamentos e assinaturas |
| Multer | 2.x | Upload de arquivos (multipart) |
| class-validator | 0.15 | Validação de DTOs |
| xlsx | 0.18 | Parsing de faturas |

### Infraestrutura

| Componente | Tecnologia |
|------------|-----------|
| Containerização | Docker + Docker Compose |
| Servidor Web | Nginx 1.25 |
| SSL/TLS | Let's Encrypt + Certbot |
| CI/CD | deploy.sh (git pull + docker compose up) |
| VCS | Git + GitHub |

---

## 3. Estrutura de Diretórios

```
financas-pro/
├── .docs/                          # Documentação do projeto
│   ├── ARQUITETURA.md
│   ├── ESPECIFICACAO_FUNCIONAL.md
│   └── MEMORY.md
│
├── financas-back/                  # NestJS Backend
│   ├── src/
│   │   ├── app.module.ts           # Módulo raiz (registra todos os feature modules)
│   │   ├── main.ts                 # Bootstrap NestJS (CORS, Swagger, ValidationPipe)
│   │   │
│   │   ├── auth/                   # Autenticação Firebase
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.service.ts     # Valida tokens, cria usuários
│   │   │   ├── firebase-auth.guard.ts
│   │   │   └── current-user.decorator.ts
│   │   │
│   │   ├── prisma/                 # Serviço compartilhado de banco
│   │   │   ├── prisma.module.ts    # (global: true)
│   │   │   └── prisma.service.ts
│   │   │
│   │   ├── transactions/           # Transações CRUD + parcelamento
│   │   ├── accounts/               # Contas bancárias + extrato
│   │   ├── banks/                  # Instituições bancárias
│   │   ├── categories/             # Categorias + orçamento
│   │   ├── transfers/              # Transferências entre contas
│   │   ├── reminders/              # Lembretes recorrentes
│   │   ├── goals/                  # Metas financeiras
│   │   ├── ai/                     # Claude AI (insights, health, chat, OCR)
│   │   ├── notifications/          # Notificações in-app
│   │   ├── settings/               # Preferências do usuário
│   │   ├── fatura-import/          # Importação de faturas (PDF/Excel/CSV)
│   │   ├── coupon-scanner/         # Leitura de cupons fiscais (Vision)
│   │   ├── openfinance/            # Pluggy / Open Finance Brasil
│   │   ├── subscription/           # Stripe assinatura
│   │   ├── audit/                  # Log de auditoria
│   │   └── users/                  # Perfil do usuário
│   │
│   ├── prisma/
│   │   ├── schema.prisma           # Modelos e relações
│   │   └── migrations/             # 14 migrations versionadas
│   │
│   ├── Dockerfile                  # Multi-stage: build → runtime Node
│   └── package.json
│
├── financas-front/                 # React Frontend
│   ├── src/
│   │   ├── App.tsx                 # Roteamento principal, estado global
│   │   ├── main.tsx                # ReactDOM.createRoot
│   │   │
│   │   ├── views/                  # Páginas completas (14 views)
│   │   │   ├── AccountManager.tsx
│   │   │   ├── AnalyticsView.tsx
│   │   │   ├── AuditLogView.tsx
│   │   │   ├── CalendarView.tsx
│   │   │   ├── CategoryManager.tsx
│   │   │   ├── FaturaView.tsx
│   │   │   ├── GoalsView.tsx
│   │   │   ├── HealthView.tsx
│   │   │   ├── InvestmentsView.tsx
│   │   │   ├── OpenFinanceView.tsx
│   │   │   ├── PlanosView.tsx
│   │   │   ├── ReminderManager.tsx
│   │   │   ├── SettingsView.tsx
│   │   │   └── TransactionManager.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── dashboard/          # Cards e gráficos do dashboard
│   │   │   ├── modals/             # Modais (transação, transferência, cupom, etc.)
│   │   │   ├── layout/             # TopBar, NavButton
│   │   │   ├── ui/                 # Primitivos: Button, Card, Input, Select
│   │   │   ├── AuthModal.tsx
│   │   │   ├── BankLogo.tsx        # Logos via Simple Icons CDN
│   │   │   ├── Icons.tsx           # Re-exports de Lucide
│   │   │   └── PlanGate.tsx        # Guard de plano na UI
│   │   │
│   │   ├── services/
│   │   │   └── api.ts              # Cliente HTTP tipado (todas as chamadas)
│   │   │
│   │   ├── lib/
│   │   │   ├── utils.ts            # formatCurrency, cn (classnames)
│   │   │   ├── mappers.ts          # TransactionResponse → Transaction
│   │   │   ├── bankLogos.ts        # getBankSlug, getBankLogoUrl
│   │   │   ├── healthMetrics.ts    # Cálculo do score de saúde
│   │   │   └── constants.ts        # Listas de tipos, categorias padrão
│   │   │
│   │   └── types.ts                # Interfaces principais (Transaction, BankAccount, etc.)
│   │
│   ├── nginx.conf                  # Config Nginx para dev/container
│   ├── nginx.ssl.conf              # Config Nginx para produção com SSL
│   └── Dockerfile
│
├── docker-compose.yml              # Desenvolvimento local
├── docker-compose.prod.yml         # Produção VPS
├── deploy.sh                       # Script de deploy na VPS
├── .env.prod.example               # Template de variáveis de produção
└── README.md
```

---

## 4. Camadas da Aplicação

### Backend — Arquitetura em Camadas

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────┐
│  FirebaseAuthGuard                              │
│  - Extrai Bearer token                          │
│  - Valida com Firebase Admin SDK                │
│  - Injeta request.user                          │
└──────────────────────┬──────────────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  AuditInterceptor (interceptor)     │
    │  - Loga mutações (POST/PATCH/DELETE)│
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  PlanGuard (quando @RequireFeature) │
    │  - Verifica plan/trialEndsAt        │
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  Controller                         │
    │  - Validação de DTOs (class-valid.) │
    │  - Extração de parâmetros           │
    │  - Delegação para Service           │
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  Service (lógica de negócio)        │
    │  - Regras de negócio                │
    │  - Cálculos de saldo                │
    │  - Chamadas a APIs externas         │
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  Prisma ORM                         │
    │  - Queries tipadas                  │
    │  - Transações atômicas ($transaction│
    │  - Prisma $queryRawUnsafe (settings)│
    └──────────────────┬──────────────────┘
                       │
                   MySQL 8.0
```

### Frontend — Arquitetura de Estado

O estado global é gerenciado em `App.tsx` via hooks React (`useState`, `useEffect`). Não utiliza Redux ou Zustand — o estado é passado via props.

```
App.tsx (estado global)
  │
  ├── accounts[]          ← GET /accounts
  ├── transactions[]      ← GET /transactions
  ├── categories[]        ← GET /categories
  ├── banks[]             ← GET /banks
  ├── goals[]             ← GET /goals
  ├── reminders[]         ← GET /reminders
  ├── user               ← GET /users/me
  ├── settings           ← GET /settings
  └── subscriptionStatus ← GET /subscription/status
       │
       ▼ (passa como props)
  Views (FaturaView, TransactionManager, etc.)
       │
       ▼ (passa como props)
  Modais (TransactionModal, ScanCouponModal, etc.)
```

**Padrão de atualização:** após qualquer mutação bem-sucedida, a view chama a função de refetch do estado pai (ex: `onTransactionCreated()` → `fetchTransactions()`).

---

## 5. Banco de Dados

### Modelos Prisma

```
User (1)
  ├─── Bank[] (N)
  │     └─── BankAccount[] (N)
  │           ├─── Transaction[] (N)
  │           │     ├─── Transfer (via fromTx/toTx)
  │           │     └─── Receipt? (1)
  │           │           └─── ReceiptItem[] (N)
  │           │                 └─── Category? (1)
  │           └─── Reminder[] (N)
  │
  ├─── Category[] (N)
  │     ├─── Transaction[] (N)
  │     ├─── Reminder[] (N)
  │     └─── ReceiptItem[] (N)
  │
  ├─── Goal[] (N)
  ├─── Transfer[] (N)
  ├─── Receipt[] (N)
  ├─── AuditLog[] (N)
  ├─── AiInsightCache (1)
  ├─── Subscription? (1)
  └─── UserSettings? (1)
```

### Tabelas e Campos Principais

#### `users`
```sql
id              VARCHAR(36)  PK
firebase_uid    VARCHAR(255) UNIQUE
display_name    VARCHAR(255)
email           VARCHAR(255) UNIQUE
photo_url       TEXT
currency        VARCHAR(3)   DEFAULT 'BRL'
plan            ENUM('FREE','PRO','FAMILY') DEFAULT 'FREE'
stripe_customer_id VARCHAR(255) UNIQUE
trial_ends_at   DATETIME
created_at      DATETIME
updated_at      DATETIME
```

#### `bank_accounts`
```sql
id              VARCHAR(36)  PK
name            VARCHAR(255)
type            ENUM('checking','savings','investment','credit','loan','financing')
balance         DECIMAL(15,2) DEFAULT 0.00
color           VARCHAR(7)
icon            VARCHAR(50)
credit_limit    DECIMAL(15,2)
closing_day     INT
due_day         INT
investment_type ENUM('cdb','stock','fund','fii','other','tesouro','previdencia','crypto')
subtype         VARCHAR(50)
currency        VARCHAR(3)   DEFAULT 'BRL'
user_id         VARCHAR(36)  FK → users
bank_id         VARCHAR(36)  FK → banks
```

#### `transactions`
```sql
id              VARCHAR(36)  PK
amount          DECIMAL(15,2)
type            ENUM('income','expense')
description     TEXT
date            DATETIME
payment_method  ENUM('debit','credit')
is_pending      BOOLEAN      DEFAULT FALSE
installment_ref VARCHAR(64)
is_transfer     BOOLEAN      DEFAULT FALSE
transfer_id     VARCHAR(36)
user_id         VARCHAR(36)  FK
account_id      VARCHAR(36)  FK
category_id     VARCHAR(36)  FK (nullable)
```

#### `receipts`
```sql
id              VARCHAR(36)  PK
issuer_name     VARCHAR(200)
issuer_cnpj     VARCHAR(20)
total_amount    DECIMAL(15,2)
issue_date      DATETIME
access_key      VARCHAR(50)
source          VARCHAR(20)  DEFAULT 'image'
user_id         VARCHAR(36)  FK
transaction_id  VARCHAR(36)  FK (unique)
created_at      DATETIME
```

#### `receipt_items`
```sql
id              VARCHAR(36)  PK
description     VARCHAR(300)
quantity        DECIMAL(10,3)
unit            VARCHAR(10)
unit_price      DECIMAL(15,2)
total_price     DECIMAL(15,2)
receipt_id      VARCHAR(36)  FK
category_id     VARCHAR(36)  FK (nullable)
```

#### `user_settings`
```sql
id                      VARCHAR(36)  PK
user_id                 VARCHAR(36)  FK (unique)
email_notifications     BOOLEAN      DEFAULT TRUE
weekly_report           BOOLEAN      DEFAULT TRUE
monthly_report          BOOLEAN      DEFAULT TRUE
push_notifications      BOOLEAN      DEFAULT TRUE
reminder_advance_days   INT          DEFAULT 3
reminder_frequency      VARCHAR(10)  DEFAULT 'daily'
budget_alert_threshold  INT          DEFAULT 80
low_balance_alert       DECIMAL(15,2) DEFAULT 100
large_transaction_alert DECIMAL(15,2) DEFAULT 500
credit_usage_alert      INT          DEFAULT 70
emergency_fund_months   FLOAT        DEFAULT 6
savings_rate_target     INT          DEFAULT 20
debt_income_limit       INT          DEFAULT 30
risk_profile            VARCHAR(20)  DEFAULT 'moderate'
rebalance_alert         BOOLEAN      DEFAULT TRUE
rebalance_threshold     INT          DEFAULT 5
fixed_income_target     INT          DEFAULT 40
variable_target         INT          DEFAULT 40
international_target    INT          DEFAULT 20
show_market_news        BOOLEAN      DEFAULT TRUE
show_economic_news      BOOLEAN      DEFAULT TRUE
show_personal_tips      BOOLEAN      DEFAULT TRUE
updated_at              DATETIME
```

### Índices Importantes
- `transactions(user_id, date)` — queries de extrato e fatura
- `transactions(account_id)` — filtro por conta
- `transactions(installment_ref)` — agrupamento de parcelas
- `receipt_items(receipt_id)` — itens por recibo
- `audit_logs(user_id, created_at)` — histórico de auditoria

---

## 6. Autenticação e Segurança

### Fluxo de Autenticação

```
Frontend                         Firebase               Backend
   │                                │                      │
   │── signInWithPopup(Google) ────►│                      │
   │◄─ FirebaseUser + IdToken ──────│                      │
   │                                │                      │
   │── GET /api/users/me ──────────────────────────────────►
   │   Authorization: Bearer <IdToken>                     │
   │                                │                      │
   │                                │◄─ verifyIdToken ─────│
   │                                │─ DecodedToken ──────►│
   │                                                       │
   │                                         DB lookup/create User
   │◄─────────────────────────────────── UserResponse ─────│
```

### Controle de Acesso por Plano

```typescript
@RequireFeature('ai')            // Requer plano PRO
@Post('insights')
getInsights() { ... }
```

O `PlanGuard` verifica:
1. `user.plan === 'PRO' || 'FAMILY'`
2. OU `user.trialEndsAt > new Date()` (trial ativo)

### Segurança de Dados
- Todos os endpoints autenticados via `FirebaseAuthGuard`
- Queries sempre filtram por `userId` (multi-tenant por usuário)
- `ForbiddenException` quando recurso não pertence ao usuário
- CORS restrito ao `FRONTEND_URL` configurado

---

## 7. Integrações Externas

### Claude AI (Anthropic)

**Uso:** insights financeiros, health score, previsão de gastos, estratégia de metas, análise de investimentos, chat, OCR de faturas e cupons.

**Modelo:** `claude-sonnet-4-20250514` (configurável via `ANTHROPIC_MODEL`)

**Padrão de chamada:**
```typescript
const msg = await this.anthropic.messages.create({
  model: process.env.ANTHROPIC_MODEL,
  max_tokens: 4000,
  messages: [{ role: 'user', content: [...] }],
});
```

**Vision (cupons fiscais):**
```typescript
content: [
  { type: 'image', source: { type: 'base64', media_type, data: base64 } },
  { type: 'text', text: promptComInstrucoes }
]
```

**Cache:** `AiInsightCache` com `isDirty` — evita chamadas desnecessárias à API.

---

### Stripe (Pagamentos)

**Uso:** checkout de assinatura, portal do cliente, webhooks de status.

**Fluxo de checkout:**
```
POST /subscription/checkout → Stripe.checkout.sessions.create → URL
GET  /subscription/portal   → Stripe.billingPortal.sessions.create → URL
POST /subscription/webhook  → Stripe event handler → update user.plan
```

**Webhooks tratados:**
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `customer.subscription.updated`
- `customer.subscription.deleted`

---

### Pluggy (Open Finance Brasil)

**Uso:** conexão com bancos via Open Finance, importação de contas e transações.

**Fluxo:**
```
POST /openfinance/connect-token → Pluggy API → connectToken
  → Frontend Pluggy Widget usa o token
  → Usuário autentica com banco
  → Item (conexão) criado no Pluggy
POST /openfinance/items → backend persiste item
GET  /openfinance/accounts/:itemId → importa contas
GET  /openfinance/transactions/:accountId → importa transações
```

---

### Firebase (Auth)

**Uso:** exclusivamente para autenticação.
- Frontend: `firebase/auth` com Google OAuth
- Backend: `firebase-admin` para validação de tokens

---

### Simple Icons CDN (Logos Bancários)

**URL:** `https://cdn.simpleicons.org/{slug}/{colorHex}`

**Mapeamento:** `getBankSlug(bankName)` normaliza o nome e consulta `BANK_SLUG_MAP` com fallback para busca parcial.

---

## 8. API — Endpoints

**Base URL:** `/api`
**Auth:** `Authorization: Bearer <Firebase IdToken>` em todos os endpoints

### Usuários
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/users/me` | Perfil do usuário autenticado |
| PATCH | `/users/me` | Atualizar nome, moeda, foto |

### Contas
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/accounts` | Listar todas as contas |
| POST | `/accounts` | Criar conta |
| PATCH | `/accounts/:id` | Atualizar conta |
| DELETE | `/accounts/:id` | Deletar conta |
| GET | `/accounts/:id/statement` | Extrato por período (`startDate`, `endDate`) |

### Transações
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/transactions` | Listar com filtros (type, categoryId, startDate, endDate) |
| POST | `/transactions` | Criar transação |
| PATCH | `/transactions/:id` | Atualizar transação |
| DELETE | `/transactions/:id` | Deletar transação |
| PATCH | `/transactions/:id/confirm` | Confirmar transação pendente |
| POST | `/transactions/installments` | Criar parcelamento (N parcelas) |

### Categorias
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/categories` | Listar categorias |
| GET | `/categories/stats` | Gastos do mês por categoria (`?month=YYYY-MM`) |
| POST | `/categories` | Criar categoria |
| PATCH | `/categories/:id` | Atualizar |
| DELETE | `/categories/:id` | Deletar |

### Bancos
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/banks` | Listar bancos com contas |
| POST | `/banks` | Criar banco |
| PATCH | `/banks/:id` | Atualizar |
| DELETE | `/banks/:id` | Deletar |

### Transferências
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/transfers` | Listar transferências |
| POST | `/transfers` | Criar transferência (ou pagamento de fatura) |
| DELETE | `/transfers/:id` | Desfazer transferência |

### Metas
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/goals` | Listar metas |
| POST | `/goals` | Criar meta |
| PATCH | `/goals/:id` | Atualizar |
| DELETE | `/goals/:id` | Deletar |
| POST | `/goals/:id/deposit` | Depositar valor na meta |

### Lembretes
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/reminders` | Listar lembretes |
| POST | `/reminders` | Criar lembrete |
| PATCH | `/reminders/:id` | Atualizar |
| DELETE | `/reminders/:id` | Deletar |

### IA
| Método | Rota | Descrição | Plano |
|--------|------|-----------|-------|
| POST | `/ai/insights` | 3 insights personalizados | PRO |
| POST | `/ai/goals-strategy` | Estratégia para metas | PRO |
| POST | `/ai/health-score` | Score de saúde 0-100 | PRO |
| POST | `/ai/spending-forecast` | Previsão de gastos | PRO |
| POST | `/ai/investment-analysis` | Análise de portfólio | PRO |
| POST | `/ai/chat` | Chat financeiro | PRO |
| POST | `/ai/extract-receipt` | OCR de fatura/recibo | PRO |

### Notificações
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/notifications` | Notificações in-app do usuário |

### Configurações
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/settings` | Obter configurações |
| PUT | `/settings` | Salvar configurações |

### Importação de Fatura
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/fatura-import/upload` | Upload PDF/Excel/CSV → lista de itens reconciliados |
| POST | `/fatura-import/confirm` | Confirmar itens (vincular/criar/ignorar) |

### Cupom Fiscal
| Método | Rota | Descrição | Plano |
|--------|------|-----------|-------|
| POST | `/coupon-scanner/scan` | Enviar imagem → extração de itens | PRO |
| POST | `/coupon-scanner/confirm` | Confirmar e persistir | PRO |
| GET | `/coupon-scanner` | Listar cupons do usuário | PRO |

### Open Finance
| Método | Rota | Descrição | Plano |
|--------|------|-----------|-------|
| POST | `/openfinance/connect-token` | Gerar token para o widget | PRO |
| GET | `/openfinance/connectors` | Buscar bancos disponíveis | PRO |
| POST | `/openfinance/items` | Criar item (conexão) | PRO |
| GET | `/openfinance/items/:id` | Status da conexão | PRO |
| GET | `/openfinance/accounts/:itemId` | Contas da conexão | PRO |
| GET | `/openfinance/transactions/:accountId` | Transações da conta | PRO |

### Assinatura
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/subscription/status` | Status do plano atual |
| POST | `/subscription/checkout` | Iniciar checkout Stripe |
| POST | `/subscription/portal` | Portal de gerenciamento |
| POST | `/subscription/webhook` | Webhook Stripe (sem auth) |

### Auditoria
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/audit-logs` | Histórico de ações |

---

## 9. Infraestrutura e Deploy

### Docker Compose — Desenvolvimento

```yaml
# docker-compose.yml
services:
  db:        mysql:8.0 — porta 3306
  backend:   builds ./financas-back — porta 5000
  frontend:  builds ./financas-front — porta 80
```

### Docker Compose — Produção

```yaml
# docker-compose.prod.yml
services:
  db:
    image: mysql:8.0
    volumes: db_data → /var/lib/mysql
    networks: [internal]          # NÃO exposto externamente

  backend:
    build: ./financas-back
    depends_on: db (healthy)
    expose: 5000                  # Só interno
    cmd: prisma migrate deploy && node dist/main
    networks: [internal]

  frontend:
    build: ./financas-front
    ports: 80:80, 443:443         # Único ponto de entrada público
    volumes: letsencrypt (ro), certbot_www
    networks: [internal]

  certbot:                        # profile: certbot (on-demand)
    image: certbot/certbot
    volumes: letsencrypt, certbot_www

networks:
  internal:
    driver: bridge
    internal: true                # MySQL e backend inacessíveis da internet
```

### Nginx (Produção)

```nginx
# HTTP → HTTPS redirect + Let's Encrypt challenge
server {
  listen 80;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 301 https://$host$request_uri; }
}

# HTTPS com SSL terminado no Nginx
server {
  listen 443 ssl;
  ssl_certificate /etc/letsencrypt/live/DOMINIO/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/DOMINIO/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;

  # SPA — serve React e fallback para index.html
  location / { root /usr/share/nginx/html; try_files $uri /index.html; }

  # Proxy para NestJS
  location /api/ { proxy_pass http://backend:5000/api/; }

  # Cache 1 ano para assets estáticos
  location ~* \.(js|css|png|jpg|svg|woff2)$ {
    expires 1y; add_header Cache-Control "public, immutable";
  }
}
```

### Script de Deploy

```bash
# deploy.sh
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
docker image prune -f
docker compose -f docker-compose.prod.yml ps
```

### SSL — Primeiro Setup

```bash
# 1. Subir nginx sem SSL para desafio ACME
docker compose -f docker-compose.prod.yml up -d frontend

# 2. Gerar certificado
docker compose -f docker-compose.prod.yml run --rm \
  --profile certbot certbot certonly --webroot \
  -w /var/www/certbot -d seudominio.com.br

# 3. Atualizar nginx.ssl.conf com o domínio
# 4. Reiniciar nginx
docker compose -f docker-compose.prod.yml restart frontend
```

---

## 10. Variáveis de Ambiente

### Backend (`.env` / `.env.prod`)

```env
# Banco de dados
DATABASE_URL=mysql://root:SENHA@db:3306/financas_pro
DB_ROOT_PASSWORD=SENHA

# JWT / App
JWT_SECRET=string_aleatoria_longa

# Firebase Admin
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Pluggy Open Finance
PLUGGY_CLIENT_ID=
PLUGGY_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_FAMILY=price_...

# CORS
FRONTEND_URL=https://seudominio.com.br
```

### Frontend (`.env`)

```env
VITE_API_URL=/api
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_STRIPE_PRICE_PRO=price_...
VITE_STRIPE_PRICE_FAMILY=price_...
```

---

## 11. Migrações de Banco

| Migration | Data | Conteúdo |
|-----------|------|----------|
| `20260319184053_init` | 2026-03-19 | Schema inicial completo |
| `20260319223916_add_banks_table` | 2026-03-19 | Tabela `banks` |
| `20260320005323_add_ai_insight_cache` | 2026-03-20 | Cache de IA |
| `20260320010237_add_audit_logs` | 2026-03-20 | Logs de auditoria |
| `20260322120000_add_transfers` | 2026-03-22 | Transferências |
| `20260322200000_add_subtype_and_expand_investment_type` | 2026-03-22 | Subtipos de investimento |
| `20260322210000_add_ai_extra_json` | 2026-03-22 | Campo extraJson no cache |
| `20260322220000_add_loan_financing_types` | 2026-03-22 | Tipos loan/financing |
| `20260322230000_add_pending_installments` | 2026-03-22 | isPending + installmentRef |
| `20260322240000_add_account_currency` | 2026-03-22 | Multi-moeda por conta |
| `20260322250000_add_user_settings` | 2026-03-22 | Configurações do usuário |
| `20260323000000_add_receipts` | 2026-03-23 | Receipts + ReceiptItems |

**Execução em produção:** automática no startup do container backend:
```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```

---

## 12. Padrões e Decisões de Design

### Decimal para valores monetários
`Decimal(15,2)` via Prisma/MySQL evita erros de ponto flutuante em operações financeiras. No frontend, `Number(r.amount)` converte para operações de UI.

### Transações atômicas (Prisma `$transaction`)
Operações que afetam múltiplas tabelas (ex: criar parcelamento, confirmar cupom, criar transferência) são envolvidas em `$transaction` para garantir consistência.

### effectiveBalance
`Math.max(0, card.balance) + pendingTransactionsInPeriod` — garante que parcelas futuras ainda pendentes apareçam no total a pagar, sem manter o valor após pagamento.

### `isDirty` flag no cache de IA
Toda mutação invalida o cache (`isDirty = true`). Insights são recalculados apenas quando o usuário solicita explicitamente, evitando chamadas desnecessárias à API da Anthropic.

### Settings via `$queryRawUnsafe`
A tabela `user_settings` usa queries SQL raw porque o modelo não foi incluído no Prisma schema como `model` convencional — usa `@@map("user_settings")` com mapeamento manual. Candidato a refatoração futura.

### Isolamento multi-tenant
Não há separação de schemas ou databases por usuário. Isolamento é garantido por `userId` em todas as queries — todos os dados no mesmo schema MySQL.

### Deploy sem downtime
`docker compose up -d --build` recria containers sem parar o anterior até o novo estar pronto (rolling update via Compose).

### Migrações versionadas no Git
`financas-back/prisma/migrations/` **não** está no `.gitignore` — migrações são commitadas e executadas automaticamente no startup do container de produção.
