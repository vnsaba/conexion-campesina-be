import { Test, TestingModule } from '@nestjs/testing';
import { ClientGatewayController } from './client-gateway.controller';
import { ClientGatewayService } from './client-gateway.service';

describe('ClientGatewayController', () => {
  let clientGatewayController: ClientGatewayController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ClientGatewayController],
      providers: [ClientGatewayService],
    }).compile();

    clientGatewayController = app.get<ClientGatewayController>(ClientGatewayController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(clientGatewayController.getHello()).toBe('Hello World!');
    });
  });
});
