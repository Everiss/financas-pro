# 💰 Finanças Pro

Aplicação completa de gestão financeira pessoal com inteligência artificial, integração com Open Finance Brasil, leitura de cupons fiscais, múltiplas contas e cartões, score de saúde financeira e deploy em VPS via Docker.

---

## 📋 Sumário

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Tech Stack](#tech-stack)
- [Arquitetura](#arquitetura)
- [Banco de Dados](#banco-de-dados)
- [Pré-requisitos](#pré-requisitos)
- [Instalação Local](#instalação-local)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Deploy em VPS](#deploy-em-vps)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [API](#api)

---

## Visão Geral

O **Finanças Pro** é um sistema web full-stack para controle financeiro pessoal. Combina gestão de contas, cartões de crédito, investimentos e metas com análises geradas por IA (Claude AI), integração nativa com bancos via Open Finance Brasil (Pluggy), leitura automática de cupons fiscais por visão computacional e um motor de saúde financeira baseado em frameworks acadêmicos internacionais.

---

## Funcionalidades

### 🏦 Gestão de Contas
- Contas corrente, poupança, investimento, cartão de crédito, empréstimos e financiamentos
- Suporte a múltiplas moedas por conta (BRL, USD, EUR, etc.)
- Logos automáticos de bancos via Simple Icons CDN — 40+ instituições mapeadas (Nubank, XP, Itaú, Bradesco, Inter, C6, PicPay, Mercado Pago, Neon e outras)
- Fallback automático para iniciais coloridas quando o banco não tem logo mapeado
- Configuração de limite de crédito, dia de fechamento e vencimento por cartão

### 💳 Faturas do Cartão
- Visualização de faturas por período de fechamento com navegação entre meses
- Cálculo automático do período (abertura → fechamento → vencimento)
- Importação de faturas em PDF, Excel ou CSV com extração por IA
- Parcelamento de compras: 1ª parcela é confirmada imediatamente (afeta saldo), as demais ficam pendentes
- `effectiveBalance`: exibe o maior valor entre saldo do cartão e total do período, evitando inconsistências em parcelas pendentes
- Breakdown de gastos por categoria dentro do período
- Pagamento de fatura integrado com transferência entre contas

### 💸 Transações
- Registro de receitas e despesas com categoria, conta e método de pagamento
- Transferências entre contas com rastreabilidade completa
- Parcelamento automático (cria N transações mensais; 1ª confirma o saldo imediatamente)
- Paginação de 20 itens/página com filtros por tipo (receita/despesa/pendente), busca textual e período
- Transações pendentes (`isPending`) não afetam saldo até confirmação manual
- Parcelamento restrito a despesas em cartão de crédito

### 🧾 Cupons Fiscais (NF-e / NFC-e)
- Upload de foto do cupom fiscal (JPG, PNG, WEBP) via drag & drop ou seleção
- Claude Vision analisa a imagem e extrai automaticamente:
  - Nome e CNPJ do estabelecimento
  - Data de emissão, valor total, chave de acesso (44 dígitos)
  - **Todos os itens**: descrição, quantidade, unidade (UN/KG/L), preço unitário e total
  - Categoria sugerida por item com base nas categorias cadastradas no sistema
- Wizard de 4 etapas: upload → processamento IA → revisão de itens → confirmação
- Revisão interativa: categoria de cada item editável antes de salvar
- Criação automática de Transaction + Receipt + ReceiptItems em uma única operação atômica
- Histórico de cupons vinculado a transações

### 📊 Análises & IA
- **Claude AI** (claude-sonnet-4): 3 insights financeiros personalizados com base nos últimos 30 dias
- Previsão de gastos para o próximo mês por categoria
- Análise de estratégia de investimentos com base no portfólio atual
- Extração automática de recibos e faturas por visão computacional
- Chat financeiro interativo com contexto do histórico
- Cache inteligente de insights com invalidação automática após novas transações

### 🫀 Saúde Financeira
Score 0–100 calculado com 6 indicadores ponderados, inspirado nos frameworks **I-SFB (Febraban + BCB)**, **FinHealth Score® (Financial Health Network)** e **CFPB Financial Well-Being Scale**:

| Indicador | Peso | Benchmark |
|-----------|------|-----------|
| Reserva de Emergência | 25% | 6 meses de despesas |
| Taxa de Poupança | 20% | ≥ 20% da renda |
| Endividamento — DTI | 20% | ≤ 30% da renda |
| Utilização de Crédito | 15% | ≤ 30% do limite |
| Índice de Liquidez | 10% | Ativos líquidos / Despesas mensais |
| Comprometimento de Renda | 10% | Despesas fixas / Renda |

- Score interpolado com `lerp()` para transições suaves entre faixas
- Status: Saudável (≥75) / Em equilíbrio (≥50) / Atenção (≥25) / Vulnerável (<25)
- Card resumo no dashboard com gauge circular e 3 piores indicadores
- Página dedicada com gauge grande, cards de indicadores detalhados e metodologia

### 📈 Investimentos
- Portfólio com CDB, ações, fundos, FIIs, Tesouro Direto, previdência e crypto
- Acompanhamento de saldo e tipo por conta de investimento
- Análise de diversificação e estratégia por IA

### 🎯 Metas Financeiras
- Categorias: Viagem, Casa, Carro, Educação, Reserva de Emergência, Aposentadoria, Outros
- Acompanhamento de progresso com depósitos parciais
- Estratégias e projeções geradas por IA (viabilidade, tempo estimado, poupança mensal necessária)

### 🔔 Lembretes & Notificações
- Lembretes recorrentes: único, diário, semanal, mensal, anual
- Notificações in-app automáticas:
  - Pagamentos vencidos (alerta crítico)
  - Pagamentos próximos (aviso antecipado configurável em dias)
  - Orçamento de categoria excedido
  - Meta financeira atingida

### 🏛️ Open Finance Brasil
- Integração com **Pluggy API** para sincronização com bancos reais
- Conexão segura via widget Pluggy Connect
- Descoberta automática de contas e sincronização de saldo/transações

### 📅 Calendário Financeiro
- Visualização de vencimentos, lembretes e transações por data
- Visão mensal com agrupamento por dia e totais

### 🔐 Autenticação & Planos
- Login via **Google (Firebase Auth)** — sem senha, sem cadastro manual
- 3 planos: **FREE**, **PRO**, **FAMILY**
- Integração com **Stripe** para pagamento de assinatura com webhook
- `PlanGate`: componente que restringe funcionalidades por plano

### 📋 Auditoria
- Log completo de todas as operações (criar, editar, excluir) em todas as entidades
- Rastreabilidade por entidade, usuário, data e IP

### ⚙️ Configurações
- Alertas de orçamento, saldo baixo e transação grande (valores configuráveis)
- Metas de alocação de investimentos (renda fixa, variável, internacional)
- Preferências de notificação (e-mail, push, aviso antecipado em dias)
- Meses de reserva de emergência alvo e taxa de poupança meta

---

## Tech Stack

### Frontend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| React | 19.0 | UI framework |
| TypeScript | 5.8 | Tipagem estática |
| Vite | 6.2 | Build tool |
| Tailwind CSS | 4.1 | Estilização |
| Firebase | 12.11 | Autenticação Google |
| Recharts | 3.8 | Gráficos |
| Motion (Framer) | 12.23 | Animações |
| Lucide React | 0.546 | Ícones |
| date-fns | 4.1 | Manipulação de datas |
| XLSX | 0.18 | Importação de planilhas |
| react-pluggy-connect | 2.12 | Widget Open Finance |
| Simple Icons CDN | — | Logos de bancos |

### Backend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| NestJS | 10 | Framework API REST |
| TypeScript | 5.1 | Tipagem estática |
| Prisma | 5.22 | ORM |
| MySQL | 8.0 | Banco de dados |
| Firebase Admin | 13.7 | Validação de tokens JWT |
| Anthropic SDK | 0.80 | Claude AI (Vision + Chat) |
| Stripe | 20.4 | Pagamentos e assinaturas |
| Passport JWT | — | Estratégia de autenticação |
| Multer | — | Upload de arquivos |
| XLSX | 0.18 | Parsing de planilhas Excel |
| Swagger | — | Documentação da API |
| Jest | — | Testes |

### Infraestrutura
| Tecnologia | Uso |
|------------|-----|
| Docker + Docker Compose | Containerização (dev e produção) |
| Nginx | Servidor web, proxy reverso e SSL termination |
| Let's Encrypt + Certbot | SSL/TLS gratuito com renovação automática |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                     VPS / Local                     │
│                                                     │
│  ┌────────────────┐      ┌──────────────────────┐   │
│  │  Nginx (80/443)│      │   NestJS Backend      │   │
│  │                │─────▶│   (porta 5000)        │   │
│  │  React SPA     │      │   /api/*              │   │
│  │  assets static │      │                      │   │
│  └────────────────┘      └──────────┬────────────┘  │
│                                     │               │
│                          ┌──────────▼────────────┐  │
│                          │   MySQL 8.0           │  │
│                          │   (rede interna)      │  │
│                          └───────────────────────┘  │
└─────────────────────────────────────────────────────┘
          │                          │
    Firebase Auth             Anthropic Claude
    (autenticação)            (Vision + Insights)
          │                          │
    Pluggy API                   Stripe
    (Open Finance)            (assinaturas)
```

**Rede Docker:** MySQL e Backend ficam na rede interna (`internal`). Apenas portas 80 e 443 do Nginx são expostas externamente.

**Proxy:** Nginx redireciona `/api/*` para o backend. O frontend usa `/api/` relativo — sem URLs hardcoded no build.

---

## Banco de Dados

O schema Prisma define **18 modelos** com MySQL 8.0:

| Modelo | Descrição |
|--------|-----------|
| `User` | Usuário com Firebase UID, plano e moeda padrão |
| `UserSettings` | 30+ configurações (alertas, notificações, metas de investimento) |
| `Subscription` | Assinatura Stripe (status, período, cancelamento) |
| `Bank` | Instituição financeira (nome, cor, ícone) |
| `BankAccount` | Conta com tipo, saldo, limite, moeda e dias de fechamento/vencimento |
| `Category` | Categoria de transação com orçamento opcional |
| `Transaction` | Receita/despesa com suporte a parcelamentos e pendências |
| `Transfer` | Transferência entre contas com transações vinculadas |
| `Receipt` | Cabeçalho do cupom fiscal (emissor, CNPJ, total, chave NF-e) |
| `ReceiptItem` | Item individual do cupom com categoria própria |
| `Goal` | Meta financeira com progresso e prazo |
| `Reminder` | Lembrete recorrente com frequência configurável |
| `AuditLog` | Registro imutável de todas as ações |
| `AiInsightCache` | Cache de insights, estratégias e análises de IA |

### Migrações
Todas as migrações são versionadas em `financas-back/prisma/migrations/` e aplicadas automaticamente no boot do container via `prisma migrate deploy`.

---

## Pré-requisitos

- **Node.js** 20+
- **npm** 10+
- **MySQL** 8.0 (local) ou **Docker** (recomendado)
- Conta no **Firebase** com autenticação Google habilitada
- Chave de API **Anthropic** (Claude AI) — obrigatória para IA e leitura de cupons

---

## Instalação Local

### 1. Clone o repositório
```bash
git clone https://github.com/Everiss/financas-pro.git
cd financas-pro
```

### 2. Backend
```bash
cd financas-back
npm install

# Configure as variáveis de ambiente
cp .env.example .env   # edite com seus valores

# Aplique as migrações e suba o servidor
npx prisma migrate deploy
npx prisma generate
npm run start:dev
# API:  http://localhost:5000
# Docs: http://localhost:5000/api/docs
```

### 3. Frontend
```bash
cd financas-front
npm install

echo "VITE_API_URL=http://localhost:5000/api" > .env

npm run dev
# App: http://localhost:3000
```

### 4. Com Docker (recomendado)
```bash
# Na raiz do projeto
docker compose up -d --build
# Frontend: http://localhost
# Backend:  http://localhost:5000/api
```

---

## Variáveis de Ambiente

### Backend (`financas-back/.env`)
```env
# Banco de Dados
DATABASE_URL="mysql://root:senha@localhost:3306/financas_pro"

# JWT
JWT_SECRET="string_aleatoria_longa_min_32_chars"
JWT_EXPIRES_IN="7d"

# Firebase Admin SDK
FIREBASE_PROJECT_ID="seu-projeto-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@projeto.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Anthropic AI (obrigatório — usado para insights, cupons e fatura)
ANTHROPIC_API_KEY="sk-ant-api03-..."
ANTHROPIC_MODEL="claude-sonnet-4-20250514"

# Pluggy Open Finance
PLUGGY_CLIENT_ID="uuid"
PLUGGY_CLIENT_SECRET="uuid"

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_PRO="price_..."
STRIPE_PRICE_FAMILY="price_..."

# App
PORT=5000
FRONTEND_URL="http://localhost:3000"
```

### Frontend (`financas-front/.env`)
```env
VITE_API_URL=http://localhost:5000/api
VITE_STRIPE_PRICE_PRO=price_...
VITE_STRIPE_PRICE_FAMILY=price_...
```

---

## Deploy em VPS

### Pré-requisitos na VPS
- Ubuntu 22.04+ (ou similar)
- Docker + Docker Compose
- Domínio com registros A apontando para o IP da VPS (`@` e `www`)

### 1. Instalar Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

### 2. Clonar e configurar
```bash
git clone https://github.com/Everiss/financas-pro.git
cd financas-pro

cp .env.prod.example .env.prod
nano .env.prod   # preencha todos os valores

# Substitua SEU_DOMINIO.com.br pelo seu domínio (2 ocorrências)
nano financas-front/nginx.ssl.conf
```

### 3. Primeira subida (HTTP)
Comente o bloco `server 443` no `nginx.ssl.conf` enquanto ainda não há certificado:
```bash
docker compose -f docker-compose.prod.yml up -d --build
# Verifique: http://seudominio.com.br
```

### 4. Emitir certificado SSL
```bash
docker compose -f docker-compose.prod.yml --profile certbot run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d seudominio.com.br -d www.seudominio.com.br \
  --email seuemail@gmail.com --agree-tos --no-eff-email
```

### 5. Ativar HTTPS
```bash
# Restaure o nginx.ssl.conf completo (com bloco 443)
docker compose -f docker-compose.prod.yml restart frontend
# Verifique: https://seudominio.com.br
```

### 6. Deploys futuros
```bash
bash deploy.sh
# git pull → docker build → restart → prune
```

### 7. Renovação automática de SSL
```bash
crontab -e
# Adicione (toda segunda às 3h):
0 3 * * 1 cd /root/financas-pro && docker compose -f docker-compose.prod.yml --profile certbot run --rm certbot renew && docker compose -f docker-compose.prod.yml restart frontend
```

### Comandos úteis na VPS
```bash
# Status
docker compose -f docker-compose.prod.yml ps

# Logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend

# Acessar MySQL
docker exec -it financas_db mysql -uroot -p financas_pro

# Rodar migrations manualmente
docker exec financas_backend npx prisma migrate deploy
```

---

## Estrutura do Projeto

```
financas-pro/
├── financas-back/                    # Backend NestJS
│   ├── src/
│   │   ├── accounts/                 # Contas bancárias (CRUD + extrato por período)
│   │   ├── ai/                       # Claude AI: insights, receipt, forecast, chat
│   │   ├── audit/                    # Log de auditoria imutável
│   │   ├── auth/                     # Guard Firebase JWT
│   │   ├── banks/                    # Bancos (CRUD)
│   │   ├── categories/               # Categorias com orçamento
│   │   ├── coupon-scanner/           # Leitura de cupons fiscais (NF-e) via IA
│   │   ├── fatura-import/            # Importação de faturas (PDF/Excel/CSV)
│   │   ├── goals/                    # Metas financeiras
│   │   ├── notifications/            # Notificações in-app automáticas
│   │   ├── openfinance/              # Pluggy Open Finance Brasil
│   │   ├── prisma/                   # PrismaService
│   │   ├── reminders/                # Lembretes recorrentes
│   │   ├── settings/                 # Configurações do usuário
│   │   ├── subscription/             # Stripe + planos
│   │   ├── transactions/             # Transações + parcelamentos + confirmação
│   │   ├── transfers/                # Transferências entre contas
│   │   └── users/                    # Usuários
│   ├── prisma/
│   │   ├── schema.prisma             # Schema — 18 modelos
│   │   └── migrations/               # Migrações versionadas (13 arquivos)
│   └── Dockerfile
│
├── financas-front/                   # Frontend React 19
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/            # 13 cards do dashboard
│   │   │   │   ├── AIInsights.tsx
│   │   │   │   ├── BudgetProgress.tsx
│   │   │   │   ├── Charts.tsx
│   │   │   │   ├── CreditCardUsage.tsx
│   │   │   │   ├── DashboardStats.tsx
│   │   │   │   ├── HealthScoreCard.tsx
│   │   │   │   └── ...
│   │   │   ├── modals/
│   │   │   │   ├── TransactionModal.tsx    # Criar/editar transação
│   │   │   │   ├── TransferenciaModal.tsx  # Transferência entre contas
│   │   │   │   ├── ImportFaturaModal.tsx   # Importar fatura do cartão
│   │   │   │   ├── ScanCouponModal.tsx     # Escanear cupom fiscal
│   │   │   │   ├── GoalModal.tsx
│   │   │   │   └── ReminderModal.tsx
│   │   │   ├── BankLogo.tsx          # Logo de banco via Simple Icons + fallback
│   │   │   └── ui/                   # Button, Card, Input, Select, RadioGroup...
│   │   ├── views/                    # 14 páginas
│   │   │   ├── AccountManager.tsx    # Contas e bancos
│   │   │   ├── AnalyticsView.tsx     # Análises com IA
│   │   │   ├── AuditLogView.tsx      # Log de auditoria
│   │   │   ├── CalendarView.tsx      # Calendário financeiro
│   │   │   ├── CategoryManager.tsx   # Categorias e orçamentos
│   │   │   ├── FaturaView.tsx        # Faturas do cartão
│   │   │   ├── GoalsView.tsx         # Metas financeiras
│   │   │   ├── HealthView.tsx        # Saúde financeira (score + indicadores)
│   │   │   ├── InvestmentsView.tsx   # Portfólio de investimentos
│   │   │   ├── OpenFinanceView.tsx   # Open Finance Brasil
│   │   │   ├── PlanosView.tsx        # Planos e assinatura
│   │   │   ├── ReminderManager.tsx   # Lembretes
│   │   │   ├── SettingsView.tsx      # Configurações
│   │   │   └── TransactionManager.tsx # Transações + cupom fiscal
│   │   ├── lib/
│   │   │   ├── bankLogos.ts          # Nome de banco → slug Simple Icons (40+ mapeados)
│   │   │   ├── healthMetrics.ts      # Motor de score de saúde (6 indicadores + lerp)
│   │   │   ├── mappers.ts            # API response → tipos TypeScript (com fix de fuso)
│   │   │   └── utils.ts             # formatCurrency, cn, formatDate
│   │   ├── services/
│   │   │   └── api.ts               # Todos os endpoints REST tipados
│   │   ├── contexts/                # ConfirmContext, AuthContext
│   │   └── types.ts                 # Interfaces globais
│   ├── nginx.conf                   # Nginx dev (HTTP + proxy /api)
│   ├── nginx.ssl.conf               # Nginx prod (HTTPS + redirect 80→443)
│   └── Dockerfile                   # Multi-stage: Node build → Nginx serve
│
├── docker-compose.yml               # Dev local (MySQL + backend + frontend)
├── docker-compose.prod.yml          # VPS produção (MySQL + SSL + certbot)
├── .env.prod.example                # Template de variáveis para produção
└── deploy.sh                        # Script de deploy na VPS
```

---

## API

Documentação completa (Swagger UI):
```
http://localhost:5000/api/docs
```

### Endpoints

#### Transações
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/transactions` | Listar (filtros: type, startDate, endDate, accountId) |
| `POST` | `/api/transactions` | Criar transação |
| `POST` | `/api/transactions/installments` | Criar compra parcelada (N meses) |
| `PATCH` | `/api/transactions/:id` | Editar transação |
| `PATCH` | `/api/transactions/:id/confirm` | Confirmar pendente (atualiza saldo) |
| `DELETE` | `/api/transactions/:id` | Excluir (reverte saldo) |

#### Cupom Fiscal
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/coupon-scanner/scan` | Envia imagem → retorna dados extraídos por IA |
| `POST` | `/api/coupon-scanner/confirm` | Salva Receipt + ReceiptItems + Transaction |
| `GET` | `/api/coupon-scanner` | Listar cupons do usuário |

#### Contas & Bancos
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/accounts` | Listar contas |
| `POST` | `/api/accounts` | Criar conta |
| `PATCH` | `/api/accounts/:id` | Editar conta |
| `DELETE` | `/api/accounts/:id` | Excluir conta |
| `GET` | `/api/accounts/:id/statement` | Extrato por período (startDate, endDate, month) |
| `GET` | `/api/banks` | Listar bancos |

#### IA
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/ai/insights` | 3 insights dos últimos 30 dias |
| `POST` | `/api/ai/goals-strategy` | Estratégia de metas por IA |
| `POST` | `/api/ai/health-score` | Score de saúde financeira por IA |
| `POST` | `/api/ai/spending-forecast` | Previsão de gastos |
| `POST` | `/api/ai/investment-analysis` | Análise do portfólio |
| `POST` | `/api/ai/extract-receipt` | Extração de comprovante (imagem) |
| `POST` | `/api/ai/chat` | Chat financeiro interativo |

#### Outros
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/categories` | Listar categorias |
| `GET` | `/api/goals` | Listar metas |
| `GET` | `/api/reminders` | Listar lembretes |
| `POST` | `/api/fatura-import/upload` | Upload de fatura (PDF/Excel) |
| `POST` | `/api/fatura-import/confirm` | Confirmar itens importados |
| `GET` | `/api/notifications` | Notificações do usuário |
| `GET` | `/api/audit` | Log de auditoria |
| `GET` | `/api/settings` | Configurações |
| `PATCH` | `/api/settings` | Atualizar configurações |

> Todos os endpoints requerem `Authorization: Bearer <firebase_id_token>`.

---

## Licença

Uso privado — todos os direitos reservados.
