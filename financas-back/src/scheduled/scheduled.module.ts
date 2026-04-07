import { Module } from '@nestjs/common';
import { ScheduledService } from './scheduled.service';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EmailModule, NotificationsModule],
  providers: [ScheduledService],
})
export class ScheduledModule {}
