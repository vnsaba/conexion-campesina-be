import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from '../src/inventory-service.service';
import { Unit } from '../generated/prisma';
import { of } from 'rxjs';
import { UnitConverterService } from '../src/UnitConverterService';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '../provider/prisma.service';

describe('InventoryService - create()', () => {
  let service: InventoryService;

  const mockInventory = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  };
  const mockNatsClient = {
    send: jest.fn(),
    emit: jest.fn(),
  };

  const mockUnitConverter = {
    convert: jest.fn(),
  };

  const mockPrisma = {
    inventory: mockInventory,

    productOffer: {
      findUnique: jest.fn(),
    },

    producer: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: 'NATS_SERVICE',
          useValue: mockNatsClient,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: UnitConverterService,
          useValue: mockUnitConverter,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);

    jest.clearAllMocks();
  });
  it('should create inventory when all validations pass', async () => {
    const producerId = 'prod-1';
    const dto = {
      productOfferId: 'offer-1',
      available_quantity: 10,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      maximum_capacity: 100,
    };

    mockNatsClient.send
      .mockReturnValueOnce(of({ id: 'prod-1' }))
      .mockReturnValueOnce(of({ id: 'offer-1' }));

    mockInventory.findFirst.mockResolvedValue(null);
    mockInventory.create.mockResolvedValue({ id: 'inv-1', ...dto });

    const result = await service.create(producerId, dto);

    expect(result).toEqual({ id: 'inv-1', ...dto });
  });

  it('should fail if producerId is empty', async () => {
    const producerId = '';
    const dto = {
      productOfferId: 'offer-1',
      available_quantity: 1,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      maximum_capacity: 10,
    };

    mockNatsClient.send.mockReturnValue(of(null)); // productor no existe

    await expect(service.create(producerId, dto)).rejects.toThrow(RpcException);
  });

  it('should fail if producer does not exist', async () => {
    const producerId = 'bad';
    const dto = {
      productOfferId: 'offer-1',
      available_quantity: 1,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      maximum_capacity: 10,
    };

    mockNatsClient.send.mockReturnValueOnce(of(null)); // productor no encontrado

    await expect(service.create(producerId, dto)).rejects.toThrow(RpcException);
  });

  it('should fail if productOfferId does not exist', async () => {
    const producerId = 'prod-1';
    const dto = {
      productOfferId: 'bad',
      available_quantity: 1,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      maximum_capacity: 10,
    };

    mockNatsClient.send
      .mockReturnValueOnce(of({ id: 'prod-1' }))
      .mockReturnValueOnce(of(null));

    await expect(service.create(producerId, dto)).rejects.toThrow(RpcException);
  });

  it('should fail if inventory already exists for the producer + productOffer', async () => {
    const producerId = 'prod-1';
    const dto = {
      productOfferId: 'offer-1',
      available_quantity: 1,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      maximum_capacity: 10,
    };

    mockNatsClient.send
      .mockReturnValueOnce(of({ id: 'prod-1' }))
      .mockReturnValueOnce(of({ id: 'offer-1' }));

    mockInventory.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(service.create(producerId, dto)).rejects.toThrow(RpcException);
  });

  it('should fail if unit is not in enum Unit', async () => {
    const producerId = 'prod-1';
    const dto: any = {
      productOfferId: 'offer-1',
      available_quantity: 1,
      unit: 'LATA',
      minimum_threshold: 0,
      maximum_capacity: 10,
    };

    mockNatsClient.send.mockReturnValue(of({ id: 'prod-1' }));
    mockNatsClient.send.mockReturnValueOnce(of({ id: 'offer-1' }));

    await expect(service.create(producerId, dto)).rejects.toThrow();
  });

  it('should fail if available_quantity is negative', async () => {
    const producerId = 'prod-1';
    const dto = {
      productOfferId: 'offer-1',
      available_quantity: -5,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      maximum_capacity: 10,
    };

    await expect(service.create(producerId, dto)).rejects.toThrow();
  });

  it('should fail if maximum_capacity is 0', async () => {
    const producerId = 'prod-1';
    const dto = {
      productOfferId: 'offer-1',
      available_quantity: 1,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      maximum_capacity: 0,
    };

    await expect(service.create(producerId, dto)).rejects.toThrow();
  });

  it('should allow available_quantity = 0', async () => {
    const producerId = 'prod-1';
    const dto = {
      productOfferId: 'offer-1',
      available_quantity: 0,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      maximum_capacity: 10,
    };

    mockNatsClient.send.mockReturnValueOnce(of({ id: 'prod-1' }));
    mockNatsClient.send.mockReturnValueOnce(of({ id: 'offer-1' }));
    mockInventory.findFirst.mockResolvedValue(null);
    mockInventory.create.mockResolvedValue({ id: 'inv', ...dto });

    const result = await service.create(producerId, dto);
    expect(result).toBeDefined();
  });

  it('should reject available_quantity = -0.01', async () => {
    const producerId = 'prod-1';
    const dto = {
      productOfferId: 'offer-1',
      available_quantity: -0.01,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      maximum_capacity: 10,
    };

    await expect(service.create(producerId, dto)).rejects.toThrow();
  });

  it('should allow maximum_capacity = 1', async () => {
    const producerId = 'prod-1';
    const dto = {
      productOfferId: 'offer-1',
      available_quantity: 1,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      maximum_capacity: 1,
    };
    mockNatsClient.send
      .mockReturnValueOnce(of({ id: 'prod-1' }))
      .mockReturnValueOnce(of({ id: 'offer-1' }));
    mockInventory.findFirst.mockResolvedValue(null);
    mockInventory.create.mockResolvedValue({ id: 'inv', ...dto });

    const result = await service.create(producerId, dto);
    expect(result).toBeDefined();
  });

  it('should reject maximum_capacity = 0.99', async () => {
    const producerId = 'prod-1';
    const dto = {
      productOfferId: 'offer-1',
      available_quantity: 5,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      maximum_capacity: 0.99,
    };

    await expect(service.create(producerId, dto)).rejects.toThrow();
  });

  it('should reserve stock when inventory and productOffer exist', async () => {
    const inventory = {
      id: 'inv-1',
      available_quantity: 20,
      unit: Unit.KILOGRAMO,
    };

    mockInventory.findFirst.mockResolvedValue(inventory);
    mockNatsClient.send.mockReturnValue(of({ unit: Unit.GRAMO }));

    mockUnitConverter.convert.mockReturnValue(5); // 5g → 5kg (ejemplo)

    await service.handleOrderPending({
      productOfferId: 'offer-1',
      quantity: 5,
    });

    expect(mockInventory.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: {
        reserved_quantity: {
          increment: 5,
        },
      },
    });
  });

  it('should do nothing if inventory does not exist', async () => {
    mockInventory.findFirst.mockResolvedValue(null);

    await service.handleOrderPending({
      productOfferId: 'offer-1',
      quantity: 5,
    });

    expect(mockInventory.update).not.toHaveBeenCalled();
  });
  it('should not reserve if available stock is insufficient', async () => {
    const inventory = {
      id: 'inv-1',
      available_quantity: 2,
      unit: Unit.KILOGRAMO,
    };
    mockInventory.findFirst.mockResolvedValue(inventory);
    mockNatsClient.send.mockReturnValue(of({ unit: Unit.KILOGRAMO }));

    mockUnitConverter.convert.mockReturnValue(5); // solicita más de lo disponible

    await service.handleOrderPending({
      productOfferId: 'offer-1',
      quantity: 5,
    });

    expect(mockInventory.update).not.toHaveBeenCalled();
  });

  it('should not reserve when quantity <= 0', async () => {
    const inventory = {
      id: 'inv-1',
      available_quantity: 20,
      unit: Unit.KILOGRAMO,
    };
    mockInventory.findFirst.mockResolvedValue(inventory);
    mockNatsClient.send.mockReturnValue(of({ unit: Unit.KILOGRAMO }));

    await service.handleOrderPending({
      productOfferId: 'offer-1',
      quantity: 0,
    });

    expect(mockInventory.update).not.toHaveBeenCalled();
  });

  it('should reduce reserved_quantity when order is cancelled', async () => {
    const inventory = {
      id: 'inv-1',
      reserved_quantity: 10,
      unit: Unit.KILOGRAMO,
    };
    mockInventory.findFirst.mockResolvedValue(inventory);
    mockNatsClient.send.mockReturnValue(of({ unit: Unit.GRAMO }));

    mockUnitConverter.convert.mockReturnValue(3);

    await service.handleOrderCancelled('offer-1', 3);

    expect(mockInventory.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: {
        reserved_quantity: { decrement: 3 },
      },
    });
  });

  it('should do nothing if inventory does not exist on cancel', async () => {
    mockInventory.findFirst.mockResolvedValue(null);

    await service.handleOrderCancelled('offer-1', 3);

    expect(mockInventory.update).not.toHaveBeenCalled();
  });

  it('should decrease stock and reserved when order is confirmed', async () => {
    const inventory = {
      id: 'inv-1',
      reserved_quantity: 10,
      available_quantity: 50,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      productOfferId: 'offer-1',
    };

    mockInventory.findFirst.mockResolvedValue(inventory);
    mockNatsClient.send.mockReturnValue(of({ unit: Unit.GRAMO }));

    mockUnitConverter.convert.mockReturnValue(5);

    mockInventory.update.mockResolvedValue({
      ...inventory,
      available_quantity: 45,
      reserved_quantity: 5,
    });

    await service.handleOrderConfirmed('offer-1', 5);

    expect(mockInventory.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: {
        reserved_quantity: { decrement: 5 },
        available_quantity: { decrement: 5 },
      },
    });

    expect(mockNatsClient.emit).toHaveBeenCalledWith(
      'product.offer.updateAvailability',
      {
        productOfferId: 'offer-1',
        available: true,
      },
    );
  });
  it('should throw internal error when stock is insufficient on confirm', async () => {
    const inventory = {
      id: 'inv-1',
      available_quantity: 2,
      unit: Unit.KILOGRAMO,
    };
    mockInventory.findFirst.mockResolvedValue(inventory);
    mockNatsClient.send.mockReturnValue(of({ unit: Unit.KILOGRAMO }));

    mockUnitConverter.convert.mockReturnValue(5);

    await service.handleOrderConfirmed('offer-1', 5);

    expect(mockInventory.update).not.toHaveBeenCalled();
  });
  it('should do nothing if inventory does not exist on confirm', async () => {
    mockInventory.findFirst.mockResolvedValue(null);

    await service.handleOrderConfirmed('offer-1', 5);

    expect(mockInventory.update).not.toHaveBeenCalled();
  });

  it('should return all inventories', async () => {
    const rows = [{ id: '1' }, { id: '2' }];
    mockInventory.findMany.mockResolvedValue(rows);

    const result = await service.findAll();

    expect(result).toBe(rows);
    expect(mockInventory.findMany).toHaveBeenCalled();
  });

  it('should handle error when findAll fails', async () => {
    mockInventory.findMany.mockRejectedValue(new Error('DB error'));

    await expect(service.findAll()).rejects.toThrow(RpcException);
  });

  it('should return inventories filtered by producer', async () => {
    const rows = [{ id: '1', producerId: 'p1' }];
    mockInventory.findMany.mockResolvedValue(rows);

    const result = await service.findByProducer('p1');

    expect(result).toBe(rows);
    expect(mockInventory.findMany).toHaveBeenCalledWith({
      where: { producerId: 'p1' },
    });
  });
  it('should handle error when findByProducer fails', async () => {
    mockInventory.findMany.mockRejectedValue(new Error('DB error'));

    await expect(service.findByProducer('p1')).rejects.toThrow(RpcException);
  });

  it('should return inventory by product offer id', async () => {
    const inv = { id: '1', productOfferId: 'offer-1' };
    mockInventory.findFirst.mockResolvedValue(inv);

    const result = await service.findByProductOffer('offer-1');

    expect(result).toBe(inv);
  });

  it('should throw notFound error if inventory does not exist in findByProductOffer', async () => {
    mockInventory.findFirst.mockResolvedValue(null);

    await expect(service.findByProductOffer('offer-1')).rejects.toThrow(
      RpcException,
    );
  });

  it('should return inventory by id', async () => {
    const inv = { id: '123' };
    mockInventory.findUnique.mockResolvedValue(inv);

    const result = await service.findOne('123');

    expect(result).toBe(inv);
  });
  it('should handle not found in findOne', async () => {
    mockInventory.findUnique.mockResolvedValue(null);

    await expect(service.findOne('abc')).rejects.toThrow(RpcException);
  });

  it('should update inventory using updateBase', async () => {
    const inv = { id: 'inv1' };
    mockInventory.findUnique.mockResolvedValue(inv);
    mockInventory.update.mockResolvedValue({ ...inv, available_quantity: 50 });

    const result = await service.updateBase('inv1', { available_quantity: 50 });

    expect(result!.available_quantity).toBe(50);
    expect(mockInventory.update).toHaveBeenCalledWith({
      where: { id: 'inv1' },
      data: { available_quantity: 50 },
    });
  });

  it('should handle error in updateBase', async () => {
    mockInventory.findUnique.mockResolvedValue({ id: 'inv1' });
    mockInventory.update.mockRejectedValue(new Error('DB error'));

    await expect(
      service.updateBase('inv1', { available_quantity: 10 }),
    ).rejects.toThrow(RpcException);
  });

  it('should call updateBase and then checkLowStock + productAvailability', async () => {
    const updated: any = {
      id: 'inv1',
      producerId: 'p1',
      productOfferId: 'offer1',
      available_quantity: 50,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      reserved_quantity: 0,
      maximum_capacity: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    jest.spyOn(service, 'updateBase').mockResolvedValue(updated);

    jest.spyOn(service as any, 'checkLowStock').mockImplementation();
    jest.spyOn(service as any, 'productAvailability').mockImplementation();

    const result = await service.update('inv1', { available_quantity: 50 });

    expect(result).toBe(updated);
    expect((service as any).checkLowStock).toHaveBeenCalledWith(updated);
    expect((service as any).productAvailability).toHaveBeenCalledWith(updated);
  });

  it('should handle error in update', async () => {
    jest.spyOn(service, 'updateBase').mockRejectedValue(new Error('fail'));

    await expect(
      service.update('inv1', { available_quantity: 10 }),
    ).rejects.toThrow(RpcException);
  });

  it('should delete inventory when product offer no longer exists', async () => {
    const inv: any = {
      id: 'inv1',
      productOfferId: 'offer1',

      // Propiedades mínimas para cumplir Inventory:
      producerId: 'user1',
      available_quantity: 10,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      reserved_quantity: 0,
      maximum_capacity: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    jest.spyOn(service, 'findOne').mockResolvedValue(inv);

    // El MS de product.offer.findOne devuelve null → no existe
    mockNatsClient.send.mockReturnValue(of(null));

    await service.remove('inv1');

    expect(mockInventory.delete).toHaveBeenCalledWith({
      where: { id: 'inv1' },
    });
  });

  it('should not delete if product offer still exists', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 'inv1',
      productOfferId: 'offer1',
      producerId: 'user1',
      available_quantity: 10,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      reserved_quantity: 0,
      maximum_capacity: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockNatsClient.send.mockReturnValue(of({ id: 'offer1' }));

    await expect(service.remove('inv1')).rejects.toThrow(RpcException);
  });

  it('should handle not found in remove', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue(undefined);

    await expect(service.remove('x1')).rejects.toThrow(RpcException);
  });
});
