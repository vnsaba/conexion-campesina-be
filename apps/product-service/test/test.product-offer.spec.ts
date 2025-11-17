import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { ProductOfferService } from '../src/product-offer/product-offer.service';
import { Category, Unit } from '../generated/prisma';
import { CreateProductOfferDto } from '../src/product-offer/dto/create-product-offer.dto';

describe('ProductOfferService', () => {
  let service: ProductOfferService;

  const mockProductBase = {
    id: '507f1f77bcf86cd799439011',
    name: 'Tomato',
    category: Category.VERDURAS,
  };

  const mockProductOffer = {
    id: '507f1f77bcf86cd799439012',
    productBaseId: '507f1f77bcf86cd799439011',
    producerId: 'producer123',
    name: 'Organic Tomatoes',
    description: 'Fresh organic tomatoes from local farm',
    price: 5000,
    imageUrl: 'https://example.com/tomato.jpg',
    unit: Unit.KILOGRAMO,
    quantity: 50,
    isAvailable: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    productBase: mockProductBase,
  };

  const createDto = {
    productBaseId: '507f1f77bcf86cd799439011',
    producerId: 'producer123',
    name: 'Organic Tomatoes',
    description: 'Fresh organic tomatoes from local farm',
    price: 5000,
    imageUrl: 'https://example.com/tomato.jpg',
    unit: Unit.KILOGRAMO,
    quantity: 50,
    isAvailable: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductOfferService],
    }).compile();

    service = module.get<ProductOfferService>(ProductOfferService);

    Object.defineProperty(service, 'logger', {
      value: {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      },
      writable: false,
    });

    // Mock prisma models
    Object.defineProperty(service, 'productOffer', {
      value: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      writable: false,
    });

    Object.defineProperty(service, 'productBase', {
      value: {
        findUnique: jest.fn(),
      },
      writable: false,
    });

    service.$connect = jest.fn().mockResolvedValue(undefined);
    service.$disconnect = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await service.$disconnect();
    jest.clearAllMocks();
  });

  describe('create - price boundaries', () => {
    it('should fail when price is 0 (below minimum)', async () => {
      const dto = { ...createDto, price: 0 };
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockRejectedValue(
        new Error('Price validation failed'),
      );

      await expect(
        service.create(dto as CreateProductOfferDto, dto.producerId),
      ).rejects.toBeInstanceOf(RpcException);
    });

    it('should succeed when price is 1 (minimum boundary)', async () => {
      const dto = { ...createDto, price: 1 };
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockResolvedValue({
        ...mockProductOffer,
        price: 1,
      });

      const result = await service.create(
        dto as CreateProductOfferDto,
        dto.producerId,
      );
      expect(result.price).toBe(1);
    });

    it('should succeed when price is within boundaries (5000)', async () => {
      const dto = { ...createDto, price: 5000 };
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockResolvedValue({
        ...mockProductOffer,
        price: 5000,
      });

      const result = await service.create(
        dto as CreateProductOfferDto,
        dto.producerId,
      );
      expect(result.price).toBe(5000);
    });
  });

  describe('create - quantity boundaries', () => {
    it('should fail when quantity is 0 (below minimum)', async () => {
      const dto = { ...createDto, quantity: 0 };
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockRejectedValue(
        new Error('Quantity validation failed'),
      );

      await expect(
        service.create(dto as CreateProductOfferDto, dto.producerId),
      ).rejects.toBeInstanceOf(RpcException);
    });

    it('should succeed when quantity is 1 (minimum boundary)', async () => {
      const dto = { ...createDto, quantity: 1 };
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockResolvedValue({
        ...mockProductOffer,
        quantity: 1,
      });

      const result = await service.create(
        dto as CreateProductOfferDto,
        dto.producerId,
      );
      expect(result.quantity).toBe(1);
    });

    it('should succeed when quantity is within boundaries (50)', async () => {
      const dto = { ...createDto, quantity: 50 };
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockResolvedValue({
        ...mockProductOffer,
        quantity: 50,
      });

      const result = await service.create(
        dto as CreateProductOfferDto,
        dto.producerId,
      );
      expect(result.quantity).toBe(50);
    });
  });

  describe('create - ProductBase relationship', () => {
    it('should succeed when ProductBase exists', async () => {
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockResolvedValue(
        mockProductOffer,
      );

      const result = await service.create(
        createDto as CreateProductOfferDto,
        createDto.producerId,
      );
      expect(result).toEqual(mockProductOffer);
      expect(result.productBase).toBeDefined();
    });

    it('should fail when ProductBase does not exist', async () => {
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create(
          createDto as CreateProductOfferDto,
          createDto.producerId,
        ),
      ).rejects.toBeInstanceOf(RpcException);
      await expect(
        service.create(
          createDto as CreateProductOfferDto,
          createDto.producerId,
        ),
      ).rejects.toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining('ProductBase'),
        }),
      });
    });
  });

  describe('create - Unit enum validation', () => {
    it('should succeed with valid Unit enum value (KILOGRAMO)', async () => {
      const dto = { ...createDto, unit: Unit.KILOGRAMO };
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockResolvedValue({
        ...mockProductOffer,
        unit: Unit.KILOGRAMO,
      });

      const result = await service.create(
        dto as CreateProductOfferDto,
        dto.producerId,
      );
      expect(result.unit).toBe(Unit.KILOGRAMO);
    });

    it('should succeed with different valid Unit enum values', async () => {
      const units = [Unit.KILOGRAMO, Unit.GRAMO, Unit.LIBRA, Unit.UNIDAD];
      
      for (const unit of units) {
        const dto = { ...createDto, unit };
        (service.productBase.findUnique as jest.Mock).mockResolvedValue(
          mockProductBase,
        );
        (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
        (service.productOffer.create as jest.Mock).mockResolvedValue({
          ...mockProductOffer,
          unit,
        });

        const result = await service.create(
          dto as CreateProductOfferDto,
          dto.producerId,
        );
        expect(result.unit).toBe(unit);
      }
    });
  });

  describe('create - multiple offers for same ProductBase', () => {
    it('should succeed creating multiple offers for same ProductBase', async () => {
      const offer1 = {
        ...createDto,
        name: 'Offer 1',
        producerId: 'producer1',
      };
      const offer2 = {
        ...createDto,
        name: 'Offer 2',
        producerId: 'producer2',
      };

      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock)
        .mockResolvedValueOnce({ ...mockProductOffer, ...offer1 })
        .mockResolvedValueOnce({ ...mockProductOffer, ...offer2 });

      const result1 = await service.create(
        offer1 as CreateProductOfferDto,
        offer1.producerId,
      );
      const result2 = await service.create(
        offer2 as CreateProductOfferDto,
        offer2.producerId,
      );

      expect(result1.productBaseId).toBe(result2.productBaseId);
      expect(result1.producerId).not.toBe(result2.producerId);
    });

    it('should fail when same producer creates duplicate offer', async () => {
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(
        mockProductOffer,
      );

      await expect(
        service.create(
          createDto as CreateProductOfferDto,
          createDto.producerId,
        ),
      ).rejects.toBeInstanceOf(RpcException);
      await expect(
        service.create(
          createDto as CreateProductOfferDto,
          createDto.producerId,
        ),
      ).rejects.toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining('already exists'),
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all product offers', async () => {
      const mockOffers = [mockProductOffer];
      (service.productOffer.findMany as jest.Mock).mockResolvedValue(
        mockOffers,
      );

      const result = await service.findAll();
      expect(result).toEqual(mockOffers);
    });

    it('should fail on database error', async () => {
      (service.productOffer.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.findAll()).rejects.toBeInstanceOf(RpcException);
    });
  });

  describe('findOne', () => {
    it('should return product offer by id', async () => {
      (service.productOffer.findUnique as jest.Mock).mockResolvedValue(
        mockProductOffer,
      );

      const result = await service.findOne(mockProductOffer.id);
      expect(result).toEqual(mockProductOffer);
    });

    it('should fail when product offer not found', async () => {
      (service.productOffer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toBeInstanceOf(
        RpcException,
      );
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Tomatoes',
      price: 6000,
    };

    it('should update successfully', async () => {
      (service.productOffer.findUnique as jest.Mock).mockResolvedValue(
        mockProductOffer,
      );
      (service.productOffer.update as jest.Mock).mockResolvedValue({
        ...mockProductOffer,
        ...updateDto,
      });

      const result = await service.update(mockProductOffer.id, updateDto);
      expect(result.name).toBe(updateDto.name);
      expect(result.price).toBe(updateDto.price);
    });

    it('should update unit successfully', async () => {
      const updateDto = {
        unit: Unit.GRAMO,
      };
      (service.productOffer.findUnique as jest.Mock).mockResolvedValue(
        mockProductOffer,
      );
      (service.productOffer.update as jest.Mock).mockResolvedValue({
        ...mockProductOffer,
        ...updateDto,
      });

      const result = await service.update(mockProductOffer.id, updateDto);
      expect(result.unit).toBe(Unit.GRAMO);
    });

    it('should fail when no fields provided', async () => {
      await expect(
        service.update(mockProductOffer.id, {} as any),
      ).rejects.toBeInstanceOf(RpcException);
    });
  });

  describe('remove', () => {
    it('should delete successfully', async () => {
      (service.productOffer.findUnique as jest.Mock).mockResolvedValue(
        mockProductOffer,
      );
      (service.productOffer.delete as jest.Mock).mockResolvedValue(
        mockProductOffer,
      );

      const result = await service.remove(mockProductOffer.id);
      expect(result).toEqual({
        message: 'ProductOffer deleted successfully',
        id: mockProductOffer.id,
      });
    });

    it('should fail when product offer not found', async () => {
      (service.productOffer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toBeInstanceOf(
        RpcException,
      );
    });
  });

  describe('findAllProduct', () => {
    it('should return all product offers for a producer', async () => {
      const producerId = 'producer123';
      const mockOffers = [mockProductOffer];
      (service.productOffer.findMany as jest.Mock).mockResolvedValue(
        mockOffers,
      );

      const result = await service.findAllProduct(producerId);
      expect(result).toEqual(mockOffers);
      expect(service.productOffer.findMany).toHaveBeenCalledWith({
        where: { producerId },
        include: { productBase: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw RpcException on database error', async () => {
      const producerId = 'producer123';
      (service.productOffer.findMany as jest.Mock).mockRejectedValue(
        new Error('DB error'),
      );

      await expect(service.findAllProduct(producerId)).rejects.toBeInstanceOf(
        RpcException,
      );
    });
  });
});