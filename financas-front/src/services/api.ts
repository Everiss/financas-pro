import { auth } from '../firebase';

const API_URL = 'http://localhost:5000/api';

// --- Token helper ---

async function getToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado.');
  return user.getIdToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message ?? 'Erro na requisição.');
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;
  return response.json();
}

// --- Users ---

export const usersApi = {
  getMe: () => request<UserResponse>('/users/me'),
  updateMe: (data: UpdateUserPayload) =>
    request<UserResponse>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
};

// --- Transactions ---

export const transactionsApi = {
  getAll: (params?: TransactionQuery) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<TransactionResponse[]>(`/transactions${qs}`);
  },
  create: (data: CreateTransactionPayload) =>
    request<TransactionResponse>('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateTransactionPayload>) =>
    request<TransactionResponse>(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/transactions/${id}`, { method: 'DELETE' }),
};

// --- Categories ---

export const categoriesApi = {
  getAll: () => request<CategoryResponse[]>('/categories'),
  getStats: (month: string) => request<CategoryStatsResponse[]>(`/categories/stats?month=${month}`),
  create: (data: CreateCategoryPayload) =>
    request<CategoryResponse>('/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateCategoryPayload>) =>
    request<CategoryResponse>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/categories/${id}`, { method: 'DELETE' }),
};

// --- Banks ---

export const banksApi = {
  getAll: () => request<BankResponse[]>('/banks'),
  create: (data: CreateBankPayload) =>
    request<BankResponse>('/banks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateBankPayload>) =>
    request<BankResponse>(`/banks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/banks/${id}`, { method: 'DELETE' }),
};

// --- Accounts ---

export const accountsApi = {
  getAll: () => request<AccountResponse[]>('/accounts'),
  create: (data: CreateAccountPayload) =>
    request<AccountResponse>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateAccountPayload>) =>
    request<AccountResponse>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/accounts/${id}`, { method: 'DELETE' }),
  getStatement: (id: string, month?: string) => {
    const qs = month ? `?month=${month}` : '';
    return request<TransactionResponse[]>(`/accounts/${id}/statement${qs}`);
  },
};

// --- Goals ---

export const goalsApi = {
  getAll: () => request<GoalResponse[]>('/goals'),
  create: (data: CreateGoalPayload) =>
    request<GoalResponse>('/goals', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateGoalPayload>) =>
    request<GoalResponse>(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deposit: (id: string, amount: number) =>
    request<GoalResponse>(`/goals/${id}/deposit`, { method: 'POST', body: JSON.stringify({ amount }) }),
  delete: (id: string) =>
    request<void>(`/goals/${id}`, { method: 'DELETE' }),
};

// --- Reminders ---

export const remindersApi = {
  getAll: () => request<ReminderResponse[]>('/reminders'),
  create: (data: CreateReminderPayload) =>
    request<ReminderResponse>('/reminders', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateReminderPayload>) =>
    request<ReminderResponse>(`/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/reminders/${id}`, { method: 'DELETE' }),
};

// --- AI ---

export const aiApi = {
  getInsights: () => request<AiInsight[]>('/ai/insights', { method: 'POST' }),
  getGoalsStrategy: () => request<AiGoalsStrategy>('/ai/goals-strategy', { method: 'POST' }),
};

// --- Open Finance (Pluggy) ---

export const openFinanceApi = {
  getConnectToken: () => request<{ connectToken: string }>('/openfinance/connect-token', { method: 'POST' }),
  getConnectors: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<{ results: PluggyConnector[] }>(`/openfinance/connectors${qs}`);
  },
  getItem: (itemId: string) => request<PluggyItem>(`/openfinance/items/${itemId}`),
  getAccounts: (itemId: string) => request<PluggyAccount[]>(`/openfinance/accounts?itemId=${itemId}`),
  getTransactions: (accountId: string, from?: string, to?: string) => {
    const qs = new URLSearchParams({ accountId, ...(from && { from }), ...(to && { to }) });
    return request<PluggyTransaction[]>(`/openfinance/transactions?${qs}`);
  },
};

export interface PluggyConnector {
  id: number;
  name: string;
  primaryColor: string;
  logoImageUrl?: string;
  institutionUrl?: string;
  country: string;
  type: string;
}

export interface PluggyItem {
  id: string;
  status: string;
  connector: { name: string; primaryColor: string; logoImageUrl: string };
  lastUpdatedAt?: string;
}

export interface PluggyAccount {
  id: string;
  name: string;
  type: string;
  subtype: string;
  number: string;
  balance: number;
  currencyCode: string;
  itemId: string;
}

export interface PluggyTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'DEBIT' | 'CREDIT';
  category?: string;
  accountId: string;
}

// --- Audit Logs ---

export const auditApi = {
  getAll: (params?: { entity?: string; action?: string; limit?: number }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<AuditLogResponse[]>(`/audit-logs${qs}`);
  },
};

export interface AuditLogResponse {
  id: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'TRANSACTION' | 'ACCOUNT' | 'BANK' | 'GOAL' | 'REMINDER' | 'CATEGORY';
  entityId?: string;
  payload?: string;
  ip?: string;
  createdAt: string;
}

// ============================================================
// Types (espelham os tipos do backend / frontend existente)
// ============================================================

export interface UserResponse {
  id: string;
  firebaseUid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  currency: string;
}

export interface UpdateUserPayload {
  displayName?: string;
  currency?: string;
  photoURL?: string;
}

export interface TransactionResponse {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  description?: string;
  date: string;
  paymentMethod?: 'debit' | 'credit';
  accountId?: string;
  categoryId?: string;
  category?: CategoryResponse;
  account?: AccountResponse;
  userId: string;
}

export interface TransactionQuery {
  startDate?: string;
  endDate?: string;
  type?: 'income' | 'expense';
  categoryId?: string;
  accountId?: string;
}

export interface CreateTransactionPayload {
  amount: number;
  type: 'income' | 'expense';
  date: string;
  description?: string;
  paymentMethod?: 'debit' | 'credit';
  accountId?: string;
  categoryId?: string;
}

export interface CategoryResponse {
  id: string;
  name: string;
  icon: string;
  color: string;
  budget?: number;
  isDefault: boolean;
  userId?: string;
}

export interface CategoryStatsResponse extends CategoryResponse {
  spent: number;
  budgetUsagePercent: number | null;
}

export interface CreateCategoryPayload {
  name: string;
  icon?: string;
  color?: string;
  budget?: number;
}

export interface BankResponse {
  id: string;
  name: string;
  color: string;
  icon: string;
  userId: string;
  accounts?: AccountResponse[];
}

export interface CreateBankPayload {
  name: string;
  color?: string;
  icon?: string;
}

export interface AccountResponse {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'investment' | 'credit';
  balance: number;
  color: string;
  icon: string;
  creditLimit?: number;
  closingDay?: number;
  dueDay?: number;
  investmentType?: 'cdb' | 'stock' | 'fund' | 'fii' | 'other';
  bankId?: string;
  bank?: BankResponse;
  userId: string;
}

export interface CreateAccountPayload {
  name: string;
  type: 'checking' | 'savings' | 'investment' | 'credit';
  balance?: number;
  color?: string;
  icon?: string;
  creditLimit?: number;
  closingDay?: number;
  dueDay?: number;
  investmentType?: 'cdb' | 'stock' | 'fund' | 'fii' | 'other';
  bankId?: string;
}

export interface GoalResponse {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  category: string;
  color?: string;
  icon?: string;
  progressPercent?: number;
  userId: string;
}

export interface CreateGoalPayload {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  deadline?: string;
  category: string;
  color?: string;
  icon?: string;
}

export interface ReminderResponse {
  id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  dueDate: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  notes?: string;
  accountId?: string;
  categoryId?: string;
  category?: CategoryResponse;
  account?: AccountResponse;
  userId: string;
}

export interface CreateReminderPayload {
  title: string;
  amount: number;
  type: 'income' | 'expense';
  dueDate: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  notes?: string;
  accountId?: string;
  categoryId?: string;
}

export interface AiInsight {
  title: string;
  description: string;
  type: 'warning' | 'success' | 'tip';
}

export interface AiGoalsStrategy {
  summary: string;
  advice: Array<{
    goalName: string;
    strategy: string;
    feasibility: 'Alta' | 'Média' | 'Baixa';
    estimatedTime: string;
    monthlySavingNeeded: string;
  }>;
}
