import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    const publicKey  = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject    = this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:admin@financas-pro.app';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.enabled = true;
      this.logger.log('Web Push inicializado com VAPID keys.');
    } else {
      this.logger.warn('VAPID keys não configuradas — push notifications desativadas.');
    }
  }

  getPublicKey(): string | null {
    return this.config.get<string>('VAPID_PUBLIC_KEY') ?? null;
  }

  async subscribe(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string,
  ) {
    // Upsert baseado no endpoint (um dispositivo por endpoint)
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT id FROM `push_subscriptions` WHERE `user_id` = ? AND `endpoint` = ? LIMIT 1',
      userId,
      subscription.endpoint,
    );

    if (existing.length > 0) {
      // Atualiza auth/p256dh (podem ter rotacionado)
      await this.prisma.$executeRawUnsafe(
        'UPDATE `push_subscriptions` SET `p256dh` = ?, `auth` = ? WHERE `id` = ?',
        subscription.keys.p256dh,
        subscription.keys.auth,
        existing[0].id,
      );
      return { id: existing[0].id };
    }

    const id = require('crypto').randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO \`push_subscriptions\` (id, user_id, endpoint, p256dh, auth, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      id,
      userId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
      userAgent ?? null,
    );
    return { id };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.$executeRawUnsafe(
      'DELETE FROM `push_subscriptions` WHERE `user_id` = ? AND `endpoint` = ?',
      userId,
      endpoint,
    );
    return { ok: true };
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;

    const subs = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM `push_subscriptions` WHERE `user_id` = ?',
      userId,
    );

    const staleIds: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
          );
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription expired/gone — remove it
            staleIds.push(sub.id);
          } else {
            this.logger.warn(`Push falhou para sub ${sub.id}: ${err.message}`);
          }
        }
      }),
    );

    if (staleIds.length > 0) {
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM \`push_subscriptions\` WHERE id IN (${staleIds.map(() => '?').join(',')})`,
        ...staleIds,
      );
    }
  }

  async sendToMany(userIds: string[], payload: PushPayload): Promise<void> {
    await Promise.allSettled(userIds.map((id) => this.sendToUser(id, payload)));
  }
}
