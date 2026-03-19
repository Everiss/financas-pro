# Documentação do Sistema - Finanças Pro (Arquitetura NestJS)

## 1. Introdução
O **Finanças Pro** é uma aplicação de gestão financeira pessoal. Esta documentação descreve a transição para uma arquitetura de micro-serviços/monolito modular utilizando **NestJS** no backend, mantendo o frontend em **React 19**.

---

## 2. Arquitetura do Sistema

### Frontend (React)
- **Framework:** React 19 + TypeScript.
- **Estado:** React Hooks + Context API (ou TanStack Query para consumo da API NestJS).
- **Estilização:** Tailwind CSS v4.

### Backend (NestJS)
- **Framework:** NestJS (Node.js).
- **Linguagem:** TypeScript.
- **ORM:** Prisma ou TypeORM.
- **Banco de Dados:** MySQL (Instância Local).
- **Autenticação:** Passport.js com Firebase Admin SDK (para validar tokens do Google Login).
- **Documentação API:** Swagger (@nestjs/swagger).

---

## 3. Estrutura de Módulos (NestJS)

O backend é organizado em módulos independentes para garantir escalabilidade e manutenção.

### 3.1 AuthModule
Responsável pela validação da identidade do usuário.
- **Estratégia:** JWT ou Firebase ID Token.
- **Guard:** `AuthGuard` global para proteger rotas.

### 3.2 UsersModule
Gerencia o perfil e preferências do usuário.
- **Rotas:**
  - `GET /users/me`: Retorna o perfil do usuário logado.
  - `PATCH /users/me`: Atualiza preferências (moeda, nome, foto).

### 3.3 TransactionsModule
Coração financeiro do sistema.
- **Rotas:**
  - `GET /transactions`: Lista transações com filtros (data, categoria, conta).
  - `POST /transactions`: Cria nova transação (atualiza saldo da conta automaticamente).
  - `PATCH /transactions/:id`: Edita transação existente.
  - `DELETE /transactions/:id`: Remove transação (reverte impacto no saldo).

### 3.4 CategoriesModule
Gerencia a classificação de gastos e orçamentos.
- **Rotas:**
  - `GET /categories`: Lista categorias do usuário + categorias padrão.
  - `POST /categories`: Cria categoria personalizada com meta de orçamento.
  - `GET /categories/stats`: Retorna uso do orçamento por categoria.

### 3.5 AccountsModule
Controle de saldos e limites.
- **Rotas:**
  - `GET /accounts`: Lista todas as contas e cartões.
  - `POST /accounts`: Adiciona nova conta (Corrente, Poupança, Investimento, Crédito).
  - `GET /accounts/:id/statement`: Extrato específico da conta.

### 3.6 GoalsModule
Planejamento de futuro.
- **Rotas:**
  - `GET /goals`: Lista metas e progresso percentual.
  - `POST /goals`: Cria novo objetivo.
  - `POST /goals/:id/deposit`: Registra um aporte específico para a meta.

### 3.7 RemindersModule
Agendamentos e recorrências.
- **Rotas:**
  - `GET /reminders`: Lista próximos vencimentos.
  - `POST /reminders`: Cria lembrete recorrente.

### 3.8 AiModule (Integração Gemini)
Encapsula a lógica de inteligência artificial, protegendo a API Key no servidor.
- **Rotas:**
  - `POST /ai/insights`: Analisa comportamento de gastos e retorna 3 insights.
  - `POST /ai/goals-strategy`: Analisa metas e sugere plano de ação baseado no fluxo de caixa real.

---

## 4. Integrações com APIs Externas

### 4.1 Firebase Admin SDK (Autenticação)
O frontend continua usando o Firebase Auth para o login social. O token gerado é enviado no header `Authorization: Bearer <token>`. O NestJS utiliza o `firebase-admin` para verificar a validade do token e extrair o `uid`.

### 4.2 Google Gemini API
A conexão com o Gemini é feita exclusivamente pelo backend no `AiService`.
- **Modelo:** `gemini-3.1-pro-preview`.
- **Segurança:** A `GEMINI_API_KEY` reside apenas nas variáveis de ambiente do servidor NestJS.

---

## 5. Fluxo de Dados e Conexões

1. **Requisição:** O Frontend React faz uma chamada para `POST /transactions`.
2. **Middleware:** O NestJS valida o token JWT/Firebase.
3. **Service:** O `TransactionsService` inicia uma transação no banco de dados.
4. **Business Logic:** O saldo da conta vinculada (`AccountId`) é atualizado no `AccountsService`.
5. **Response:** O backend retorna o objeto criado e os novos saldos.
6. **IA Sync:** Periodicamente ou sob demanda, o `AiModule` lê os dados agregados para gerar novos conselhos.

---

## 6. Segurança e Boas Práticas

- **ValidationPipe:** Uso de `class-validator` e `class-transformer` para validar todos os DTOs de entrada.
- **Interceptors:** Transformação de resposta para garantir formatos consistentes.
- **Rate Limiting:** Proteção contra força bruta em rotas críticas.
- **CORS:** Configurado para aceitar apenas o domínio do frontend.

---

## 7. Configuração do Banco de Dados (MySQL Local)

Para a conexão com o banco de dados local, utilize o seguinte formato de URL no arquivo `.env`:

```env
DATABASE_URL="mysql://usuario:senha@localhost:3306/financas_pro"
```

Certifique-se de que o serviço MySQL esteja rodando e que o banco de dados `financas_pro` tenha sido criado antes de rodar as migrações do Prisma/TypeORM.
