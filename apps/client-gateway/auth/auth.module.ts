import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { NatsModule } from '@app/nats';

@Module({
  controllers: [AuthController],
  imports: [NatsModule],
})
export class AuthModule {}
