import { Injectable, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.config.get('FIREBASE_PROJECT_ID'),
          clientEmail: this.config.get('FIREBASE_CLIENT_EMAIL'),
          privateKey: this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  async validateFirebaseToken(token: string) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);

      let user = await this.prisma.user.findUnique({
        where: { firebaseUid: decoded.uid },
      });

      if (!user) {
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 dias de trial PRO

        user = await this.prisma.user.create({
          data: {
            firebaseUid: decoded.uid,
            email: decoded.email ?? '',
            displayName: decoded.name ?? decoded.email ?? 'Usuário',
            photoURL: decoded.picture ?? null,
            trialEndsAt,
          },
        });
      }

      return user;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }
}
