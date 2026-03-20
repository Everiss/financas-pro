import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PLUGGY_BASE = 'https://api.pluggy.ai';

interface PluggyApiKey {
  apiKey: string;
}

interface ConnectTokenResponse {
  connectToken: string;
}

interface PluggyAccount {
  id: string;
  name: string;
  type: string;
  subtype: string;
  number: string;
  balance: number;
  currencyCode: string;
  itemId: string;
}

interface PluggyTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'DEBIT' | 'CREDIT';
  category?: string;
  accountId: string;
}

@Injectable()
export class OpenFinanceService {
  private readonly logger = new Logger(OpenFinanceService.name);
  private cachedApiKey: string | null = null;
  private apiKeyExpiry: number = 0;

  constructor(private config: ConfigService) {}

  /** Obtém um apiKey válido — usa cache ou renova via /auth */
  private async getApiKey(): Promise<string> {
    const now = Date.now();

    // Se o token ainda é válido (com 60s de margem), reutiliza
    if (this.cachedApiKey && now < this.apiKeyExpiry - 60_000) {
      return this.cachedApiKey;
    }

    const clientId = this.config.get<string>('PLUGGY_CLIENT_ID');
    const clientSecret = this.config.get<string>('PLUGGY_CLIENT_SECRET');

    // Se houver clientSecret configurado, renova via /auth
    if (clientId && clientSecret) {
      const res = await fetch(`${PLUGGY_BASE}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret }),
      });

      if (!res.ok) throw new UnauthorizedException('Falha ao autenticar com Pluggy.');

      const data: PluggyApiKey = await res.json();
      this.cachedApiKey = data.apiKey;

      // Pluggy tokens duram 2h por padrão
      this.apiKeyExpiry = now + 2 * 60 * 60 * 1000;
      return this.cachedApiKey;
    }

    // Fallback: usa a PLUGGY_API_KEY configurada diretamente
    const staticKey = this.config.get<string>('PLUGGY_API_KEY');
    if (!staticKey) throw new UnauthorizedException('Pluggy não configurado.');

    this.cachedApiKey = staticKey;

    // Tenta extrair o exp do JWT para saber quando expira
    try {
      const payload = JSON.parse(Buffer.from(staticKey.split('.')[1], 'base64').toString());
      this.apiKeyExpiry = (payload.exp ?? 0) * 1000;
    } catch {
      this.apiKeyExpiry = now + 2 * 60 * 60 * 1000;
    }

    return this.cachedApiKey;
  }

  private async pluggyFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const apiKey = await this.getApiKey();
    const res = await fetch(`${PLUGGY_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
        ...options.headers,
      },
    });

    if (res.status === 401) {
      // Força renovação na próxima chamada
      this.cachedApiKey = null;
      this.apiKeyExpiry = 0;
      throw new UnauthorizedException('Sessão Pluggy expirada. Tente novamente.');
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Pluggy error ${res.status}: ${err}`);
    }

    return res.json();
  }

  /** Cria um connectToken para o widget do frontend */
  async createConnectToken(userId: string): Promise<string> {
    const data = await this.pluggyFetch<ConnectTokenResponse>('/connect_token', {
      method: 'POST',
      body: JSON.stringify({ clientUserId: userId }),
    });
    return data.connectToken;
  }

  /** Retorna as contas de um item conectado */
  async getAccounts(itemId: string): Promise<PluggyAccount[]> {
    const data = await this.pluggyFetch<{ results: PluggyAccount[] }>(`/accounts?itemId=${itemId}`);
    return data.results ?? [];
  }

  /** Retorna as transações de uma conta */
  async getTransactions(accountId: string, from?: string, to?: string): Promise<PluggyTransaction[]> {
    const params = new URLSearchParams({ accountId });
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    const data = await this.pluggyFetch<{ results: PluggyTransaction[] }>(`/transactions?${params}`);
    return data.results ?? [];
  }

  /** Retorna um item (conexão bancária) */
  async getItem(itemId: string) {
    return this.pluggyFetch<{ id: string; status: string; connector: { name: string; primaryColor: string; logoImageUrl: string } }>(`/items/${itemId}`);
  }

  /** Lista conectores disponíveis (bancos) */
  async getConnectors(search?: string) {
    const qs = search ? `?name=${encodeURIComponent(search)}` : '';
    return this.pluggyFetch<{ results: unknown[] }>(`/connectors${qs}`);
  }
}
