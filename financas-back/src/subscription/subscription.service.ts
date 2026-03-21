import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private stripe: Stripe;

  constructor(private prisma: PrismaService, private config: ConfigService) {
    this.stripe = new Stripe(this.config.getOrThrow('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-02-25.clover',
    });
  }

  /** Retorna o plano e status de trial do usuário */
  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const trialActive = user.trialEndsAt && new Date() < new Date(user.trialEndsAt);

    return {
      plan: user.plan,
      trialEndsAt: user.trialEndsAt,
      trialActive: !!trialActive,
      subscription: user.subscription
        ? {
            status: user.subscription.status,
            currentPeriodEnd: user.subscription.currentPeriodEnd,
            cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
          }
        : null,
    };
  }

  /** Cria sessão de checkout do Stripe */
  async createCheckoutSession(userId: string, priceId: string, successUrl: string, cancelUrl: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    // Cria ou reutiliza customer no Stripe
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.displayName,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: { userId },
      },
    });

    return { url: session.url };
  }

  /** Abre portal do cliente para gerenciar assinatura */
  async createPortalSession(userId: string, returnUrl: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) throw new BadRequestException('Nenhuma assinatura ativa.');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  /** Processa webhooks do Stripe */
  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.config.getOrThrow('STRIPE_WEBHOOK_SECRET');
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Webhook inválido.');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutCompleted(session);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await this.syncSubscription(sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionCanceled(sub);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handlePaymentFailed(invoice);
        break;
      }
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    // subscription_data is only a request param, not present on the response object.
    // Resolve userId via the Stripe customer instead.
    const userId = await this.getUserIdByCustomer(session.customer as string);
    if (!userId) return;

    const subscription = await this.stripe.subscriptions.retrieve(session.subscription as string);
    await this.syncSubscription(subscription, userId);
  }

  private async syncSubscription(sub: Stripe.Subscription, userIdOverride?: string) {
    const userId = userIdOverride ?? sub.metadata?.userId
      ?? (await this.getUserIdByCustomer(sub.customer as string));
    if (!userId) return;

    const priceId = sub.items.data[0]?.price.id;
    const plan = this.resolvePlan(priceId);

    // current_period_start/end were removed from the top-level Subscription type
    // in newer Stripe SDK versions — access via the first item's period.
    const item = sub.items.data[0] as any;
    const periodStart = new Date((item?.current_period_start ?? item?.period?.start ?? 0) * 1000);
    const periodEnd   = new Date((item?.current_period_end   ?? item?.period?.end   ?? 0) * 1000);

    await this.prisma.$transaction([
      this.prisma.subscription.upsert({
        where: { stripeSubscriptionId: sub.id },
        create: {
          userId,
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          status: sub.status as any,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
        update: {
          status: sub.status as any,
          stripePriceId: priceId,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { plan },
      }),
    ]);

    this.logger.log(`Subscription synced: userId=${userId}, plan=${plan}, status=${sub.status}`);
  }

  private async handleSubscriptionCanceled(sub: Stripe.Subscription) {
    const userId = sub.metadata?.userId
      ?? (await this.getUserIdByCustomer(sub.customer as string));
    if (!userId) return;

    await this.prisma.user.update({ where: { id: userId }, data: { plan: 'FREE' } });
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: { status: 'canceled' },
    });
    this.logger.log(`Subscription canceled: userId=${userId}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const userId = await this.getUserIdByCustomer(invoice.customer as string);
    if (!userId) return;
    await this.prisma.subscription.updateMany({
      where: { userId },
      data: { status: 'past_due' },
    });
  }

  private async getUserIdByCustomer(customerId: string): Promise<string | null> {
    const user = await this.prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
    return user?.id ?? null;
  }

  private resolvePlan(priceId: string): 'FREE' | 'PRO' | 'FAMILY' {
    const proPriceId = this.config.get('STRIPE_PRICE_PRO');
    const familyPriceId = this.config.get('STRIPE_PRICE_FAMILY');
    if (priceId === familyPriceId) return 'FAMILY';
    if (priceId === proPriceId) return 'PRO';
    return 'FREE';
  }
}
