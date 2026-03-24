# 💰 Finanças Pro

Aplicação completa de gestão financeira pessoal com inteligência artificial, integração com Open Finance Brasil, múltiplas contas e cartões, score de saúde financeira e muito mais.

---

## 📋 Sumário

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Tech Stack](#tech-stack)
- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Instalação Local](#instalação-local)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Deploy em VPS](#deploy-em-vps)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [API](#api)

---

## Visão Geral

O **Finanças Pro** é um sistema web full-stack para controle financeiro pessoal. Combina gestão de contas, cartões de crédito, investimentos e metas com análises geradas por IA (Claude AI), integração nativa com bancos via Open Finance Brasil (Pluggy) e um motor de saúde financeira baseado em frameworks acadêmicos internacionais.

---

## Funcionalidades

### 🏦 Gestão de Contas
- Contas corrente, poupança, investimento, cartão de crédito, empréstimos e financiamentos
- Suporte a múltiplas moedas por conta (BRL, USD, EUR, etc.)
- Logos automáticos de bancos via Simple Icons (Nubank, XP, Itaú, Bradesco, Inter, C6 e +40 instituições)
- Configuração de limite de crédito, dia de fechamento e vencimento por cartão

### 💳 Faturas do Cartão
- Visualização de faturas por período de fechamento
- Cálculo automático do período (abertura → fechamento → vencimento)
- Importação de faturas em PDF, Excel ou CSV com extração por IA
- Parcelamento de compras (1ª parcela confirma imediatamente; demais ficam pendentes)
- Breakdown de gastos por categoria dentro do período
- Pagamento de fatura integrado com transferência entre contas

### 💸 Transações
- Registro de receitas e despesas com categoria, conta e método de pagamento
- Transferências entre contas com rastreabilidade
- Parcelamento automático (cria N transações mensais)
- Paginação (20 itens/página) com filtros por tipo, período e busca textual
- Suporte a transações pendentes (`isPending`) que não afetam saldo até confirmação

### 📊 Análises & IA
- **Claude AI**: 3 insights financeiros personalizados com base no histórico
- Previsão de gastos para o próximo mês
- Análise de estratégia de investimentos
- Extração automática de recibos e faturas por IA
- Cache inteligente de insights (evita requisições desnecessárias)

### 🫀 Saúde Financeira
Score 0–100 calculado com base em 6 indicadores ponderados, inspirado nos frameworks **I-SFB (Febraban + BCB)**, **FinHealth Score® (FHN)** e **CFPB Financial Well-Being Scale**:

| Indicador | Peso | Benchmark |
|-----------|------|-----------|
| Reserva de Emergência | 25% | 6 meses de despesas |
| Taxa de Poupança | 20% | ≥ 20% da renda |
| Endividamento (DTI) | 20% | ≤ 30% da renda |
| Utilização de Crédito | 15% | ≤ 30% do limite |
| Índice de Liquidez | 10% | Ativos líquidos / Despesas mensais |
| Comprometimento de Renda | 10% | Despesas fixas / Renda |

### 📈 Investimentos
- Portfólio com CDB, ações, fundos, FIIs, Tesouro Direto, previdência e crypto
- Acompanhamento de saldo e tipo por conta de investimento
- Integração com metas de investimento

### 🎯 Metas Financeiras
- Categorias: Viagem, Casa, Carro, Educação, Reserva de Emergência, Aposentadoria, Outros
- Acompanhamento de progresso com depósitos parciais
- Projeções e estratégias geradas por IA

### 🔔 Lembretes & Notificações
- Lembretes recorrentes: único, diário, semanal, mensal, anual
- Notificações in-app para:
  - Pagamentos vencidos (alerta crítico)
  - Pagamentos próximos (aviso antecipado configurável)
  - Orçamento de categoria excedido
  - Meta financeira atingida

### 🏛️ Open Finance Brasil
- Integração com **Pluggy API** para sincronização com bancos reais
- Conexão segura via widget Pluggy Connect
- Descoberta automática de contas e sincronização de saldo/transações

### 📅 Calendário Financeiro
- Visualização de vencimentos, lembretes e transações por data
- Visão mensal com agrupamento por dia

### 🔐 Autenticação & Planos
- Login via **Google (Firebase Auth)**
- 3 planos: **FREE**, **PRO**, **FAMILY**
- Integração com **Stripe** para pagamento de assinatura
- Controle de acesso por funcionalidade (`PlanGate`)

### 📋 Auditoria
- Log completo de todas as operações (criar, editar, excluir)
- Rastreabilidade por entidade, usuário, data e IP

### ⚙️ Configurações
- Alertas de orçamento por categoria
- Metas de alocação de investimentos (renda fixa, variável, internacional)
- Preferências de notificação (e-mail, push, aviso antecipado)
- Meses de reserva de emergência alvo

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

### Backend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| NestJS | 10 | Framework API REST |
| TypeScript | 5.1 | Tipagem estática |
| Prisma | 5.22 | ORM |
| MySQL | 8.0 | Banco de dados |
| Firebase Admin | 13.7 | Validação de tokens |
| Anthropic SDK | 0.80 | Claude AI |
| Stripe | 20.4 | Pagamentos |
| Passport JWT | — | Autenticação |
| Swagger | — | Documentação da API |
| Jest | — | Testes |

### Infraestrutura
| Tecnologia | Uso |
|------------|-----|
| Docker + Docker Compose | Containerização |
| Nginx | Servidor web / Proxy reverso |
| Let's Encrypt (Certbot) | SSL/TLS gratuito |
| Simple Icons CDN | Logos de bancos |

---

## Arquitetura

```
┌─────────────────────────────────────────────────┐
│                    VPS / Local                  │
│                                                 │
│  ┌──────────────┐      ┌──────────────────────┐ │
│  │   Nginx      │      │   NestJS Backend     │ │
│  │  (porta 80/  │─────▶│   (porta 5000)       │ │
│  │   443)       │      │                      │ │
│  │  React SPA   │      │  /api/*              │ │
│  └──────────────┘      └──────────┬───────────┘ │
│                                   │             │
│                        ┌──────────▼───────────┐ │
│                        │   MySQL 8.0          │ │
│                        │   (rede interna)     │ │
│                        └──────────────────────┘ │
└─────────────────────────────────────────────────┘
         │                        │
    Firebase Auth            Anthropic AI
    (autenticação)           (insights)
         │                        │
    Pluggy API               Stripe
    (Open Finance)           (pagamentos)
```

**Rede Docker:** MySQL e Backend ficam na rede interna (`internal`). Apenas as portas 80 e 443 do Nginx são expostas externamente.

**Proxy:** O Nginx redireciona `/api/*` para o backend interno. O frontend React faz todas as chamadas para `/api/` sem URL hardcoded.

---

## Pré-requisitos

- **Node.js** 20+
- **npm** 10+
- **MySQL** 8.0 (local) ou **Docker** (para ambiente containerizado)
- Conta no **Firebase** (autenticação Google)
- Chave de API **Anthropic** (Claude AI)

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

# Execute as migrações e suba o servidor
npx prisma migrate deploy
npx prisma generate
npm run start:dev
# API disponível em http://localhost:5000
# Docs:       http://localhost:5000/api/docs
```

### 3. Frontend
```bash
cd financas-front
npm install

# Configure a URL da API
echo "VITE_API_URL=http://localhost:5000/api" > .env

npm run dev
# App disponível em http://localhost:3000
```

### 4. Com Docker (recomendado)
```bash
# Na raiz do projeto
docker compose up -d --build
# Frontend: http://localhost
# Backend:  http://localhost:5000
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

# Anthropic AI
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
- Docker + Docker Compose instalados
- Domínio apontando para o IP da VPS (registros A para `@` e `www`)

### 1. Instalar Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

### 2. Clonar e configurar
```bash
git clone https://github.com/Everiss/financas-pro.git
cd financas-pro

# Criar arquivo de variáveis de produção
cp .env.prod.example .env.prod
nano .env.prod   # preencha todos os valores

# Configurar o domínio no nginx (substitua SEU_DOMINIO.com.br)
nano financas-front/nginx.ssl.conf
```

### 3. Primeira subida (somente HTTP)

Enquanto ainda não há certificado, comente o bloco `server 443` em `nginx.ssl.conf` e suba:

```bash
docker compose -f docker-compose.prod.yml up -d --build
# Verifique: http://seudominio.com.br
```

### 4. Emitir certificado SSL (Let's Encrypt)
```bash
docker compose -f docker-compose.prod.yml --profile certbot run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d seudominio.com.br -d www.seudominio.com.br \
  --email seuemail@gmail.com --agree-tos --no-eff-email
```

### 5. Ativar HTTPS
```bash
# Restaure o nginx.ssl.conf completo (descomente o bloco 443)
docker compose -f docker-compose.prod.yml restart frontend
# Verifique: https://seudominio.com.br
```

### 6. Deploys futuros
```bash
bash deploy.sh
# Executa: git pull → docker build → restart → image prune
```

### 7. Renovação automática de SSL
```bash
crontab -e
# Adicione (toda segunda-feira às 3h):
0 3 * * 1 cd /root/financas-pro && docker compose -f docker-compose.prod.yml --profile certbot run --rm certbot renew && docker compose -f docker-compose.prod.yml restart frontend
```

### Comandos úteis na VPS
```bash
# Status dos containers
docker compose -f docker-compose.prod.yml ps

# Logs do backend
docker compose -f docker-compose.prod.yml logs -f backend

# Logs do nginx
docker compose -f docker-compose.prod.yml logs -f frontend

# Acessar o MySQL
docker exec -it financas_db mysql -uroot -p financas_pro

# Rodar migrations manualmente
docker exec financas_backend npx prisma migrate deploy
```

---

## Estrutura do Projeto

```
financas-pro/
├── financas-back/               # Backend NestJS
│   ├── src/
│   │   ├── accounts/            # Contas bancárias (CRUD + extrato)
│   │   ├── ai/                  # Integração Claude AI (insights, cache)
│   │   ├── audit/               # Log de auditoria
│   │   ├── auth/                # Guard Firebase JWT
│   │   ├── banks/               # Bancos
│   │   ├── categories/          # Categorias com orçamento
│   │   ├── fatura-import/       # Importação de faturas (PDF/Excel)
│   │   ├── goals/               # Metas financeiras
│   │   ├── notifications/       # Notificações in-app
│   │   ├── openfinance/         # Pluggy Open Finance
│   │   ├── prisma/              # PrismaService
│   │   ├── reminders/           # Lembretes recorrentes
│   │   ├── settings/            # Configurações do usuário
│   │   ├── subscription/        # Stripe / Planos
│   │   ├── transactions/        # Transações + parcelamentos
│   │   ├── transfers/           # Transferências entre contas
│   │   └── users/               # Usuários
│   ├── prisma/
│   │   ├── schema.prisma        # Schema do banco (16 modelos)
│   │   └── migrations/          # Migrações versionadas
│   └── Dockerfile
│
├── financas-front/              # Frontend React
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/       # 13 cards do dashboard
│   │   │   ├── modals/          # Transação, transferência, fatura, metas
│   │   │   ├── layout/          # TopBar, NavButton
│   │   │   ├── BankLogo.tsx     # Logo de banco com fallback
│   │   │   └── ui/              # Componentes base (Button, Card, Input...)
│   │   ├── views/               # 14 páginas da aplicação
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
│   │   ├── lib/
│   │   │   ├── bankLogos.ts     # Mapeamento banco → Simple Icons slug
│   │   │   ├── healthMetrics.ts # Motor de cálculo do score de saúde
│   │   │   ├── mappers.ts       # Conversão API → tipos frontend
│   │   │   └── utils.ts         # formatCurrency, cn, etc.
│   │   ├── services/
│   │   │   └── api.ts           # Todas as chamadas à API REST
│   │   ├── contexts/            # React contexts (Confirm, Auth...)
│   │   └── types.ts             # Tipos TypeScript globais
│   ├── nginx.conf               # Nginx para desenvolvimento (HTTP)
│   ├── nginx.ssl.conf           # Nginx para produção (HTTPS + redirect)
│   └── Dockerfile
│
├── docker-compose.yml           # Ambiente de desenvolvimento local
├── docker-compose.prod.yml      # Produção em VPS (com MySQL + SSL)
├── .env.prod.example            # Template de variáveis para produção
└── deploy.sh                    # Script de deploy na VPS
```

---

## API

A documentação completa da API (Swagger) está disponível em:

```
http://localhost:5000/api/docs
```

### Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/transactions` | Listar transações (com filtros) |
| `POST` | `/api/transactions` | Criar transação |
| `POST` | `/api/transactions/installments` | Criar compra parcelada |
| `PATCH` | `/api/transactions/:id/confirm` | Confirmar transação pendente |
| `GET` | `/api/accounts` | Listar contas |
| `GET` | `/api/accounts/:id/statement` | Extrato por período |
| `GET` | `/api/banks` | Listar bancos |
| `GET` | `/api/categories` | Listar categorias |
| `GET` | `/api/goals` | Listar metas |
| `GET` | `/api/reminders` | Listar lembretes |
| `GET` | `/api/ai/insights` | Insights gerados por IA |
| `POST` | `/api/fatura-import/upload` | Upload de fatura (PDF/Excel) |
| `POST` | `/api/fatura-import/confirm` | Confirmar importação |
| `GET` | `/api/notifications` | Notificações do usuário |
| `GET` | `/api/audit` | Log de auditoria |
| `GET` | `/api/settings` | Configurações do usuário |

> Todos os endpoints requerem autenticação via header `Authorization: Bearer <firebase_id_token>`.

---

## Licença

Uso privado — todos os direitos reservados.
