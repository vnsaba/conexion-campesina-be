import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from '../src/inventory-service.service';
import { Unit } from '../generated/prisma';
import { of } from 'rxjs';
import { UnitConverterService } from '../src/UnitConverterService';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '../provider/prisma.service';

describe('InventoryService (full) - Option A', () => {
  let service: InventoryService;

  // --- Mocks ---
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
    // other models if needed
    productOffer: {
      findUnique: jest.fn(),
    },
    producer: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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
  });

  // -----------------------
  // create()
  // -----------------------
  it('create() - should create inventory when all validations pass and emit updateActive', async () => {
    const producerId = 'prod-1';
    const dto = {
      productOfferId: 'offer-1',
      available_quantity: 10,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 1,
      maximum_capacity: 100,
    };

    // NATS: auth.get.user -> producer, product.offer.findOne -> productOffer
    mockNatsClient.send
      .mockReturnValueOnce(of({ id: 'prod-1' })) // validateProducer
      .mockReturnValueOnce(
        of({ id: 'offer-1', quantity: 1, unit: Unit.KILOGRAMO }),
      ); // validateProductOffer

    mockInventory.findFirst.mockResolvedValue(null);
    mockInventory.create.mockResolvedValue({ id: 'inv-1', ...dto });

    const res = await service.create(producerId, dto);

    expect(res).toEqual({ id: 'inv-1', ...dto });
    expect(mockInventory.create).toHaveBeenCalledWith({
      data: { producerId, ...dto },
    });

    // Should emit product.offer.updateActive
    expect(mockNatsClient.emit).toHaveBeenCalledWith(
      'product.offer.updateActive',
      {
        productOfferId: 'offer-1',
        isActive: dto.available_quantity > 1, // productOffer.quantity was 1
      },
    );
  });

  it('create() - should throw if producer not found', async () => {
    const producerId = 'bad-prod';
    const dto = {
      productOfferId: 'offer-1',
      available_quantity: 1,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      maximum_capacity: 10,
    };

    mockNatsClient.send.mockReturnValue(of(null)); // first call (producer) returns null

    await expect(service.create(producerId, dto)).rejects.toThrow(RpcException);
  });

  it('create() - should throw if productOffer not found', async () => {
    const producerId = 'prod-1';
    const dto = {
      productOfferId: 'bad-offer',
      available_quantity: 2,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      maximum_capacity: 10,
    };

    mockNatsClient.send
      .mockReturnValueOnce(of({ id: 'prod-1' })) // producer
      .mockReturnValueOnce(of(null)); // productOffer not found

    await expect(service.create(producerId, dto)).rejects.toThrow(RpcException);
  });

  it('create() - should throw if duplicate inventory exists', async () => {
    const producerId = 'prod-1';
    const dto = {
      productOfferId: 'offer-1',
      available_quantity: 2,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      maximum_capacity: 10,
    };

    mockNatsClient.send
      .mockReturnValueOnce(of({ id: 'prod-1' }))
      .mockReturnValueOnce(
        of({ id: 'offer-1', quantity: 1, unit: Unit.KILOGRAMO }),
      );

    mockInventory.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(service.create(producerId, dto)).rejects.toThrow(RpcException);
  });

  it('create() - should enforce minimum_threshold validations', async () => {
    const producerId = 'prod-1';
    // minimum_threshold bigger than available -> should reject in validateInventoryInput
    const dto = {
      productOfferId: 'offer-1',
      available_quantity: 5,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 6,
      maximum_capacity: 10,
    };

    await expect(service.create(producerId, dto)).rejects.toThrow();
  });

  it('create() - available_quantity can be zero', async () => {
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
      .mockReturnValueOnce(
        of({ id: 'offer-1', quantity: 1, unit: Unit.KILOGRAMO }),
      );

    mockInventory.findFirst.mockResolvedValue(null);
    mockInventory.create.mockResolvedValue({ id: 'inv', ...dto });

    const r = await service.create(producerId, dto);
    expect(r).toBeDefined();
    expect(mockInventory.create).toHaveBeenCalled();
  });

  // -----------------------
  // findAll()
  // -----------------------
  it('findAll() - returns rows', async () => {
    const rows = [{ id: '1' }, { id: '2' }];
    mockInventory.findMany.mockResolvedValue(rows);

    const res = await service.findAll();
    expect(res).toBe(rows);
    expect(mockInventory.findMany).toHaveBeenCalled();
  });

  it('findAll() - should throw when DB error', async () => {
    mockInventory.findMany.mockRejectedValue(new Error('DB error'));
    await expect(service.findAll()).rejects.toThrow(RpcException);
  });

  // -----------------------
  // findByProducer()
  // -----------------------
  it('findByProducer() - returns inventories with product names', async () => {
    const rows = [{ id: '1', producerId: 'p1', productOfferId: 'offer-1' }];
    mockInventory.findMany.mockResolvedValue(rows);

    // validateProducer -> return producer object
    mockNatsClient.send
      .mockReturnValueOnce(of({ id: 'p1' }))
      // product.offer.getName for each inventory
      .mockReturnValueOnce(of('Manzana'));

    const res = await service.findByProducer('p1');
    expect(Array.isArray(res)).toBe(true);
    expect((res as any)[0].product_name).toEqual({
      id: 'offer-1',
      quantity: 1,
      unit: Unit.KILOGRAMO,
    });
  });

  it('findByProducer() - returns empty array when none', async () => {
    mockNatsClient.send.mockReturnValueOnce(of({ id: 'p1' }));
    mockInventory.findMany.mockResolvedValue([]);
    const res = await service.findByProducer('p1');
    expect(res).toEqual([]);
  });

  it('findByProducer() - returns undefined when producer invalid', async () => {
    mockNatsClient.send.mockReturnValueOnce(of(null)); // validateProducer fails

    const result = await service.findByProducer('p1');

    expect(result).toEqual([]);
  });

  // -----------------------
  // findByProductOffer & findOne
  // -----------------------
  it('findByProductOffer() - returns inventory', async () => {
    const inv = { id: 'inv1', productOfferId: 'offer1' };
    mockInventory.findFirst.mockResolvedValue(inv);
    const res = await service.findByProductOffer('offer1');
    expect(res).toBe(inv);
  });

  it('findByProductOffer() - throws when not found', async () => {
    mockInventory.findFirst.mockResolvedValue(null);
    await expect(service.findByProductOffer('offer1')).rejects.toThrow(
      RpcException,
    );
  });

  it('findOne() - returns inventory by id', async () => {
    const inv = { id: '123' };
    mockInventory.findUnique.mockResolvedValue(inv);
    const r = await service.findOne('123');
    expect(r).toBe(inv);
  });

  it('findOne() - throws when not found', async () => {
    mockInventory.findUnique.mockResolvedValue(null);
    await expect(service.findOne('abc')).rejects.toThrow(RpcException);
  });

  // -----------------------
  // updateBase() validations and behavior
  // -----------------------
  it('updateBase() - updates available_quantity successfully and emits updateActive', async () => {
    const inv = {
      id: 'inv1',
      available_quantity: 10,
      minimum_threshold: 1,
      maximum_capacity: 100,
      productOfferId: 'offer-1',
      unit: Unit.KILOGRAMO,
    };

    mockInventory.findUnique.mockResolvedValue(inv); // used by findOne (note: earlier findOne uses prisma.findUnique)
    // service.findOne will call prisma.inventory.findUnique; we mimic that above

    // productOffer has quantity 1 (so available_quantity: 20 will be >= 1)
    mockNatsClient.send.mockReturnValue(
      of({ id: 'offer-1', quantity: 1, unit: Unit.KILOGRAMO }),
    );
    mockInventory.update.mockResolvedValue({ ...inv, available_quantity: 20 });

    const res = await service.updateBase('inv1', { available_quantity: 20 });
    expect(res!.available_quantity).toBe(20);
    expect(mockInventory.update).toHaveBeenCalledWith({
      where: { id: 'inv1' },
      data: { available_quantity: 20 },
    });

    // Since we updated available_quantity, updateActive should be emitted (20 >= 1)
    expect(mockNatsClient.emit).toHaveBeenCalledWith(
      'product.offer.updateActive',
      {
        productOfferId: 'offer-1',
        isActive: false,
      },
    );
  });

  it('updateBase() - rejects when finalAvailable < 0', async () => {
    const inv = {
      id: 'inv1',
      available_quantity: 5,
      minimum_threshold: 0,
      maximum_capacity: 10,
      productOfferId: 'offer-1',
    };

    mockInventory.findUnique.mockResolvedValue(inv);
    mockNatsClient.send.mockReturnValue(
      of({ id: 'offer-1', quantity: 1, unit: Unit.KILOGRAMO }),
    );

    await expect(
      service.updateBase('inv1', { available_quantity: -1 }),
    ).rejects.toThrow(RpcException);
  });

  it('updateBase() - rejects when finalAvailable > maxCapacity', async () => {
    const inv = {
      id: 'inv1',
      available_quantity: 2,
      minimum_threshold: 0,
      maximum_capacity: 10,
      productOfferId: 'offer-1',
    };

    mockInventory.findUnique.mockResolvedValue(inv);
    mockNatsClient.send.mockReturnValue(
      of({ id: 'offer-1', quantity: 1, unit: Unit.KILOGRAMO }),
    );

    await expect(
      service.updateBase('inv1', { available_quantity: 20 }),
    ).rejects.toThrow(RpcException);
  });

  it('updateBase() - rejects when threshold > maxCapacity', async () => {
    const inv = {
      id: 'inv1',
      available_quantity: 10,
      minimum_threshold: 1,
      maximum_capacity: 100,
      productOfferId: 'offer-1',
    };

    mockInventory.findUnique.mockResolvedValue(inv);
    mockNatsClient.send.mockReturnValue(
      of({ id: 'offer-1', quantity: 1, unit: Unit.KILOGRAMO }),
    );

    await expect(
      service.updateBase('inv1', { minimum_threshold: 200 }),
    ).rejects.toThrow(RpcException);
  });

  it('updateBase() - updates maximum_capacity and minimum_threshold together', async () => {
    const inv = {
      id: 'inv1',
      available_quantity: 10,
      minimum_threshold: 1,
      maximum_capacity: 100,
      productOfferId: 'offer-1',
    };

    mockInventory.findUnique.mockResolvedValue(inv);
    mockNatsClient.send.mockReturnValue(
      of({ id: 'offer-1', quantity: 1, unit: Unit.KILOGRAMO }),
    );
    mockInventory.update.mockResolvedValue({
      ...inv,
      maximum_capacity: 200,
      minimum_threshold: 2,
    });

    const res = await service.updateBase('inv1', {
      maximum_capacity: 200,
      minimum_threshold: 2,
    });
    expect(res!.maximum_capacity).toBe(200);
    expect(res!.minimum_threshold).toBe(2);
    expect(mockInventory.update).toHaveBeenCalledWith({
      where: { id: 'inv1' },
      data: { maximum_capacity: 200, minimum_threshold: 2 },
    });
  });

  it('update() - should call checkLowStock and productAvailability after updateBase', async () => {
    const updated: any = {
      id: 'inv1',
      producerId: 'p1',
      productOfferId: 'offer1',
      available_quantity: 5,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 10,
      reserved_quantity: 0,
      maximum_capacity: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    jest.spyOn(service, 'updateBase').mockResolvedValue(updated);
    const checkLowStockSpy = jest
      .spyOn(service as any, 'checkLowStock')
      .mockImplementation();
    const productAvailabilitySpy = jest
      .spyOn(service as any, 'productAvailability')
      .mockImplementation();

    const res = await service.update('inv1', { available_quantity: 5 });
    expect(res).toBe(updated);
    expect(checkLowStockSpy).toHaveBeenCalledWith(updated);
    expect(productAvailabilitySpy).toHaveBeenCalledWith(updated);
  });

  it('update() - throws when updateBase fails', async () => {
    jest.spyOn(service, 'updateBase').mockRejectedValue(new Error('fail'));
    await expect(
      service.update('inv1', { available_quantity: 10 }),
    ).rejects.toThrow(RpcException);
  });

  // -----------------------
  // remove()
  // -----------------------
  it('remove() - deletes inventory when productOffer no longer exists', async () => {
    const inv: any = {
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
    };

    jest.spyOn(service, 'findOne').mockResolvedValue(inv);
    mockNatsClient.send.mockReturnValue(of(null)); // product.offer.findOne returns null
    mockInventory.delete.mockResolvedValue({});

    await service.remove('inv1');
    expect(mockInventory.delete).toHaveBeenCalledWith({
      where: { id: 'inv1' },
    });
  });

  it('remove() - throws when productOffer still exists', async () => {
    const inv: any = {
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
    };

    jest.spyOn(service, 'findOne').mockResolvedValue(inv);
    mockNatsClient.send.mockReturnValue(of({ id: 'offer1' })); // product exists

    await expect(service.remove('inv1')).rejects.toThrow(RpcException);
    expect(mockInventory.delete).not.toHaveBeenCalled();
  });

  it('remove() - throws when inventory not found', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue(undefined as any);
    await expect(service.remove('x1')).rejects.toThrow(RpcException);
  });

  // -----------------------
  // handleOrderConfirmed & handleOrderCancelled & validateStock
  // -----------------------
  it('handleOrderConfirmed() - decreases available_quantity and calls availability + checkLowStock', async () => {
    const inventory = {
      id: 'inv-1',
      available_quantity: 50,
      unit: Unit.KILOGRAMO,
      minimum_threshold: 0,
      productOfferId: 'offer-1',
    };

    mockInventory.findFirst.mockResolvedValue(inventory);
    // validateProductOffer via NATS
    mockNatsClient.send.mockReturnValue(
      of({ id: 'offer-1', quantity: 1, unit: Unit.KILOGRAMO }),
    );

    // unit conversion returns same (5 -> 5)
    // but our calculateUnitEquivalent uses productOffer.quantity too; keep it simple
    // Simulate prisma.update
    mockInventory.update.mockResolvedValue({
      ...inventory,
      available_quantity: 45,
    });

    await service.handleOrderConfirmed('offer-1', 5);

    expect(mockInventory.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: {
        available_quantity: { decrement: 5 },
      },
    });

    // After update productAvailability was called (emits product.offer.updateAvailability)
    expect(mockNatsClient.emit).toHaveBeenCalledWith(
      'product.offer.updateAvailability',
      {
        productOfferId: 'offer-1',
        available: true,
      },
    );
  });

  it('handleOrderConfirmed() - logs and does nothing if inventory not found', async () => {
    mockInventory.findFirst.mockResolvedValue(null);
    await service.handleOrderConfirmed('offer-1', 5);
    expect(mockInventory.update).not.toHaveBeenCalled();
  });

  it('handleOrderConfirmed() - does not update when insufficient stock', async () => {
    const inventory = {
      id: 'inv-1',
      available_quantity: 2,
      unit: Unit.KILOGRAMO,
    };
    mockInventory.findFirst.mockResolvedValue(inventory);
    mockNatsClient.send.mockReturnValue(
      of({ id: 'offer-1', quantity: 1, unit: Unit.KILOGRAMO }),
    );

    // If convert results in 5 units needed, insufficient; service catches and logs error.
    mockUnitConverter.convert.mockReturnValue(5);

    await service.handleOrderConfirmed('offer-1', 5);
    expect(mockInventory.update).not.toHaveBeenCalled();
  });

  it('handleOrderCancelled() - increments available_quantity when order pending', async () => {
    // Setup order lookup (order.findOne via NATS)
    mockNatsClient.send
      .mockReturnValueOnce(of({ id: 'order-1', status: 'pending' })) // order.findOne
      .mockReturnValueOnce(
        of({ id: 'offer-1', quantity: 1, unit: Unit.KILOGRAMO }),
      ); // validateProductOffer

    const inventory = {
      id: 'inv-1',
      available_quantity: 10,
      unit: Unit.KILOGRAMO,
      productOfferId: 'offer-1',
    };
    mockInventory.findFirst.mockResolvedValue(inventory);
    mockInventory.update.mockResolvedValue({
      ...inventory,
      available_quantity: 13,
    });

    mockUnitConverter.convert.mockReturnValue(3);

    await service.handleOrderCancelled('order-1', 'offer-1', 3);

    expect(mockInventory.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: {
        available_quantity: { increment: 3 },
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

  it('handleOrderCancelled() - does nothing if order not found', async () => {
    mockNatsClient.send.mockReturnValueOnce(of(null)); // order.findOne returns null
    await service.handleOrderCancelled('order-x', 'offer-1', 3);
    expect(mockInventory.update).not.toHaveBeenCalled();
  });

  it('handleOrderCancelled() - does nothing if order status not pending', async () => {
    mockNatsClient.send.mockReturnValueOnce(
      of({ id: 'order-1', status: 'paid' }),
    ); // order exists not pending
    await service.handleOrderCancelled('order-1', 'offer-1', 3);
    expect(mockInventory.update).not.toHaveBeenCalled();
  });

  it('validateStock() - returns true when enough stock', async () => {
    const inventory = {
      id: 'inv-1',
      available_quantity: 10,
      unit: Unit.KILOGRAMO,
    };
    mockInventory.findFirst.mockResolvedValue(inventory);
    mockNatsClient.send.mockReturnValue(
      of({ id: 'offer-1', quantity: 1, unit: Unit.KILOGRAMO }),
    );

    const res = await service.validateStock('offer-1', 5);
    expect(res).toBe(true);
  });

  it('validateStock() - returns false when not enough or error', async () => {
    mockInventory.findFirst.mockResolvedValue(null);
    const res = await service.validateStock('offer-1', 5);
    expect(res).toBe(false);
  });

  it('update() should trigger inventory.lowStock when available <= threshold', async () => {
    const updated: any = {
      id: 'inv1',
      producerId: 'p1',
      productOfferId: 'offer1',
      available_quantity: 1,
      minimum_threshold: 2,
      unit: Unit.KILOGRAMO,
      reserved_quantity: 0,
      maximum_capacity: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    jest.spyOn(service, 'updateBase').mockResolvedValue(updated);

    await service.update('inv1', { available_quantity: 1 });

    expect(mockNatsClient.emit).toHaveBeenCalledWith('inventory.lowStock', {
      producerId: updated.producerId,
      productOfferId: updated.productOfferId,
      available_quantity: updated.available_quantity,
      minimum_threshold: updated.minimum_threshold,
    });

    expect(mockNatsClient.emit).toHaveBeenCalledWith(
      'product.offer.updateAvailability',
      {
        productOfferId: updated.productOfferId,
        available: updated.available_quantity > 0,
      },
    );
  });
});
