import { Module } from '@nestjs/common';
import { ScheduledService } from './scheduled.service';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [EmailModule, NotificationsModule, PushModule],
  providers: [ScheduledService],
})
export class ScheduledModule {}
