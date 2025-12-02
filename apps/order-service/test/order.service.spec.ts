/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { HttpStatus } from '@nestjs/common';
import { OrderService } from '../src/order/order.service';
import { OrderStatus } from '../generated/prisma';
import { of, throwError } from 'rxjs';

describe('OrderService', () => {
  let service: OrderService;
  let mockNatsClient: any;

  const mockOrder = {
    id: 'order-id-123',
    clientId: 'client-123',
    status: OrderStatus.PENDING,
    totalAmount: 20000,
    totalItems: 2,
    address: 'Calle 123 #45-67',
    orderDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    orderDetails: [
      {
        id: 'detail-1',
        orderId: 'order-id-123',
        productOfferId: 'prod-1',
        quantity: 2,
        price: 10000,
        subtotal: 20000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  beforeEach(async () => {
    mockNatsClient = {
      send: jest.fn(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: 'NATS_SERVICE',
          useValue: mockNatsClient,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);

    service.$connect = jest.fn().mockResolvedValue(undefined) as any;
    service.$disconnect = jest.fn().mockResolvedValue(undefined) as any;

    // Mock Prisma models
    Object.defineProperty(service, 'order', {
      value: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      writable: false,
    });

    Object.defineProperty(service, 'orderDetails', {
      value: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      writable: false,
    });

    Object.defineProperty(service, 'orderReceipt', {
      value: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      writable: false,
    });

    service['logger'].log = jest.fn();
    service['logger'].error = jest.fn();
    service['logger'].warn = jest.fn();
  });

  afterEach(async () => {
    await service.$disconnect();
    jest.clearAllMocks();
  });

  describe('create', () => {
    // ORDER-CP-01
    it('ORDER-CP-01: should create order with multiple products and calculate totals correctly', async () => {
      const clientId = 'client-456';
      const createOrderDto = {
        orderDetails: [
          {
            productOfferId: 'prod-1',
            quantity: 2,
            price: 10000,
          },
          {
            productOfferId: 'prod-2',
            quantity: 3,
            price: 5000,
          },
        ],
      };

      const mockOrderMultiple = {
        ...mockOrder,
        id: 'order-id-456',
        clientId: 'client-456',
        address: 'Carrera 50 #20-30',
        totalAmount: 35000,
        totalItems: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        orderDate: new Date(),
        orderDetails: [
          {
            id: 'detail-1',
            orderId: 'order-id-456',
            productOfferId: 'prod-1',
            quantity: 2,
            price: 10000,
            subtotal: 20000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'detail-2',
            orderId: 'order-id-456',
            productOfferId: 'prod-2',
            quantity: 3,
            price: 5000,
            subtotal: 15000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      // Mock NATS responses: user, products, stock validation
      mockNatsClient.send
        .mockReturnValueOnce(
          of({ id: 'client-456', address: 'Carrera 50 #20-30' }),
        )
        .mockReturnValueOnce(
          of({ id: 'prod-1', price: 10000, isAvailable: true, name: 'Prod 1' }),
        )
        .mockReturnValueOnce(
          of({ id: 'prod-2', price: 5000, isAvailable: true, name: 'Prod 2' }),
        )
        .mockReturnValueOnce(of(true))
        .mockReturnValueOnce(of(true));

      (service['order'].create as jest.Mock).mockResolvedValue(
        mockOrderMultiple,
      );

      const result = await service.create(clientId, createOrderDto);

      expect(service['order'].create).toHaveBeenCalledWith({
        data: {
          clientId: 'client-456',
          status: 'PENDING',
          address: 'Carrera 50 #20-30',
          totalAmount: 35000,
          totalItems: 5,
          orderDetails: {
            create: [
              {
                productOfferId: 'prod-1',
                quantity: 2,
                price: 10000,
                subtotal: 20000,
              },
              {
                productOfferId: 'prod-2',
                quantity: 3,
                price: 5000,
                subtotal: 15000,
              },
            ],
          },
        },
        include: {
          orderDetails: true,
        },
      });
      expect(result.totalAmount).toBe(35000);
      expect(result.totalItems).toBe(5);
      expect(result.orderDetails).toHaveLength(2);
      expect(result.orderDetails[0].subtotal).toBe(20000);
      expect(result.orderDetails[1].subtotal).toBe(15000);
    });

    // ORDER-CP-02
    it('ORDER-CP-02: should always create order with PENDING status', async () => {
      const clientId = 'client-789';
      const createOrderDto = {
        orderDetails: [
          {
            productOfferId: 'prod-1',
            quantity: 1,
            price: 10000,
          },
        ],
      };

      const mockOrderCreated = {
        ...mockOrder,
        id: 'order-id-789',
        clientId: 'client-789',
        address: 'Avenida 80 #100-50',
        status: OrderStatus.PENDING,
      };

      mockNatsClient.send
        .mockReturnValueOnce(
          of({ id: 'client-789', address: 'Avenida 80 #100-50' }),
        )
        .mockReturnValueOnce(
          of({ id: 'prod-1', price: 10000, isAvailable: true }),
        )
        .mockReturnValueOnce(of(true));

      (service['order'].create as jest.Mock).mockResolvedValue(
        mockOrderCreated,
      );

      const result = await service.create(clientId, createOrderDto);

      expect(service['order'].create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
          }),
        }),
      );
      expect(result.status).toBe(OrderStatus.PENDING);
    });

    // ORDER-CP-03
    it('ORDER-CP-03: should throw BAD_REQUEST when products do not exist', async () => {
      const clientId = 'client-123';
      const createOrderDto = {
        orderDetails: [
          {
            productOfferId: 'invalid-prod-id',
            quantity: 1,
            price: 10000,
          },
        ],
      };

      mockNatsClient.send
        .mockReturnValueOnce(
          of({ id: 'client-123', address: 'Calle 50 #10-20' }),
        )
        .mockReturnValueOnce(of(null));

      try {
        await service.create(clientId, createOrderDto);
        fail('Should have thrown RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const errorData = (error as RpcException).getError();
        expect(errorData).toMatchObject({
          status: HttpStatus.BAD_REQUEST,
        });
        expect((errorData as any).message).toContain('Products not found');
      }

      expect(service['order'].create).not.toHaveBeenCalled();
      expect(service['logger'].log).not.toHaveBeenCalledWith(
        expect.stringContaining('Order created successfully'),
      );
    });

    // ORDER-CP-04
    it('ORDER-CP-04: should throw BAD_REQUEST when creating order with empty orderDetails', async () => {
      const clientId = 'client-123';
      const createOrderDto = {
        address: 'Calle 123 #45-67',
        orderDetails: [],
      };

      await expect(service.create(clientId, createOrderDto)).rejects.toThrow(
        RpcException,
      );

      try {
        await service.create(clientId, createOrderDto);
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          status: HttpStatus.BAD_REQUEST,
          message: 'Order must contain at least one product',
        });
      }

      expect(service['order'].create).not.toHaveBeenCalled();
      expect(mockNatsClient.send).not.toHaveBeenCalled();
    });

    // ORDER-CP-05
    it('ORDER-CP-05: should throw BAD_REQUEST when quantity is zero', async () => {
      const clientId = 'client-123';
      const createOrderDto = {
        orderDetails: [
          {
            productOfferId: 'prod-1',
            quantity: 0,
            price: 10000,
          },
        ],
      };

      mockNatsClient.send.mockReturnValueOnce(
        of({ id: 'client-123', address: 'Calle 123 #45-67' }),
      );

      try {
        await service.create(clientId, createOrderDto);
        fail('Should have thrown RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const errorData = (error as RpcException).getError();
        expect(errorData).toEqual({
          status: HttpStatus.BAD_REQUEST,
          message: 'Quantity must be greater than zero',
        });
      }

      expect(service['order'].create).not.toHaveBeenCalled();
    });

    // ORDER-CP-06
    it('ORDER-CP-06: should throw BAD_REQUEST when quantity is negative', async () => {
      const clientId = 'client-123';
      const createOrderDto = {
        orderDetails: [
          {
            productOfferId: 'prod-1',
            quantity: -5,
            price: 10000,
          },
        ],
      };

      mockNatsClient.send.mockReturnValueOnce(
        of({ id: 'client-123', address: 'Calle 123 #45-67' }),
      );

      try {
        await service.create(clientId, createOrderDto);
        fail('Should have thrown RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const errorData = (error as RpcException).getError();
        expect(errorData).toEqual({
          status: HttpStatus.BAD_REQUEST,
          message: 'Quantity must be greater than zero',
        });
      }

      expect(service['order'].create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    // ORDER-CP-08
    it('ORDER-CP-08: should return orders with default pagination', async () => {
      const mockOrders = Array.from({ length: 10 }, (_, i) => ({
        ...mockOrder,
        id: `order-${i}`,
      }));

      (service['order'].count as jest.Mock).mockResolvedValue(15);
      (service['order'].findMany as jest.Mock).mockResolvedValue(mockOrders);

      const result = await service.findAll({});

      expect(service['order'].count).toHaveBeenCalledWith({
        where: {
          status: undefined,
        },
      });
      expect(service['order'].findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: {
          status: undefined,
        },
        include: {
          orderDetails: true,
        },
        orderBy: { orderDate: 'desc' },
      });
      expect(result.data).toHaveLength(10);
      expect(result.meta).toEqual({
        total: 15,
        page: 1,
        lastPage: 2,
      });
    });

    // ORDER-CP-09
    it('ORDER-CP-09: should return orders with custom pagination', async () => {
      const mockOrders = Array.from({ length: 5 }, (_, i) => ({
        ...mockOrder,
        id: `order-${i + 5}`,
      }));

      (service['order'].count as jest.Mock).mockResolvedValue(15);
      (service['order'].findMany as jest.Mock).mockResolvedValue(mockOrders);

      const result = await service.findAll({ page: 2, limit: 5 });

      expect(service['order'].findMany).toHaveBeenCalledWith({
        skip: 5,
        take: 5,
        where: {
          status: undefined,
        },
        include: {
          orderDetails: true,
        },
        orderBy: { orderDate: 'desc' },
      });
      expect(result.data).toHaveLength(5);
      expect(result.meta).toEqual({
        total: 15,
        page: 2,
        lastPage: 3,
      });
    });

    // ORDER-CP-10
    it('ORDER-CP-10: should return orders filtered by status', async () => {
      const mockPendingOrders = Array.from({ length: 4 }, (_, i) => ({
        ...mockOrder,
        id: `order-pending-${i}`,
        status: OrderStatus.PENDING,
      }));

      (service['order'].count as jest.Mock).mockResolvedValue(4);
      (service['order'].findMany as jest.Mock).mockResolvedValue(
        mockPendingOrders,
      );

      const result = await service.findAll({ status: OrderStatus.PENDING });

      expect(service['order'].count).toHaveBeenCalledWith({
        where: {
          status: OrderStatus.PENDING,
        },
      });
      expect(service['order'].findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: {
          status: OrderStatus.PENDING,
        },
        include: {
          orderDetails: true,
        },
        orderBy: { orderDate: 'desc' },
      });
      expect(result.data).toHaveLength(4);
      expect(result.meta.total).toBe(4);
      expect(
        result.data.every((order) => order.status === OrderStatus.PENDING),
      ).toBe(true);
    });

    // ORDER-CP-11
    it('ORDER-CP-11: should throw INTERNAL_SERVER_ERROR on database failure', async () => {
      const dbError = new Error('Database connection failed');
      (service['order'].count as jest.Mock).mockRejectedValue(dbError);

      await expect(service.findAll({})).rejects.toThrow(RpcException);

      try {
        await service.findAll({});
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to fetch all orders',
        });
      }

      expect(service['logger'].error).toHaveBeenCalledWith(
        'Failed to fetch all orders',
        dbError.stack,
      );
    });
  });

  describe('findOne', () => {
    // ORDER-CP-12
    it('ORDER-CP-12: should return order by ID when it exists', async () => {
      (service['order'].findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const result = await service.findOne('order-id-123');

      expect(service['order'].findUnique).toHaveBeenCalledWith({
        where: { id: 'order-id-123' },
        include: {
          orderDetails: true,
          orderReceipt: true,
        },
      });
      expect(result).toEqual(mockOrder);
      expect(result.id).toBe('order-id-123');
      expect(result.orderDetails).toBeDefined();
    });

    // ORDER-CP-13
    it('ORDER-CP-13: should throw NOT_FOUND when order does not exist', async () => {
      (service['order'].findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(RpcException);

      try {
        await service.findOne('invalid-id');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          status: HttpStatus.NOT_FOUND,
          message: "Order with id 'invalid-id' not found",
        });
      }
    });
  });

  describe('remove', () => {
    // ORDER-CP-14
    it('ORDER-CP-14: should delete order and its details successfully', async () => {
      (service['order'].findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (service['order'].delete as jest.Mock).mockResolvedValue(mockOrder);

      const result = await service.remove('order-id-123');

      expect(service['order'].delete).toHaveBeenCalledWith({
        where: { id: 'order-id-123' },
      });
      expect(result).toEqual({
        message: 'Order deleted successfully',
        id: 'order-id-123',
      });
      expect(service['logger'].log).toHaveBeenCalledWith(
        'Order deleted successfully: order-id-123',
      );
    });

    // ORDER-CP-15
    it('ORDER-CP-15: should throw NOT_FOUND when deleting non-existent order', async () => {
      (service['order'].findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(RpcException);

      try {
        await service.remove('invalid-id');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          status: HttpStatus.NOT_FOUND,
          message: "Order with id 'invalid-id' not found",
        });
      }

      expect(service['order'].delete).not.toHaveBeenCalled();
      expect(service['logger'].log).not.toHaveBeenCalledWith(
        expect.stringContaining('Order deleted successfully'),
      );
    });
  });

  describe('findByClientId', () => {
    // ORDER-CP-16
    it('ORDER-CP-16: should return all orders for a specific client', async () => {
      const mockClientOrders = Array.from({ length: 3 }, (_, i) => ({
        ...mockOrder,
        id: `order-${i}`,
        clientId: 'client-123',
        orderDate: new Date(Date.now() - i * 1000 * 60 * 60 * 24),
      }));

      (service['order'].findMany as jest.Mock).mockResolvedValue(
        mockClientOrders,
      );

      mockNatsClient.send.mockReturnValue(of('Producto Test'));

      const result = await service.findByClientId('client-123');

      expect(service['order'].findMany).toHaveBeenCalledWith({
        where: { clientId: 'client-123' },
        include: {
          orderDetails: true,
          orderReceipt: true,
        },
        orderBy: { orderDate: 'desc' },
      });
      expect(result).toHaveLength(3);
      expect(result.every((order) => order.clientId === 'client-123')).toBe(
        true,
      );
      expect(result[0].orderDetails).toBeDefined();
    });

    // ORDER-CP-17
    it('ORDER-CP-17: should return empty array when client has no orders', async () => {
      (service['order'].findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findByClientId('client-sin-ordenes');

      expect(service['order'].findMany).toHaveBeenCalledWith({
        where: { clientId: 'client-sin-ordenes' },
        include: {
          orderDetails: true,
          orderReceipt: true,
        },
        orderBy: { orderDate: 'desc' },
      });
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('getOrderDetails', () => {
    // ORDER-CP-18
    it('ORDER-CP-18: should return order details for existing order', async () => {
      const mockOrderDetails = [
        {
          id: 'detail-1',
          orderId: 'order-id-123',
          productOfferId: 'prod-1',
          quantity: 2,
          price: 10000,
          subtotal: 20000,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
        },
        {
          id: 'detail-2',
          orderId: 'order-id-123',
          productOfferId: 'prod-2',
          quantity: 3,
          price: 5000,
          subtotal: 15000,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date(),
        },
      ];

      (service['order'].findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (service['orderDetails'].findMany as jest.Mock).mockResolvedValue(
        mockOrderDetails,
      );

      const result = await service.getOrderDetails('order-id-123');

      expect(service['orderDetails'].findMany).toHaveBeenCalledWith({
        where: { orderId: 'order-id-123' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].productOfferId).toBe('prod-1');
      expect(result[0].subtotal).toBe(20000);
      expect(result[1].productOfferId).toBe('prod-2');
      expect(result[1].subtotal).toBe(15000);
    });

    // ORDER-CP-19
    it('ORDER-CP-19: should throw NOT_FOUND when getting details of non-existent order', async () => {
      (service['order'].findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getOrderDetails('invalid-id')).rejects.toThrow(
        RpcException,
      );

      try {
        await service.getOrderDetails('invalid-id');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          status: HttpStatus.NOT_FOUND,
          message: "Order with id 'invalid-id' not found",
        });
      }

      expect(service['orderDetails'].findMany).not.toHaveBeenCalled();
    });
  });

  describe('findByProducerId', () => {
    // ORDER-CP-20
    it('ORDER-CP-20: should return orders with PAID status for producer products', async () => {
      const producerId = 'producer-123';
      const mockProductOffers = [
        { id: 'prod-offer-1', producerId: 'producer-123' },
        { id: 'prod-offer-2', producerId: 'producer-123' },
      ];

      const mockOrders = [
        {
          ...mockOrder,
          id: 'order-1',
          clientId: 'client-1',
          status: OrderStatus.PAID,
          orderDetails: [
            {
              id: 'detail-1',
              orderId: 'order-1',
              productOfferId: 'prod-offer-1',
              quantity: 2,
              price: 10000,
              subtotal: 20000,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'detail-2',
              orderId: 'order-1',
              productOfferId: 'other-prod',
              quantity: 1,
              price: 5000,
              subtotal: 5000,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        {
          ...mockOrder,
          id: 'order-2',
          clientId: 'client-2',
          status: OrderStatus.PAID,
          orderDetails: [
            {
              id: 'detail-3',
              orderId: 'order-2',
              productOfferId: 'prod-offer-2',
              quantity: 3,
              price: 8000,
              subtotal: 24000,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ];

      const mockClients = [
        { id: 'client-1', fullName: 'Juan Pérez' },
        { id: 'client-2', fullName: 'María García' },
      ];

      mockNatsClient.send
        .mockReturnValueOnce(of(mockProductOffers))
        .mockReturnValueOnce(of(mockClients[0]))
        .mockReturnValueOnce(of(mockClients[1]))
        .mockReturnValueOnce(of('Producto 1'))
        .mockReturnValueOnce(of('Producto 2'));

      (service['order'].findMany as jest.Mock).mockResolvedValue(mockOrders);

      const result = await service.findByProducerId(producerId);

      expect(mockNatsClient.send).toHaveBeenCalledWith(
        'product.offer.findAllProducer',
        producerId,
      );
      expect(service['order'].findMany).toHaveBeenCalledWith({
        where: {
          status: 'PAID',
          orderDetails: {
            some: {
              productOfferId: {
                in: ['prod-offer-1', 'prod-offer-2'],
              },
            },
          },
        },
        include: {
          orderDetails: true,
        },
        orderBy: { orderDate: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].clientName).toBe('Juan Pérez');
      expect(result[1].clientName).toBe('María García');
      expect(result[0].orderDetails).toHaveLength(1);
      expect(result[0].orderDetails[0].productOfferId).toBe('prod-offer-1');
      expect(result[1].orderDetails).toHaveLength(1);
      expect(result[1].orderDetails[0].productOfferId).toBe('prod-offer-2');
    });

    // ORDER-CP-21
    it('ORDER-CP-21: should return empty array when producer has no product offers', async () => {
      const producerId = 'producer-456';

      mockNatsClient.send.mockReturnValue(of([]));

      const result = await service.findByProducerId(producerId);

      expect(mockNatsClient.send).toHaveBeenCalledWith(
        'product.offer.findAllProducer',
        producerId,
      );
      expect(service['order'].findMany).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    // ORDER-CP-22
    it('ORDER-CP-22: should return empty array when producer has no orders', async () => {
      const producerId = 'producer-789';
      const mockProductOffers = [
        { id: 'prod-offer-3', producerId: 'producer-789' },
      ];

      mockNatsClient.send.mockReturnValue(of(mockProductOffers));
      (service['order'].findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findByProducerId(producerId);

      expect(service['order'].findMany).toHaveBeenCalledWith({
        where: {
          status: 'PAID',
          orderDetails: {
            some: {
              productOfferId: {
                in: ['prod-offer-3'],
              },
            },
          },
        },
        include: {
          orderDetails: true,
        },
        orderBy: { orderDate: 'desc' },
      });
      expect(result).toEqual([]);
    });

    // ORDER-CP-23
    it('ORDER-CP-23: should filter order details to only include producer products', async () => {
      const producerId = 'producer-123';
      const mockProductOffers = [
        { id: 'prod-offer-1', producerId: 'producer-123' },
      ];

      const mockOrderWithMixedProducts = {
        ...mockOrder,
        id: 'order-mixed',
        clientId: 'client-1',
        status: OrderStatus.PAID,
        orderDetails: [
          {
            id: 'detail-1',
            orderId: 'order-mixed',
            productOfferId: 'prod-offer-1',
            quantity: 2,
            price: 10000,
            subtotal: 20000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'detail-2',
            orderId: 'order-mixed',
            productOfferId: 'other-producer-prod',
            quantity: 1,
            price: 5000,
            subtotal: 5000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockNatsClient.send
        .mockReturnValueOnce(of(mockProductOffers))
        .mockReturnValueOnce(of({ id: 'client-1', fullName: 'Test Client' }))
        .mockReturnValueOnce(of('Producto Test'));

      (service['order'].findMany as jest.Mock).mockResolvedValue([
        mockOrderWithMixedProducts,
      ]);

      const result = await service.findByProducerId(producerId);

      expect(result).toHaveLength(1);
      expect(result[0].orderDetails).toHaveLength(1);
      expect(result[0].orderDetails[0].productOfferId).toBe('prod-offer-1');
      expect(result[0].clientName).toBe('Test Client');
    });

    // ORDER-CP-24
    it('ORDER-CP-24: should handle client fetch errors gracefully', async () => {
      const producerId = 'producer-123';
      const mockProductOffers = [
        { id: 'prod-offer-1', producerId: 'producer-123' },
      ];

      const mockOrderWithError = {
        ...mockOrder,
        id: 'order-1',
        clientId: 'client-1',
        status: OrderStatus.PAID,
        orderDetails: [
          {
            id: 'detail-1',
            orderId: 'order-1',
            productOfferId: 'prod-offer-1',
            quantity: 2,
            price: 10000,
            subtotal: 20000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockNatsClient.send
        .mockReturnValueOnce(of(mockProductOffers))
        .mockReturnValueOnce(throwError(() => new Error('Client not found')))
        .mockReturnValueOnce(of('Producto Test'));

      (service['order'].findMany as jest.Mock).mockResolvedValue([
        mockOrderWithError,
      ]);

      const result = await service.findByProducerId(producerId);

      expect(result).toHaveLength(1);
      expect(result[0].clientName).toBe('Unknown Client');
    });

    // ORDER-CP-25
    it('ORDER-CP-25: should only return orders with PAID status', async () => {
      const producerId = 'producer-123';
      const mockProductOffers = [
        { id: 'prod-offer-1', producerId: 'producer-123' },
      ];

      const mockOrders = [
        {
          ...mockOrder,
          id: 'order-paid',
          status: OrderStatus.PAID,
          orderDetails: [
            {
              id: 'detail-1',
              orderId: 'order-paid',
              productOfferId: 'prod-offer-1',
              quantity: 1,
              price: 10000,
              subtotal: 10000,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        {
          ...mockOrder,
          id: 'order-pending',
          status: OrderStatus.PENDING,
          orderDetails: [
            {
              id: 'detail-2',
              orderId: 'order-pending',
              productOfferId: 'prod-offer-1',
              quantity: 1,
              price: 10000,
              subtotal: 10000,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ];

      mockNatsClient.send
        .mockReturnValueOnce(of(mockProductOffers))
        .mockReturnValueOnce(of({ id: 'client-1', fullName: 'Test Client' }))
        .mockReturnValueOnce(of('Producto Test'));

      (service['order'].findMany as jest.Mock).mockResolvedValue([
        mockOrders[0],
      ]);

      const result = await service.findByProducerId(producerId);

      expect(service['order'].findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PAID',
          }),
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(OrderStatus.PAID);
    });
  });

  describe('create - Additional Tests', () => {
    // ORDER-CP-07
    it('ORDER-CP-07: should obtain address automatically from user profile', async () => {
      const clientId = 'client-123';
      const createOrderDto = {
        orderDetails: [
          {
            productOfferId: 'prod-1',
            quantity: 2,
            price: 10000,
          },
        ],
      };

      const mockUser = {
        id: 'client-123',
        address: 'Calle Automática #123-45',
        fullName: 'Test User',
      };

      const mockOrderCreated = {
        ...mockOrder,
        address: 'Calle Automática #123-45',
      };

      mockNatsClient.send
        .mockReturnValueOnce(of(mockUser))
        .mockReturnValueOnce(
          of({ id: 'prod-1', price: 10000, isAvailable: true, name: 'Prod 1' }),
        )
        .mockReturnValueOnce(of(true));

      (service['order'].create as jest.Mock).mockResolvedValue(
        mockOrderCreated,
      );

      const result = await service.create(clientId, createOrderDto);

      expect(mockNatsClient.send).toHaveBeenCalledWith(
        'auth.get.user',
        clientId,
      );
      expect(result.address).toBe('Calle Automática #123-45');
      expect(service['order'].create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            address: 'Calle Automática #123-45',
          }),
        }),
      );
    });

    // ORDER-CP-07a
    it('ORDER-CP-07a: should throw error when user has no address registered', async () => {
      const clientId = 'client-123';
      const createOrderDto = {
        orderDetails: [
          {
            productOfferId: 'prod-1',
            quantity: 2,
            price: 10000,
          },
        ],
      };

      const mockUser = {
        id: 'client-123',
        address: '',
        fullName: 'Test User',
      };

      mockNatsClient.send.mockReturnValueOnce(of(mockUser)); // auth.get.user

      try {
        await service.create(clientId, createOrderDto);
        fail('Should have thrown RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const errorData = (error as RpcException).getError();
        expect(errorData).toEqual({
          status: HttpStatus.BAD_REQUEST,
          message: 'You must have an address to create an order',
        });
      }

      expect(service['order'].create).not.toHaveBeenCalled();
    });

    // ORDER-CP-07b
    it('ORDER-CP-07b: should throw BAD_REQUEST when product is not available', async () => {
      const clientId = 'client-123';
      const createOrderDto = {
        orderDetails: [
          {
            productOfferId: 'prod-1',
            quantity: 2,
            price: 10000,
          },
        ],
      };

      const mockUser = {
        id: 'client-123',
        address: 'Calle 123',
      };

      mockNatsClient.send
        .mockReturnValueOnce(of(mockUser)) // auth.get.user
        .mockReturnValueOnce(
          of({
            id: 'prod-1',
            price: 10000,
            isAvailable: false,
            name: 'Prod 1',
          }),
        ); // product.offer.findOne

      try {
        await service.create(clientId, createOrderDto);
        fail('Should have thrown RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const errorData = (error as RpcException).getError();
        expect(errorData).toMatchObject({
          status: HttpStatus.BAD_REQUEST,
        });
        expect((errorData as any).message).toContain('not available for sale');
      }

      expect(service['order'].create).not.toHaveBeenCalled();
    });

    // ORDER-CP-07c
    it('ORDER-CP-07c: should validate stock before creating order', async () => {
      const clientId = 'client-123';
      const createOrderDto = {
        orderDetails: [
          {
            productOfferId: 'prod-1',
            quantity: 10,
            price: 10000,
          },
        ],
      };

      const mockUser = {
        id: 'client-123',
        address: 'Calle 123',
      };

      mockNatsClient.send
        .mockReturnValueOnce(of(mockUser)) // auth.get.user
        .mockReturnValueOnce(
          of({ id: 'prod-1', price: 10000, isAvailable: true, name: 'Prod 1' }),
        ) // product.offer.findOne
        .mockReturnValueOnce(of(false)); // inventory.validateStock - No hay stock

      try {
        await service.create(clientId, createOrderDto);
        fail('Should have thrown RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const errorData = (error as RpcException).getError();
        expect(errorData).toMatchObject({
          status: HttpStatus.BAD_REQUEST,
        });
        expect((errorData as any).message).toContain('Stock insuficiente');
      }

      expect(service['order'].create).not.toHaveBeenCalled();
    });
  });

  describe('findByClientId - Additional Tests', () => {
    // ORDER-CP-16a
    it('ORDER-CP-16a: should include productName in each orderDetail', async () => {
      const mockClientOrders = [
        {
          ...mockOrder,
          id: 'order-1',
          clientId: 'client-123',
          orderDetails: [
            {
              id: 'detail-1',
              orderId: 'order-1',
              productOfferId: 'prod-1',
              quantity: 2,
              price: 10000,
              subtotal: 20000,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          orderReceipt: null,
        },
      ];

      (service['order'].findMany as jest.Mock).mockResolvedValue(
        mockClientOrders,
      );
      mockNatsClient.send.mockReturnValue(of('Producto Test'));

      const result = await service.findByClientId('client-123');

      expect(result[0].orderDetails[0]).toHaveProperty('productName');
      expect(result[0].orderDetails[0].productName).toBe('Producto Test');
    });

    // ORDER-CP-16b
    it('ORDER-CP-16b: should use "Producto desconocido" when product name cannot be fetched', async () => {
      const mockClientOrders = [
        {
          ...mockOrder,
          id: 'order-1',
          clientId: 'client-123',
          orderDetails: [
            {
              id: 'detail-1',
              orderId: 'order-1',
              productOfferId: 'prod-1',
              quantity: 2,
              price: 10000,
              subtotal: 20000,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          orderReceipt: null,
        },
      ];

      (service['order'].findMany as jest.Mock).mockResolvedValue(
        mockClientOrders,
      );
      mockNatsClient.send.mockReturnValue(
        throwError(() => new Error('Product not found')),
      );

      const result = await service.findByClientId('client-123');

      expect(result[0].orderDetails[0].productName).toBe(
        'Producto desconocido',
      );
    });

    // ORDER-CP-16c
    it('ORDER-CP-16c: should include orderReceipt when order is paid', async () => {
      const mockClientOrders = [
        {
          ...mockOrder,
          id: 'order-1',
          clientId: 'client-123',
          status: OrderStatus.PAID,
          orderReceipt: {
            id: 'receipt-1',
            orderId: 'order-1',
            receiptUrl: 'https://stripe.com/receipt',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      (service['order'].findMany as jest.Mock).mockResolvedValue(
        mockClientOrders,
      );
      mockNatsClient.send.mockReturnValue(of('Producto Test'));

      const result = await service.findByClientId('client-123');

      expect(result[0].orderReceipt).toBeDefined();
      expect(result[0].orderReceipt?.receiptUrl).toBe(
        'https://stripe.com/receipt',
      );
    });
  });

  describe('findByProducerId - Additional Tests', () => {
    // ORDER-CP-20a
    it('ORDER-CP-20a: should include productName in each orderDetail', async () => {
      const producerId = 'producer-123';
      const mockProductOffers = [
        { id: 'prod-offer-1', producerId: 'producer-123' },
      ];
      const mockOrders = [
        {
          ...mockOrder,
          id: 'order-1',
          status: OrderStatus.PAID,
          orderDetails: [
            {
              id: 'detail-1',
              orderId: 'order-1',
              productOfferId: 'prod-offer-1',
              quantity: 2,
              price: 10000,
              subtotal: 20000,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ];

      mockNatsClient.send
        .mockReturnValueOnce(of(mockProductOffers))
        .mockReturnValueOnce(of({ id: 'client-1', fullName: 'Test Client' }))
        .mockReturnValueOnce(of('Producto Test'));

      (service['order'].findMany as jest.Mock).mockResolvedValue(mockOrders);

      const result = await service.findByProducerId(producerId);

      expect(result[0].orderDetails[0]).toHaveProperty('productName');
      expect(result[0].orderDetails[0].productName).toBe('Producto Test');
    });

    // ORDER-CP-20b
    it('ORDER-CP-20b: should calculate totalAmount only with producer products', async () => {
      const producerId = 'producer-123';
      const mockProductOffers = [
        { id: 'prod-offer-1', producerId: 'producer-123' },
      ];
      const mockOrders = [
        {
          ...mockOrder,
          id: 'order-1',
          status: OrderStatus.PAID,
          totalAmount: 50000, // Total de toda la orden
          orderDetails: [
            {
              id: 'detail-1',
              orderId: 'order-1',
              productOfferId: 'prod-offer-1',
              quantity: 2,
              price: 10000,
              subtotal: 20000, // Solo del productor
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'detail-2',
              orderId: 'order-1',
              productOfferId: 'other-prod',
              quantity: 3,
              price: 10000,
              subtotal: 30000, // De otro productor
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ];

      mockNatsClient.send
        .mockReturnValueOnce(of(mockProductOffers))
        .mockReturnValueOnce(of({ id: 'client-1', fullName: 'Test Client' }))
        .mockReturnValueOnce(of('Producto Test'));

      (service['order'].findMany as jest.Mock).mockResolvedValue(mockOrders);

      const result = await service.findByProducerId(producerId);

      expect(result[0].totalAmount).toBe(20000); // Solo productos del productor
      expect(result[0].totalAmount).not.toBe(50000);
    });

    // ORDER-CP-20c
    it('ORDER-CP-20c: should calculate totalItems only with producer products', async () => {
      const producerId = 'producer-123';
      const mockProductOffers = [
        { id: 'prod-offer-1', producerId: 'producer-123' },
      ];
      const mockOrders = [
        {
          ...mockOrder,
          id: 'order-1',
          status: OrderStatus.PAID,
          totalItems: 5, // Total de toda la orden
          orderDetails: [
            {
              id: 'detail-1',
              orderId: 'order-1',
              productOfferId: 'prod-offer-1',
              quantity: 2, // Solo del productor
              price: 10000,
              subtotal: 20000,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'detail-2',
              orderId: 'order-1',
              productOfferId: 'other-prod',
              quantity: 3, // De otro productor
              price: 10000,
              subtotal: 30000,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ];

      mockNatsClient.send
        .mockReturnValueOnce(of(mockProductOffers))
        .mockReturnValueOnce(of({ id: 'client-1', fullName: 'Test Client' }))
        .mockReturnValueOnce(of('Producto Test'));

      (service['order'].findMany as jest.Mock).mockResolvedValue(mockOrders);

      const result = await service.findByProducerId(producerId);

      expect(result[0].totalItems).toBe(2); // Solo productos del productor
      expect(result[0].totalItems).not.toBe(5);
    });
  });

  describe('cancelOrder', () => {
    // ORDER-CP-26
    it('ORDER-CP-26: should cancel order successfully when PENDING and owned by client', async () => {
      const orderId = 'order-123';
      const clientId = 'client-123';
      const mockPendingOrder = {
        ...mockOrder,
        id: orderId,
        clientId: clientId,
        status: OrderStatus.PENDING,
      };

      const mockCancelledOrder = {
        ...mockPendingOrder,
        status: OrderStatus.CANCELLED,
      };

      (service['order'].findUnique as jest.Mock).mockResolvedValue(
        mockPendingOrder,
      );
      (service['order'].update as jest.Mock).mockResolvedValue(
        mockCancelledOrder,
      );

      const result = await service.cancelOrder(orderId, clientId);

      expect(service['order'].update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
        include: { orderDetails: true },
      });
      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(mockNatsClient.emit).toHaveBeenCalled();
    });

    // ORDER-CP-27
    it('ORDER-CP-27: should throw NOT_FOUND when order does not exist', async () => {
      const orderId = 'invalid-order';
      const clientId = 'client-123';

      (service['order'].findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.cancelOrder(orderId, clientId)).rejects.toThrow(
        RpcException,
      );

      try {
        await service.cancelOrder(orderId, clientId);
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          status: HttpStatus.NOT_FOUND,
          message: "Order with id 'invalid-order' not found",
        });
      }

      expect(service['order'].update).not.toHaveBeenCalled();
    });

    // ORDER-CP-28
    it('ORDER-CP-28: should throw FORBIDDEN when client is not owner', async () => {
      const orderId = 'order-123';
      const clientId = 'client-123';
      const mockOtherOrder = {
        ...mockOrder,
        id: orderId,
        clientId: 'other-client',
        status: OrderStatus.PENDING,
      };

      (service['order'].findUnique as jest.Mock).mockResolvedValue(
        mockOtherOrder,
      );

      await expect(service.cancelOrder(orderId, clientId)).rejects.toThrow(
        RpcException,
      );

      try {
        await service.cancelOrder(orderId, clientId);
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          status: HttpStatus.FORBIDDEN,
          message: 'You can only cancel your own orders',
        });
      }

      expect(service['order'].update).not.toHaveBeenCalled();
    });

    // ORDER-CP-29
    it('ORDER-CP-29: should throw BAD_REQUEST when order is not PENDING', async () => {
      const orderId = 'order-123';
      const clientId = 'client-123';
      const mockPaidOrder = {
        ...mockOrder,
        id: orderId,
        clientId: clientId,
        status: OrderStatus.PAID,
      };

      (service['order'].findUnique as jest.Mock).mockResolvedValue(
        mockPaidOrder,
      );

      await expect(service.cancelOrder(orderId, clientId)).rejects.toThrow(
        RpcException,
      );

      try {
        await service.cancelOrder(orderId, clientId);
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          status: HttpStatus.BAD_REQUEST,
          message: expect.stringContaining(
            'Only PENDING orders can be cancelled',
          ),
        });
      }

      expect(service['order'].update).not.toHaveBeenCalled();
    });

    // ORDER-CP-30
    it('ORDER-CP-30: should emit order.cancelled event with orderId, productOfferId and quantity', async () => {
      const orderId = 'order-123';
      const clientId = 'client-123';
      const mockPendingOrder = {
        ...mockOrder,
        id: orderId,
        clientId: clientId,
        status: OrderStatus.PENDING,
        orderDetails: [
          {
            id: 'detail-1',
            orderId: orderId,
            productOfferId: 'prod-1',
            quantity: 2,
            price: 10000,
            subtotal: 20000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const mockCancelledOrder = {
        ...mockPendingOrder,
        status: OrderStatus.CANCELLED,
      };

      (service['order'].findUnique as jest.Mock).mockResolvedValue(
        mockPendingOrder,
      );
      (service['order'].update as jest.Mock).mockResolvedValue(
        mockCancelledOrder,
      );

      await service.cancelOrder(orderId, clientId);

      expect(mockNatsClient.emit).toHaveBeenCalledWith('order.cancelled', {
        orderId: orderId,
        productOfferId: 'prod-1',
        quantity: 2,
      });
    });

    // ORDER-CP-31
    it('ORDER-CP-31: should change status to CANCELLED after canceling', async () => {
      const orderId = 'order-123';
      const clientId = 'client-123';
      const mockPendingOrder = {
        ...mockOrder,
        id: orderId,
        clientId: clientId,
        status: OrderStatus.PENDING,
      };

      const mockCancelledOrder = {
        ...mockPendingOrder,
        status: OrderStatus.CANCELLED,
      };

      (service['order'].findUnique as jest.Mock).mockResolvedValue(
        mockPendingOrder,
      );
      (service['order'].update as jest.Mock).mockResolvedValue(
        mockCancelledOrder,
      );

      const result = await service.cancelOrder(orderId, clientId);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(result.status).not.toBe(OrderStatus.PENDING);
    });
  });

  describe('paidOrder', () => {
    // ORDER-CP-32
    it('ORDER-CP-32: should update order to PAID when payment is received', async () => {
      const paidOrderDto = {
        orderId: 'order-123',
        stripePaymentId: 'stripe-123',
        receiptUrl: 'https://stripe.com/receipt',
      };

      const mockPaidOrder = {
        ...mockOrder,
        id: 'order-123',
        status: OrderStatus.PAID,
        paid: true,
        paidAt: new Date(),
        stripeChargeId: 'stripe-123',
        orderDetails: mockOrder.orderDetails,
      };

      (service['order'].update as jest.Mock).mockResolvedValue(mockPaidOrder);
      mockNatsClient.send.mockReturnValue(of(null));

      await service.paidOrder(paidOrderDto);

      expect(service['order'].update).toHaveBeenCalledWith({
        where: { id: paidOrderDto.orderId },
        data: expect.objectContaining({
          status: 'PAID',
          paid: true,
          paidAt: expect.any(Date),
          stripeChargeId: 'stripe-123',
        }),
        include: {
          orderDetails: true,
        },
      });
    });

    // ORDER-CP-33
    it('ORDER-CP-33: should save stripeChargeId and paidAt in order', async () => {
      const paidOrderDto = {
        orderId: 'order-123',
        stripePaymentId: 'stripe-456',
        receiptUrl: 'https://stripe.com/receipt',
      };

      const mockPaidOrder = {
        ...mockOrder,
        id: 'order-123',
        status: OrderStatus.PAID,
        paid: true,
        paidAt: new Date('2024-01-01'),
        stripeChargeId: 'stripe-456',
        orderDetails: mockOrder.orderDetails,
      };

      (service['order'].update as jest.Mock).mockResolvedValue(mockPaidOrder);
      mockNatsClient.send.mockReturnValue(of(null));

      await service.paidOrder(paidOrderDto);

      expect(service['order'].update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripeChargeId: 'stripe-456',
            paidAt: expect.any(Date),
          }),
        }),
      );
    });

    // ORDER-CP-34
    it('ORDER-CP-34: should create orderReceipt with receiptUrl', async () => {
      const paidOrderDto = {
        orderId: 'order-123',
        stripePaymentId: 'stripe-123',
        receiptUrl: 'https://stripe.com/receipt/123',
      };

      const mockPaidOrder = {
        ...mockOrder,
        id: 'order-123',
        status: OrderStatus.PAID,
        orderDetails: mockOrder.orderDetails,
      };

      (service['order'].update as jest.Mock).mockResolvedValue(mockPaidOrder);
      mockNatsClient.send.mockReturnValue(of(null));

      await service.paidOrder(paidOrderDto);

      expect(service['order'].update).toHaveBeenCalledWith({
        where: { id: paidOrderDto.orderId },
        data: expect.objectContaining({
          orderReceipt: {
            create: {
              receiptUrl: 'https://stripe.com/receipt/123',
            },
          },
        }),
        include: {
          orderDetails: true,
        },
      });
    });

    // ORDER-CP-35
    it('ORDER-CP-35: should emit order.confirmed event for each orderDetail', async () => {
      const paidOrderDto = {
        orderId: 'order-123',
        stripePaymentId: 'stripe-123',
        receiptUrl: 'https://stripe.com/receipt',
      };

      const mockPaidOrder = {
        ...mockOrder,
        id: 'order-123',
        status: OrderStatus.PAID,
        orderDetails: [
          {
            id: 'detail-1',
            orderId: 'order-123',
            productOfferId: 'prod-1',
            quantity: 2,
            price: 10000,
            subtotal: 20000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'detail-2',
            orderId: 'order-123',
            productOfferId: 'prod-2',
            quantity: 3,
            price: 5000,
            subtotal: 15000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      (service['order'].update as jest.Mock).mockResolvedValue(mockPaidOrder);
      mockNatsClient.send.mockReturnValue(of(null));

      await service.paidOrder(paidOrderDto);

      expect(mockNatsClient.emit).toHaveBeenCalledWith('order.confirmed', {
        productOfferId: 'prod-1',
        quantity: 2,
      });
      expect(mockNatsClient.emit).toHaveBeenCalledWith('order.confirmed', {
        productOfferId: 'prod-2',
        quantity: 3,
      });
      expect(mockNatsClient.emit).toHaveBeenCalledTimes(2);
    });

    // ORDER-CP-36
    it('ORDER-CP-36: should call notifyProducers after updating order', async () => {
      const paidOrderDto = {
        orderId: 'order-123',
        stripePaymentId: 'stripe-123',
        receiptUrl: 'https://stripe.com/receipt',
      };

      const mockPaidOrder = {
        ...mockOrder,
        id: 'order-123',
        clientId: 'client-123',
        status: OrderStatus.PAID,
        orderDetails: mockOrder.orderDetails,
      };

      (service['order'].update as jest.Mock).mockResolvedValue(mockPaidOrder);
      mockNatsClient.send
        .mockReturnValueOnce(of('producer-1')) // product.offer.getProducerId
        .mockReturnValueOnce(of({ id: 'client-123', fullName: 'Test Client' })); // auth.get.user

      await service.paidOrder(paidOrderDto);

      // Verificar que se emiten ambos eventos
      // Primero se emite order.confirmed para cada detail
      expect(mockNatsClient.emit).toHaveBeenCalledWith('order.confirmed', {
        productOfferId: 'prod-1',
        quantity: 2,
      });
      // notifyProducers se ejecuta de forma asíncrona con .catch(), así que esperamos
      await new Promise((resolve) => setImmediate(resolve));
      expect(mockNatsClient.emit).toHaveBeenCalledWith(
        'notification.order.created',
        expect.objectContaining({
          orderId: 'order-123',
          producerIds: ['producer-1'],
        }),
      );
    });

    // ORDER-CP-38
    it('ORDER-CP-38: should throw INTERNAL_SERVER_ERROR if processing fails', async () => {
      const paidOrderDto = {
        orderId: 'order-123',
        stripePaymentId: 'stripe-123',
        receiptUrl: 'https://stripe.com/receipt',
      };

      const dbError = new Error('Database error');
      (service['order'].update as jest.Mock).mockRejectedValue(dbError);

      await expect(service.paidOrder(paidOrderDto)).rejects.toThrow(
        RpcException,
      );

      try {
        await service.paidOrder(paidOrderDto);
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to process paid order',
        });
      }

      expect(service['logger'].error).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    // ORDER-CP-39
    it('ORDER-CP-39: should update order status successfully', async () => {
      const updateStatusDto = {
        orderId: 'order-123',
        status: OrderStatus.DELIVERED,
      };

      const mockExistingOrder = {
        ...mockOrder,
        id: 'order-123',
        status: OrderStatus.PAID,
      };

      const mockUpdatedOrder = {
        ...mockExistingOrder,
        status: OrderStatus.DELIVERED,
        orderDetails: mockExistingOrder.orderDetails,
      };

      (service['order'].findUnique as jest.Mock).mockResolvedValue(
        mockExistingOrder,
      );
      (service['order'].update as jest.Mock).mockResolvedValue(
        mockUpdatedOrder,
      );

      const result = await service.updateStatus(updateStatusDto);

      expect(service['order'].update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: { status: OrderStatus.DELIVERED },
        include: { orderDetails: true },
      });
      expect(result.status).toBe(OrderStatus.DELIVERED);
    });

    // ORDER-CP-40
    it('ORDER-CP-40: should do nothing if status is the same', async () => {
      const updateStatusDto = {
        orderId: 'order-123',
        status: OrderStatus.PAID,
      };

      const mockExistingOrder = {
        ...mockOrder,
        id: 'order-123',
        status: OrderStatus.PAID,
      };

      (service['order'].findUnique as jest.Mock).mockResolvedValue(
        mockExistingOrder,
      );

      const result = await service.updateStatus(updateStatusDto);

      expect(service['order'].update).not.toHaveBeenCalled();
      expect(result).toEqual(mockExistingOrder);
    });

    // ORDER-CP-41
    it('ORDER-CP-41: should emit events according to new status', async () => {
      const updateStatusDto = {
        orderId: 'order-123',
        status: OrderStatus.CANCELLED,
      };

      const mockExistingOrder = {
        ...mockOrder,
        id: 'order-123',
        status: OrderStatus.PENDING,
        orderDetails: [
          {
            id: 'detail-1',
            orderId: 'order-123',
            productOfferId: 'prod-1',
            quantity: 2,
            price: 10000,
            subtotal: 20000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const mockUpdatedOrder = {
        ...mockExistingOrder,
        status: OrderStatus.CANCELLED,
      };

      (service['order'].findUnique as jest.Mock).mockResolvedValue(
        mockExistingOrder,
      );
      (service['order'].update as jest.Mock).mockResolvedValue(
        mockUpdatedOrder,
      );

      await service.updateStatus(updateStatusDto);

      expect(mockNatsClient.emit).toHaveBeenCalledWith('order.cancelled', {
        productOfferId: 'prod-1',
        quantity: 2,
      });
    });

    // ORDER-CP-42
    it('ORDER-CP-42: should throw NOT_FOUND if order does not exist', async () => {
      const updateStatusDto = {
        orderId: 'invalid-order',
        status: OrderStatus.DELIVERED,
      };

      (service['order'].findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.updateStatus(updateStatusDto)).rejects.toThrow(
        RpcException,
      );

      try {
        await service.updateStatus(updateStatusDto);
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          status: HttpStatus.NOT_FOUND,
          message: "Order with id 'invalid-order' not found",
        });
      }
    });
  });

  describe('createPaymentSession', () => {
    // ORDER-CP-43
    it('ORDER-CP-43: should create payment session with product names', async () => {
      const mockOrderForPayment = {
        ...mockOrder,
        id: 'order-123',
        orderDetails: [
          {
            id: 'detail-1',
            orderId: 'order-123',
            productOfferId: 'prod-1',
            quantity: 2,
            price: 10000,
            subtotal: 20000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const mockPaymentSession = {
        id: 'session-123',
        url: 'https://stripe.com/checkout',
      };

      mockNatsClient.send
        .mockReturnValueOnce(of('Producto Test'))
        .mockReturnValueOnce(of(mockPaymentSession));

      const result = await service.createPaymentSession(
        mockOrderForPayment as any,
      );

      expect(mockNatsClient.send).toHaveBeenCalledWith(
        'product.offer.getName',
        'prod-1',
      );
      expect(mockNatsClient.send).toHaveBeenCalledWith(
        'create.payment.session',
        {
          orderId: 'order-123',
          currency: 'COP',
          items: [
            {
              name: 'Producto Test',
              price: 10000,
              quantity: 2,
            },
          ],
        },
      );
      expect(result).toEqual(mockPaymentSession);
    });

    // ORDER-CP-44
    it('ORDER-CP-44: should get product names from Product Service', async () => {
      const mockOrderForPayment = {
        ...mockOrder,
        id: 'order-123',
        orderDetails: [
          {
            id: 'detail-1',
            orderId: 'order-123',
            productOfferId: 'prod-1',
            quantity: 1,
            price: 10000,
            subtotal: 10000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockNatsClient.send
        .mockReturnValueOnce(of('Arroz Orgánico'))
        .mockReturnValueOnce(of({ id: 'session-123' }));

      await service.createPaymentSession(mockOrderForPayment as any);

      expect(mockNatsClient.send).toHaveBeenCalledWith(
        'product.offer.getName',
        'prod-1',
      );
    });

    // ORDER-CP-45
    it('ORDER-CP-45: should use "Producto sin nombre" if name cannot be obtained', async () => {
      const mockOrderForPayment = {
        ...mockOrder,
        id: 'order-123',
        orderDetails: [
          {
            id: 'detail-1',
            orderId: 'order-123',
            productOfferId: 'prod-1',
            quantity: 1,
            price: 10000,
            subtotal: 10000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      // El servicio no usa catchError, así que si falla, lanzará error
      // Pero el código usa || 'Producto sin nombre', así que null debería funcionar
      mockNatsClient.send
        .mockReturnValueOnce(of(null)) // product.offer.getName returns null
        .mockReturnValueOnce(of({ id: 'session-123' }));

      await service.createPaymentSession(mockOrderForPayment as any);

      expect(mockNatsClient.send).toHaveBeenCalledWith(
        'create.payment.session',
        expect.objectContaining({
          items: [
            expect.objectContaining({
              name: 'Producto sin nombre',
            }),
          ],
        }),
      );

      expect(mockNatsClient.send).toHaveBeenCalledWith(
        'create.payment.session',
        {
          orderId: 'order-123',
          currency: 'COP',
          items: [
            {
              name: 'Producto sin nombre',
              price: 10000,
              quantity: 1,
            },
          ],
        },
      );
    });

    // ORDER-CP-46
    it('ORDER-CP-46: should send items with name, price and quantity to Payment Service', async () => {
      const mockOrderForPayment = {
        ...mockOrder,
        id: 'order-123',
        orderDetails: [
          {
            id: 'detail-1',
            orderId: 'order-123',
            productOfferId: 'prod-1',
            quantity: 3,
            price: 15000,
            subtotal: 45000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockNatsClient.send
        .mockReturnValueOnce(of('Producto Test'))
        .mockReturnValueOnce(of({ id: 'session-123' }));

      await service.createPaymentSession(mockOrderForPayment as any);

      expect(mockNatsClient.send).toHaveBeenCalledWith(
        'create.payment.session',
        {
          orderId: 'order-123',
          currency: 'COP',
          items: [
            {
              name: 'Producto Test',
              price: 15000,
              quantity: 3,
            },
          ],
        },
      );
    });
  });

  describe('existsProductOffer', () => {
    // ORDER-CP-48
    it('ORDER-CP-48: should return true if product exists in any order', async () => {
      const productOfferId = 'prod-1';
      const mockOrderDetail = {
        id: 'detail-1',
        orderId: 'order-123',
        productOfferId: 'prod-1',
        quantity: 2,
        price: 10000,
        subtotal: 20000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (service['orderDetails'].findFirst as jest.Mock).mockResolvedValue(
        mockOrderDetail,
      );

      const result = await service.existsProductOffer(productOfferId);

      expect(service['orderDetails'].findFirst).toHaveBeenCalledWith({
        where: { productOfferId },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toBe(true);
    });

    // ORDER-CP-49
    it('ORDER-CP-49: should return false if product does not exist in any order', async () => {
      const productOfferId = 'prod-nonexistent';

      (service['orderDetails'].findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.existsProductOffer(productOfferId);

      expect(result).toBe(false);
    });

    // ORDER-CP-50
    it('ORDER-CP-50: should return false if productOfferId is null or empty', async () => {
      const result1 = await service.existsProductOffer('');
      const result2 = await service.existsProductOffer(
        null as unknown as string,
      );

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(service['logger'].warn).toHaveBeenCalled();
    });

    // ORDER-CP-51
    it('ORDER-CP-51: should throw INTERNAL_SERVER_ERROR on database failure', async () => {
      const productOfferId = 'prod-1';
      const dbError = new Error('Database error');

      (service['orderDetails'].findFirst as jest.Mock).mockRejectedValue(
        dbError,
      );

      await expect(service.existsProductOffer(productOfferId)).rejects.toThrow(
        RpcException,
      );

      try {
        await service.existsProductOffer(productOfferId);
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error al verificar los detalles de la orden',
        });
      }
    });
  });

  describe('existsProductOrderClient', () => {
    // ORDER-CP-52
    it('ORDER-CP-52: should return true if client bought the product', async () => {
      const productOfferId = 'prod-1';
      const clientId = 'client-123';
      const mockOrderDetail = {
        id: 'detail-1',
        orderId: 'order-123',
        productOfferId: 'prod-1',
        quantity: 2,
        price: 10000,
        subtotal: 20000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (service['orderDetails'].findFirst as jest.Mock).mockResolvedValue(
        mockOrderDetail,
      );

      const result = await service.existsProductOrderClient(
        productOfferId,
        clientId,
      );

      expect(service['orderDetails'].findFirst).toHaveBeenCalledWith({
        where: {
          productOfferId,
          order: {
            clientId,
          },
        },
      });
      expect(result).toBe(true);
    });

    // ORDER-CP-53
    it('ORDER-CP-53: should return false if client did not buy the product', async () => {
      const productOfferId = 'prod-1';
      const clientId = 'client-123';

      (service['orderDetails'].findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.existsProductOrderClient(
        productOfferId,
        clientId,
      );

      expect(result).toBe(false);
    });

    // ORDER-CP-54
    it('ORDER-CP-54: should throw INTERNAL_SERVER_ERROR on database failure', async () => {
      const productOfferId = 'prod-1';
      const clientId = 'client-123';
      const dbError = new Error('Database error');

      (service['orderDetails'].findFirst as jest.Mock).mockRejectedValue(
        dbError,
      );

      await expect(
        service.existsProductOrderClient(productOfferId, clientId),
      ).rejects.toThrow(RpcException);

      try {
        await service.existsProductOrderClient(productOfferId, clientId);
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to verify order details',
        });
      }
    });
  });
});
