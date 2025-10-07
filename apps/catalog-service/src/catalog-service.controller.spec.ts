import { Test, TestingModule } from '@nestjs/testing';
import { CatalogServiceController } from './catalog-service.controller';
import { CatalogServiceService } from './catalog-service.service';

describe('CatalogServiceController', () => {
  let catalogServiceController: CatalogServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [CatalogServiceController],
      providers: [CatalogServiceService],
    }).compile();

    catalogServiceController = app.get<CatalogServiceController>(CatalogServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(catalogServiceController.getHello()).toBe('Hello World!');
    });
  });
});
