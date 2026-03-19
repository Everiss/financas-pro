# Estrutura do Banco de Dados (Firestore)

Este documento detalha a estrutura completa do banco de Dados NoSQL (Firestore) utilizado no aplicativo de Gestão Financeira.

## Visão Geral

O banco de dados é organizado de forma hierárquica, centrada no usuário. Cada usuário possui seu próprio documento de perfil e subcoleções para seus dados financeiros.

---

## Coleções e Documentos

### 1. Coleção: `users`
Armazena as informações de perfil e preferências de cada usuário.

- **Caminho:** `/users/{userId}`
- **Campos:**
  - `displayName` (string): Nome de exibição do usuário.
  - `email` (string): Endereço de e-mail.
  - `currency` (string): Moeda preferida (ex: "BRL").
  - `photoURL` (string, opcional): URL da foto de perfil.

---

### 2. Subcoleção: `transactions`
Armazena todas as movimentações financeiras (receitas e despesas).

- **Caminho:** `/users/{userId}/transactions/{transactionId}`
- **Campos:**
  - `amount` (number): Valor da transação.
  - `type` (string): Tipo da transação (`income` ou `expense`).
  - `category` (string): ID da categoria associada.
  - `date` (timestamp): Data e hora da transação.
  - `description` (string, opcional): Descrição ou observação.
  - `accountId` (string, opcional): ID da conta bancária de origem/destino.
  - `paymentMethod` (string, opcional): Método de pagamento (`debit` ou `credit`).
  - `userId` (string): ID do usuário proprietário.

---

### 3. Subcoleção: `categories`
Categorias personalizadas para organizar as transações.

- **Caminho:** `/users/{userId}/categories/{categoryId}`
- **Campos:**
  - `name` (string): Nome da categoria.
  - `icon` (string): Nome do ícone (Lucide).
  - `color` (string): Código hexadecimal da cor.
  - `budget` (number, opcional): Meta de orçamento mensal.
  - `userId` (string): ID do usuário proprietário.

---

### 4. Subcoleção: `reminders`
Lembretes de contas a pagar ou receber.

- **Caminho:** `/users/{userId}/reminders/{reminderId}`
- **Campos:**
  - `title` (string): Título do lembrete.
  - `amount` (number): Valor previsto.
  - `type` (string): Tipo (`income` ou `expense`).
  - `category` (string): ID da categoria.
  - `dueDate` (timestamp): Data do próximo vencimento.
  - `frequency` (string): Frequência (`once`, `daily`, `weekly`, `monthly`, `yearly`).
  - `accountId` (string, opcional): Conta preferencial para o pagamento.
  - `notes` (string, opcional): Observações adicionais.
  - `userId` (string): ID do usuário proprietário.

---

### 5. Subcoleção: `accounts`
Contas bancárias, carteiras e cartões de crédito.

- **Caminho:** `/users/{userId}/accounts/{accountId}`
- **Campos:**
  - `name` (string): Nome da conta/banco.
  - `type` (string): Tipo da conta (`checking`, `savings`, `investment`, `credit`).
  - `balance` (number): Saldo atual (ou fatura atual para cartões).
  - `color` (string): Cor representativa.
  - `icon` (string): Ícone representativo.
  - `creditLimit` (number, opcional): Limite total (apenas para cartões).
  - `closingDay` (number, opcional): Dia de fechamento da fatura.
  - `dueDay` (number, opcional): Dia de vencimento da fatura.
  - `investmentType` (string, opcional): Tipo de investimento (`cdb`, `stock`, `fund`, `fii`, `other`).
  - `userId` (string): ID do usuário proprietário.

---

## Regras de Segurança (Resumo)

As regras do Firestore garantem que:
1.  **Isolamento:** Usuários só podem ler e escrever em seus próprios documentos (`request.auth.uid == userId`).
2.  **Validação:** Todos os dados enviados são validados quanto ao tipo e formato antes de serem gravados.
3.  **Integridade:** Campos críticos como `userId` e `createdAt` são protegidos contra modificações não autorizadas.
4.  **Acesso Negado por Padrão:** Qualquer acesso que não corresponda a uma regra explícita é bloqueado.

---

## Interfaces TypeScript (Referência)

As interfaces abaixo são utilizadas no código para garantir a tipagem correta dos dados:

```typescript
export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: Timestamp;
  description?: string;
  accountId?: string;
  paymentMethod?: 'debit' | 'credit';
  userId: string;
}

export interface BankAccount {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'investment' | 'credit';
  balance: number;
  color: string;
  icon: string;
  userId: string;
  // ... campos opcionais
}
```
