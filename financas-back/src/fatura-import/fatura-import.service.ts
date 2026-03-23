import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmImportDto } from './dto/confirm-import.dto';

export interface ExtractedItem {
  date: string;        // YYYY-MM-DD
  description: string;
  amount: number;
}

export interface ReconciliationItem {
  extracted: ExtractedItem;
  matchId: string | null;
  matchDescription: string | null;
  matchDate: string | null;
  matchAmount: number | null;
  confidence: 'exact' | 'fuzzy' | 'none';
}

@Injectable()
export class FaturaImportService {
  private client: Anthropic;
  private model: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.client = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') });
    this.model = this.config.get('ANTHROPIC_MODEL') ?? 'claude-opus-4-5-20251101';
  }

  // ── File parsing ────────────────────────────────────────────────────────────

  async processFile(
    fileBuffer: Buffer,
    mimetype: string,
    accountId: string,
    userId: string,
  ): Promise<ReconciliationItem[]> {
    const isPdf = mimetype.includes('pdf');
    const isExcel =
      mimetype.includes('spreadsheet') ||
      mimetype.includes('excel') ||
      mimetype.includes('csv') ||
      mimetype.includes('text/plain');

    if (!isPdf && !isExcel) {
      throw new BadRequestException('Formato não suportado. Envie PDF, Excel (.xlsx/.xls) ou CSV.');
    }

    let text: string;

    if (isPdf) {
      // Use Claude's native PDF support for best extraction quality
      text = await this.extractTextFromPdfViaAI(fileBuffer);
    } else {
      text = this.extractTextFromExcel(fileBuffer);
    }

    if (!text || text.trim().length < 20) {
      throw new BadRequestException('Não foi possível extrair texto do arquivo. Verifique se o arquivo não está corrompido ou protegido por senha.');
    }

    const extracted = await this.extractTransactions(text);

    if (extracted.length === 0) {
      throw new BadRequestException('Nenhuma transação encontrada no arquivo. Verifique se é uma fatura de cartão de crédito válida.');
    }

    return this.matchWithExisting(extracted, accountId, userId);
  }

  private async extractTextFromPdfViaAI(buffer: Buffer): Promise<string> {
    const base64 = buffer.toString('base64');

    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            } as any,
            {
              type: 'text',
              text: 'Extraia e transcreva todo o conteúdo textual desta fatura de cartão de crédito. Preserve datas, valores e descrições das transações. Não interprete, apenas transcreva.',
            },
          ],
        },
      ],
    });

    return (msg.content[0] as any).text ?? '';
  }

  private extractTextFromExcel(buffer: Buffer): string {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const lines: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      lines.push(XLSX.utils.sheet_to_csv(ws, { forceQuotes: false }));
    }
    return lines.join('\n');
  }

  // ── AI transaction extraction ────────────────────────────────────────────────

  private async extractTransactions(text: string): Promise<ExtractedItem[]> {
    const prompt = `Você é um extrator especializado em faturas de cartão de crédito brasileiras.

Analise o texto abaixo e extraia TODAS as transações de compra/gasto.

Regras:
- Retorne APENAS transações individuais (compras, saques, tarifas)
- IGNORE: totais, subtotais, saldo devedor, encargos de juros, linhas de cabeçalho
- Para compras parceladas, inclua APENAS a parcela listada (não desmembre)
- Valores sempre positivos, em decimal com ponto (ex: 123.45)
- Data no formato YYYY-MM-DD
- Se o ano não estiver explícito, use ${new Date().getFullYear()}

Retorne APENAS JSON válido, sem texto antes ou depois:
[
  {"date": "YYYY-MM-DD", "description": "NOME ESTABELECIMENTO", "amount": 0.00}
]

Texto da fatura:
---
${text.slice(0, 14000)}
---`;

    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (msg.content[0] as any).text ?? '[]';
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    try {
      const parsed = JSON.parse(jsonMatch[0]) as any[];
      return parsed
        .filter(
          (i) =>
            i.date && typeof i.description === 'string' && typeof i.amount === 'number' && i.amount > 0,
        )
        .map((i) => ({
          date: String(i.date).slice(0, 10),
          description: String(i.description).trim(),
          amount: Number(i.amount),
        }));
    } catch {
      return [];
    }
  }

  // ── Matching ─────────────────────────────────────────────────────────────────

  private async matchWithExisting(
    items: ExtractedItem[],
    accountId: string,
    userId: string,
  ): Promise<ReconciliationItem[]> {
    const dates = items.map((i) => new Date(i.date + 'T12:00:00Z'));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    minDate.setDate(minDate.getDate() - 5);
    maxDate.setDate(maxDate.getDate() + 5);

    const existing = await this.prisma.transaction.findMany({
      where: { userId, accountId, date: { gte: minDate, lte: maxDate } },
    });

    return items.map((item) => {
      const itemDate = new Date(item.date + 'T12:00:00Z');

      // Exact: same amount (±0.01) within the same day
      let match = existing.find((t) => {
        const tDate = new Date(t.date);
        const dayDiff = Math.abs(tDate.getTime() - itemDate.getTime()) / 86400000;
        return dayDiff < 1 && Math.abs(Number(t.amount) - item.amount) < 0.02;
      });
      if (match) {
        return this.buildResult(item, match, 'exact');
      }

      // Fuzzy: same amount within 3 days
      match = existing.find((t) => {
        const tDate = new Date(t.date);
        const dayDiff = Math.abs(tDate.getTime() - itemDate.getTime()) / 86400000;
        return dayDiff <= 3 && Math.abs(Number(t.amount) - item.amount) < 0.02;
      });
      if (match) {
        return this.buildResult(item, match, 'fuzzy');
      }

      return { extracted: item, matchId: null, matchDescription: null, matchDate: null, matchAmount: null, confidence: 'none' };
    });
  }

  private buildResult(item: ExtractedItem, match: any, confidence: 'exact' | 'fuzzy'): ReconciliationItem {
    return {
      extracted: item,
      matchId: match.id,
      matchDescription: match.description,
      matchDate: new Date(match.date).toISOString().slice(0, 10),
      matchAmount: Number(match.amount),
      confidence,
    };
  }

  // ── Confirm ──────────────────────────────────────────────────────────────────

  async confirm(userId: string, dto: ConfirmImportDto) {
    const results = { linked: 0, created: 0, skipped: 0 };

    for (const item of dto.items) {
      if (item.action === 'skip') {
        results.skipped++;
        continue;
      }

      if (item.action === 'link') {
        // Transaction already exists; nothing to do (could add a reconciled flag later)
        results.linked++;
        continue;
      }

      if (item.action === 'create') {
        await (this.prisma.transaction as any).create({
          data: {
            amount: item.extracted.amount,
            type: 'expense',
            date: new Date(item.extracted.date + 'T12:00:00Z'),
            description: item.extracted.description,
            accountId: dto.accountId,
            categoryId: item.categoryId ?? null,
            userId,
            paymentMethod: 'credit',
          },
        });

        // Debit the credit card balance (increase debt)
        await this.prisma.bankAccount.update({
          where: { id: dto.accountId },
          data: { balance: { increment: item.extracted.amount } },
        });

        results.created++;
      }
    }

    return results;
  }
}
