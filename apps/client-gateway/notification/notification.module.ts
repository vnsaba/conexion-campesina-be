import { Module } from '@nestjs/common';
import { NatsModule } from '@app/nats';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [NatsModule],
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationModule {}
