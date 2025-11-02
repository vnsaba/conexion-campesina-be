import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { ProductBaseService } from '../src/product-base/product-base.service';
import { Category } from '../generated/prisma';

describe('ProductBaseService', () => {
  let service: ProductBaseService;

  const mockProductBase = {
    id: '507f1f77bcf86cd799439011',
    name: 'Tomato',
    category: Category.VERDURAS,
    offers: [],
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductBaseService],
    }).compile();

    service = module.get<ProductBaseService>(ProductBaseService);

    // prevent real DB connections
    service.$connect = jest.fn().mockResolvedValue(undefined) as any;
    service.$disconnect = jest.fn().mockResolvedValue(undefined) as any;
    // mock prisma models used by the service by defining properties
    Object.defineProperty(service, 'productBase', {
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
    Object.defineProperty(service, 'productOffer', {
      value: {
        count: jest.fn(),
      },
      writable: false,
    });
  });

  afterEach(async () => {
    await service.$disconnect();
    jest.clearAllMocks();
  });

  describe('create - name length boundaries and uniqueness', () => {
    it('should fail when name length is below minimum (1)', async () => {
      const dto = { name: 'A', category: Category.VERDURAS };
      jest.spyOn(service.productBase, 'findFirst').mockResolvedValue(null);

      await expect(service.create(dto as any)).rejects.toBeInstanceOf(
        RpcException,
      );
    });

    it('should succeed when name length equals minimum (2)', async () => {
      const dto = { name: 'AB', category: Category.VERDURAS };
      jest.spyOn(service.productBase, 'findFirst').mockResolvedValue(null);
      jest
        .spyOn(service.productBase, 'create')
        .mockResolvedValue({ ...mockProductBase, name: dto.name });

      const result = await service.create(dto as any);
      expect(result.name).toBe(dto.name);
    });

    it('should succeed when name length is above minimum (3)', async () => {
      const dto = { name: 'ABC', category: Category.VERDURAS };
      jest.spyOn(service.productBase, 'findFirst').mockResolvedValue(null);
      jest
        .spyOn(service.productBase, 'create')
        .mockResolvedValue({ ...mockProductBase, name: dto.name });

      const result = await service.create(dto as any);
      expect(result.name).toBe(dto.name);
    });

    it('should fail when product base name already exists', async () => {
      const dto = {
        name: mockProductBase.name,
        category: mockProductBase.category,
      };
      jest
        .spyOn(service.productBase, 'findFirst')
        .mockResolvedValue(mockProductBase);

      await expect(service.create(dto as any)).rejects.toBeInstanceOf(
        RpcException,
      );
    });
  });

  describe('findAll', () => {
    it('should return product bases', async () => {
      jest
        .spyOn(service.productBase, 'findMany')
        .mockResolvedValue([mockProductBase]);
      const result = await service.findAll();
      expect(result).toEqual([mockProductBase]);
    });

    it('should throw on DB error', async () => {
      jest
        .spyOn(service.productBase, 'findMany')
        .mockRejectedValue(new Error('DB error'));
      await expect(service.findAll()).rejects.toBeInstanceOf(RpcException);
    });
  });

  describe('findOne', () => {
    it('should return product base by id', async () => {
      jest
        .spyOn(service.productBase, 'findUnique')
        .mockResolvedValue(mockProductBase);
      const res = await service.findOne(mockProductBase.id);
      expect(res).toEqual(mockProductBase);
    });

    it('should fail when not found', async () => {
      jest.spyOn(service.productBase, 'findUnique').mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toBeInstanceOf(
        RpcException,
      );
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated' };

    it('should update successfully', async () => {
      jest.spyOn(service, 'findOne' as any).mockResolvedValue(mockProductBase);
      jest
        .spyOn(service.productBase, 'update')
        .mockResolvedValue({ ...mockProductBase, ...updateDto });
      const res = await service.update(mockProductBase.id, updateDto as any);
      expect(res.name).toBe(updateDto.name);
    });

    it('should fail when no fields provided', async () => {
      await expect(
        service.update(mockProductBase.id, {} as any),
      ).rejects.toBeInstanceOf(RpcException);
    });
  });

  describe('remove', () => {
    it('should delete when no offers exist', async () => {
      jest.spyOn(service, 'findOne' as any).mockResolvedValue(mockProductBase);
      jest.spyOn(service.productOffer, 'count').mockResolvedValue(0);
      jest
        .spyOn(service.productBase, 'delete')
        .mockResolvedValue(mockProductBase);
      const res = await service.remove(mockProductBase.id);
      expect(res).toEqual({
        message: 'ProductBase deleted successfully',
        id: mockProductBase.id,
      });
    });

    it('should fail when offers exist', async () => {
      jest.spyOn(service, 'findOne' as any).mockResolvedValue(mockProductBase);
      jest.spyOn(service.productOffer, 'count').mockResolvedValue(5);
      await expect(service.remove(mockProductBase.id)).rejects.toBeInstanceOf(
        RpcException,
      );
    });
  });
});
