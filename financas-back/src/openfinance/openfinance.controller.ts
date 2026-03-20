import { Controller, Get, Post, Query, Param, UseGuards, Request } from '@nestjs/common';
import { OpenFinanceService } from './openfinance.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';

@UseGuards(FirebaseAuthGuard)
@Controller('openfinance')
export class OpenFinanceController {
  constructor(private openFinance: OpenFinanceService) {}

  /** Gera o token para abrir o widget Pluggy Connect no frontend */
  @Post('connect-token')
  async connectToken(@Request() req: any) {
    const accessToken = await this.openFinance.createConnectToken(req.user.id);
    return { accessToken };
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
