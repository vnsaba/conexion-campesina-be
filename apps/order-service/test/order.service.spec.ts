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
        delete: jest.fn(),
        count: jest.fn(),
      },
      writable: false,
    });

    Object.defineProperty(service, 'orderDetails', {
      value: {
        findMany: jest.fn(),
      },
      writable: false,
    });

    service['logger'].log = jest.fn();
    service['logger'].error = jest.fn();
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
        address: 'Carrera 50 #20-30',
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
        totalAmount: 35000,
        totalItems: 5,
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

      // Mock NATS responses for product lookups
      mockNatsClient.send
        .mockReturnValueOnce(
          of({ id: 'prod-1', price: 10000, isAvailable: true, name: 'Prod 1' }),
        )
        .mockReturnValueOnce(
          of({ id: 'prod-2', price: 5000, isAvailable: true, name: 'Prod 2' }),
        );

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
        address: 'Avenida 80 #100-50',
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
        status: OrderStatus.PENDING,
      };

      mockNatsClient.send.mockReturnValue(
        of({ id: 'prod-1', price: 10000, isAvailable: true }),
      );
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
        address: 'Calle 50 #10-20',
        orderDetails: [
          {
            productOfferId: 'invalid-prod-id',
            quantity: 1,
            price: 10000,
          },
        ],
      };

      mockNatsClient.send.mockReturnValue(of(null));

      await expect(service.create(clientId, createOrderDto)).rejects.toThrow(
        RpcException,
      );

      try {
        await service.create(clientId, createOrderDto);
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          status: HttpStatus.BAD_REQUEST,
          message: expect.stringContaining(
            'Los siguientes productos no existen',
          ),
        });
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
        address: 'Calle 123 #45-67',
        orderDetails: [
          {
            productOfferId: 'prod-1',
            quantity: 0,
            price: 10000,
          },
        ],
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
          message: 'Quantity must be greater than zero',
        });
      }

      expect(service['order'].create).not.toHaveBeenCalled();
      expect(mockNatsClient.send).not.toHaveBeenCalled();
    });

    // ORDER-CP-06
    it('ORDER-CP-06: should throw BAD_REQUEST when quantity is negative', async () => {
      const clientId = 'client-123';
      const createOrderDto = {
        address: 'Calle 123 #45-67',
        orderDetails: [
          {
            productOfferId: 'prod-1',
            quantity: -5,
            price: 10000,
          },
        ],
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
          message: 'Quantity must be greater than zero',
        });
      }

      expect(service['order'].create).not.toHaveBeenCalled();
      expect(mockNatsClient.send).not.toHaveBeenCalled();
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

      const result = await service.findByClientId('client-123');

      expect(service['order'].findMany).toHaveBeenCalledWith({
        where: { clientId: 'client-123' },
        include: {
          orderDetails: true,
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
        .mockReturnValueOnce(of(mockClients[1]));

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
        .mockReturnValueOnce(of({ id: 'client-1', fullName: 'Test Client' }));

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
        .mockReturnValueOnce(throwError(() => new Error('Client not found')));

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
        .mockReturnValueOnce(of({ id: 'client-1', fullName: 'Test Client' }));

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
});
