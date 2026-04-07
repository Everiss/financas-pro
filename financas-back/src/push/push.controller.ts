import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { PushService } from './push.service';

class SubscribeDto {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

class UnsubscribeDto {
  endpoint: string;
}

@ApiTags('push')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('push')
export class PushController {
  constructor(private push: PushService) {}

  @Get('public-key')
  @ApiOperation({ summary: 'Retorna a VAPID public key para o frontend' })
  getPublicKey() {
    return { publicKey: this.push.getPublicKey() };
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Registra ou atualiza uma push subscription' })
  async subscribe(@Req() req: any, @Body() body: SubscribeDto) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.push.subscribe(req.user.uid, body, userAgent);
  }

  @Delete('subscribe')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove uma push subscription' })
  async unsubscribe(@Req() req: any, @Body() body: UnsubscribeDto) {
    return this.push.unsubscribe(req.user.uid, body.endpoint);
  }
}
