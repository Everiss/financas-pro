import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';

export interface ScannedItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
}

export interface ScannedReceipt {
  issuerName: string | null;
  issuerCnpj: string | null;
  issueDate: string | null;   // YYYY-MM-DD
  totalAmount: number;
  accessKey: string | null;
  items: ScannedItem[];
}

export interface ConfirmReceiptDto {
  issuerName:    string | null;
  issuerCnpj:    string | null;
  issueDate:     string | null;
  totalAmount:   number;
  accessKey:     string | null;
  source:        string;
  items: {
    description:  string;
    quantity:     number;
    unit:         string;
    unitPrice:    number;
    totalPrice:   number;
    categoryId:   string | null;
  }[];
  // Transaction to create
  accountId:    string;
  categoryId:   string | null;
  description:  string;
  paymentMethod: string | null;
}

@Injectable()
export class CouponScannerService {
  private client: Anthropic;
  private model: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.client = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') });
    this.model = this.config.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-20250514';
  }

  /** Analisa imagem de cupom fiscal via Claude Vision */
  async scanImage(imageBuffer: Buffer, mimeType: string, userId: string): Promise<ScannedReceipt> {
    const categories = await this.prisma.category.findMany({
      where: { OR: [{ userId }, { isDefault: true }] },
      select: { id: true, name: true },
    });

    const categoryList = categories.map(c => `${c.id}|${c.name}`).join('\n');
    const base64 = imageBuffer.toString('base64');

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType as any, data: base64 },
          },
          {
            type: 'text',
            text: `Você é especialista em cupons fiscais brasileiros (NF-e / NFC-e).
Analise este cupom fiscal com cuidado e extraia TODOS os itens e informações.

Categorias disponíveis (formato "id|nome"):
${categoryList}

Retorne APENAS um JSON válido (sem markdown), exatamente neste formato:
{
  "issuerName": "nome do estabelecimento",
  "issuerCnpj": "XX.XXX.XXX/XXXX-XX ou null",
  "issueDate": "YYYY-MM-DD ou null",
  "totalAmount": 0.00,
  "accessKey": "chave de acesso de 44 dígitos ou null",
  "items": [
    {
      "description": "nome do produto exatamente como no cupom",
      "quantity": 1.000,
      "unit": "UN",
      "unitPrice": 0.00,
      "totalPrice": 0.00,
      "suggestedCategoryId": "uuid da categoria mais adequada acima, ou null",
      "suggestedCategoryName": "nome da categoria sugerida, ou null"
    }
  ]
}

Regras:
- Extraia TODOS os itens listados, sem exceção
- quantity: número decimal com até 3 casas (ex: 1.000, 0.500, 2.000)
- unit: UN para unidade, KG para quilograma, L para litro, M para metro, etc.
- totalPrice: quantity × unitPrice (arredondado para 2 casas)
- totalAmount: total geral do cupom (campo "TOTAL" ou "VALOR TOTAL")
- Para a categoria, escolha a mais próxima da lista; prefira: Alimentação para comida, Limpeza para produtos de limpeza, Higiene para higiene pessoal
- Se não conseguir identificar algum campo, use null`,
          },
        ],
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new BadRequestException('Não foi possível interpretar o cupom fiscal.');

    const parsed = JSON.parse(jsonMatch[0]) as ScannedReceipt;
    if (!parsed.items || parsed.items.length === 0) {
      throw new BadRequestException('Nenhum item encontrado no cupom. Tente uma imagem mais nítida.');
    }

    return parsed;
  }

  /** Confirma o cupom: cria Receipt + ReceiptItems + Transaction */
  async confirm(userId: string, dto: ConfirmReceiptDto) {
    const account = await this.prisma.bankAccount.findUnique({
      where: { id: dto.accountId },
      select: { type: true },
    });
    if (!account) throw new BadRequestException('Conta não encontrada.');

    const isCredit = account.type === 'credit';
    const balanceDelta = isCredit ? dto.totalAmount : -dto.totalAmount;

    return this.prisma.$transaction(async (tx) => {
      // 1. Criar a transação principal
      const transaction = await tx.transaction.create({
        data: {
          amount:        dto.totalAmount,
          type:          'expense',
          date:          dto.issueDate ? new Date(dto.issueDate) : new Date(),
          description:   dto.description || dto.issuerName || 'Compra via cupom fiscal',
          paymentMethod: dto.paymentMethod as any ?? null,
          isPending:     false,
          userId,
          accountId:     dto.accountId,
          categoryId:    dto.categoryId ?? null,
        } as any,
        include: { category: true, account: true },
      });

      // 2. Atualizar saldo da conta
      await tx.bankAccount.update({
        where: { id: dto.accountId },
        data:  { balance: { increment: balanceDelta } },
      });

      // 3. Criar o cupom fiscal
      const receipt = await tx.receipt.create({
        data: {
          issuerName:    dto.issuerName ?? null,
          issuerCnpj:    dto.issuerCnpj ?? null,
          totalAmount:   dto.totalAmount,
          issueDate:     dto.issueDate ? new Date(dto.issueDate) : null,
          accessKey:     dto.accessKey ?? null,
          source:        dto.source ?? 'image',
          userId,
          transactionId: transaction.id,
        } as any,
      });

      // 4. Criar os itens do cupom
      if (dto.items.length > 0) {
        await tx.receiptItem.createMany({
          data: dto.items.map(item => ({
            description: item.description,
            quantity:    item.quantity,
            unit:        item.unit || 'UN',
            unitPrice:   item.unitPrice,
            totalPrice:  item.totalPrice,
            receiptId:   receipt.id,
            categoryId:  item.categoryId ?? null,
          })),
        });
      }

      return {
        transaction,
        receiptId: receipt.id,
        itemCount: dto.items.length,
      };
    });
  }

  /** Lista cupons fiscais do usuário */
  async findAll(userId: string) {
    return this.prisma.receipt.findMany({
      where: { userId },
      include: {
        items: { include: { category: true } },
        transaction: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
