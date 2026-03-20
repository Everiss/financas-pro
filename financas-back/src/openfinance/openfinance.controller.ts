import { Controller, Get, Post, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { OpenFinanceService } from './openfinance.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { PlanGuard, RequireFeature } from '../subscription/plan.guard';

@UseGuards(FirebaseAuthGuard, PlanGuard)
@RequireFeature('openFinance')
@Controller('openfinance')
export class OpenFinanceController {
  constructor(private openFinance: OpenFinanceService) {}

  /** Gera o token para abrir o widget Pluggy Connect no frontend */
  @Post('connect-token')
  async connectToken(@Request() req: any) {
    const connectToken = await this.openFinance.createConnectToken(req.user.id);
    return { connectToken };
  }

  /** Lista bancos/conectores disponíveis */
  @Get('connectors')
  getConnectors(@Query('search') search?: string) {
    return this.openFinance.getConnectors(search);
  }

  /** Retorna detalhes de uma conexão bancária (item) */
  @Get('items/:itemId')
  getItem(@Param('itemId') itemId: string) {
    return this.openFinance.getItem(itemId);
  }

  /** Retorna contas de um item conectado */
  @Get('accounts')
  async getAccounts(@Query('itemId') itemId: string): Promise<unknown[]> {
    return this.openFinance.getAccounts(itemId);
  }

  /** Cria um item diretamente (sandbox / conexão manual) */
  @Post('items')
  createItem(@Body() body: { connectorId: number; parameters: Record<string, string> }) {
    return this.openFinance.createItem(body.connectorId, body.parameters);
  }

  /** Aguarda item terminar de sincronizar e retorna status final */
  @Get('items/:itemId/wait')
  waitForItem(@Param('itemId') itemId: string) {
    return this.openFinance.waitForItem(itemId);
  }

  /** Retorna transações de uma conta conectada */
  @Get('transactions')
  async getTransactions(
    @Query('accountId') accountId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<unknown[]> {
    return this.openFinance.getTransactions(accountId, from, to);
  }
}
