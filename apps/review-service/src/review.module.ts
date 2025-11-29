import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { NatsModule } from '@app/nats/nats.module';

@Module({
  imports: [NatsModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
