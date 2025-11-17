import { Module } from '@nestjs/common';
import { NatsModule } from '@app/nats';
import { ReviewController } from './review.controller';

@Module({
  imports: [NatsModule],
  controllers: [ReviewController],
})
export class ReviewModule {}
