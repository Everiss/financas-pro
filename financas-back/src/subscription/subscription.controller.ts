import {
  Controller, Post, Get, Body, Headers, RawBodyRequest,
  Request, UseGuards, Req,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ConfigService } from '@nestjs/config';

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private subscriptionService: SubscriptionService,
    private config: ConfigService,
  ) {}

  /** Status do plano atual */
  @UseGuards(FirebaseAuthGuard)
  @Get('status')
  getStatus(@Request() req: any) {
    return this.subscriptionService.getStatus(req.user.id);
  }

  /** Inicia checkout no Stripe */
  @UseGuards(FirebaseAuthGuard)
  @Post('checkout')
  createCheckout(
    @Request() req: any,
    @Body() body: { priceId: string },
  ) {
    const base = this.config.get('FRONTEND_URL') ?? 'http://localhost';
    return this.subscriptionService.createCheckoutSession(
      req.user.id,
      body.priceId,
      `${base}/?checkout=success`,
      `${base}/?checkout=canceled`,
    );
  }

  /** Portal de gerenciamento da assinatura */
  @UseGuards(FirebaseAuthGuard)
  @Post('portal')
  createPortal(@Request() req: any) {
    const base = this.config.get('FRONTEND_URL') ?? 'http://localhost';
    return this.subscriptionService.createPortalSession(req.user.id, base);
  }

  /** Webhook do Stripe — sem autenticação Firebase, usa assinatura Stripe */
  @Post('webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    return this.subscriptionService.handleWebhook(req.rawBody!, sig);
  }
}
