import { Module } from '@nestjs/common';
import { ClientGatewayController } from './client-gateway.controller';
import { ClientGatewayService } from './client-gateway.service';

@Module({
  imports: [],
  controllers: [ClientGatewayController],
  providers: [ClientGatewayService],
})
export class ClientGatewayModule {}
