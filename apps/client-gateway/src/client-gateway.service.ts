import { Injectable } from '@nestjs/common';

@Injectable()
export class ClientGatewayService {
  getHello(): string {
    return 'Hello World!';
  }
}
