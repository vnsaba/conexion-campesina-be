import { Controller, Get } from '@nestjs/common';
import { ClientGatewayService } from './client-gateway.service';

@Controller()
export class ClientGatewayController {
  constructor(private readonly clientGatewayService: ClientGatewayService) {}

  @Get()
  getHello(): string {
    return this.clientGatewayService.getHello();
  }
}
