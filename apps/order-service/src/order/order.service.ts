import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import {
  OrderDetails,
  OrderStatus,
  PrismaClient,
} from '../../generated/prisma';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { firstValueFrom } from 'rxjs';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrderService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('OrderService');

  constructor(
    @Inject(process.env.NATS_SERVICE_KEY || 'NATS_SERVICE')
    private readonly natsClient: ClientProxy,
  ) {
    super();
  }

  /**
   * Initializes the module by connecting to the database
   * @returns Promise that resolves when the database connection is established
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  /**
   * Creates a new order with automatically calculated totals
   * Orders are always created with PENDING status
   *
   * @param clientId - The ID of the client creating the order
   * @param createOrderDto - Data transfer object containing order details and address
   * @returns Promise resolving to the created order with its details
   * @throws {RpcException} BAD_REQUEST if product offers don't exist
   * @throws {RpcException} INTERNAL_SERVER_ERROR if order creation fails
   */
  async create(clientId: string, createOrderDto: CreateOrderDto) {
    const { address, orderDetails } = createOrderDto;

    try {
      if (!orderDetails || orderDetails.length === 0) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'Order must contain at least one product',
        });
      }

      for (const detail of orderDetails) {
        if (detail.quantity <= 0) {
          throw new RpcException({
            status: HttpStatus.BAD_REQUEST,
            message: 'Quantity must be greater than zero',
          });
        }

        if (detail.price <= 0) {
          throw new RpcException({
            status: HttpStatus.BAD_REQUEST,
            message: 'Price must be greater than zero',
          });
        }
      }

      const productOfferIds = orderDetails.map(
        (detail) => detail.productOfferId,
      );

      const validation = await firstValueFrom(
        this.natsClient.send('product.offer.validateMany', productOfferIds),
      );

      if (!validation.valid) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: `The following products do not exist: ${validation.missingIds.join(', ')}`,
        });
      }

      let totalAmount = 0;
      let totalItems = 0;
      const processedOrderDetails: Array<{
        productOfferId: string;
        quantity: number;
        price: number;
        subtotal: number;
      }> = [];

      for (const detail of orderDetails) {
        const subtotal = detail.quantity * detail.price;
        totalAmount += subtotal;
        totalItems += detail.quantity;

        processedOrderDetails.push({
          productOfferId: detail.productOfferId,
          quantity: detail.quantity,
          price: detail.price,
          subtotal: subtotal,
        });
      }

      const order = await this.order.create({
        data: {
          clientId,
          status: 'PENDING',
          address,
          totalAmount,
          totalItems,
          orderDetails: {
            create: processedOrderDetails,
          },
        },
        include: {
          orderDetails: true,
        },
      });
      this.publishOrderPendingEvents(order.orderDetails);
      return order;
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      this.logger.error('Failed to create order', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to create order',
      });
    }
  }
  private publishOrderPendingEvents(orderDetails: OrderDetails[]) {
    for (const detail of orderDetails) {
      const data = {
        productOfferId: detail.productOfferId,
        quantity: detail.quantity,
      };
      this.natsClient.emit('order.pending', data);
    }
  }

  /**
   * Retrieves all orders with pagination and optional status filtering
   *
   * @param orderPaginationDto - Pagination parameters including page, limit, and optional status filter
   * @returns Promise resolving to paginated orders with metadata (total, page, lastPage)
   * @throws {RpcException} INTERNAL_SERVER_ERROR if fetching orders fails
   */
  async findAll(orderPaginationDto: OrderPaginationDto) {
    try {
      const totalPages = await this.order.count({
        where: {
          status: orderPaginationDto.status,
        },
      });

      const currentPage = orderPaginationDto.page ?? 1;
      const perPage = orderPaginationDto.limit ?? 10;

      return {
        data: await this.order.findMany({
          skip: (currentPage - 1) * perPage,
          take: perPage,
          where: {
            status: orderPaginationDto.status,
          },
          include: {
            orderDetails: true,
          },
          orderBy: { orderDate: 'desc' },
        }),
        meta: {
          total: totalPages,
          page: currentPage,
          lastPage: Math.ceil(totalPages / perPage),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch all orders', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch all orders',
      });
    }
  }

  /**
   * Retrieves a single order by its ID
   *
   * @param id - The unique identifier of the order
   * @returns Promise resolving to the order with its details
   * @throws {RpcException} NOT_FOUND if order doesn't exist
   * @throws {RpcException} INTERNAL_SERVER_ERROR if fetching order fails
   */
  async findOne(id: string) {
    try {
      const order = await this.order.findUnique({
        where: { id },
        include: {
          orderDetails: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Order with id '${id}' not found`);
      }

      return order;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: error.message,
        });
      }

      this.logger.error(`Error fetching order ${id}`, error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch order',
      });
    }
  }

  /**
   * Deletes an order by its ID
   *
   * @param id - The unique identifier of the order to delete
   * @returns Promise resolving to a confirmation message and the deleted order ID
   * @throws {RpcException} NOT_FOUND if order doesn't exist
   * @throws {RpcException} INTERNAL_SERVER_ERROR if deleting order fails
   */
  async remove(id: string) {
    try {
      const existingOrder = await this.findOne(id);

      if (!existingOrder) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `Order with id '${id}' not found`,
        });
      }

      await this.order.delete({ where: { id } });

      this.logger.log(`Order deleted successfully: ${id}`);
      return { message: 'Order deleted successfully', id };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      this.logger.error(`Failed to delete order ${id}`, error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to delete order',
      });
    }
  }

  /**
   * Retrieves all orders for a specific client
   *
   * @param clientId - The unique identifier of the client
   * @returns Promise resolving to an array of orders with their details, sorted by date descending
   * @throws {RpcException} INTERNAL_SERVER_ERROR if fetching client orders fails
   */
  async findByClientId(clientId: string) {
    try {
      return await this.order.findMany({
        where: { clientId },
        include: {
          orderDetails: true,
        },
        orderBy: { orderDate: 'desc' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch orders for client ${clientId}`,
        error.stack,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch client orders',
      });
    }
  }

  /**
   * Retrieves all orders containing products offered by a specific producer
   *
   * @param producerId - The unique identifier of the producer
   * @returns Promise resolving to an array of orders with their details
   * @throws {RpcException} INTERNAL_SERVER_ERROR if fetching producer orders fails
   */
  async findByProducerId(producerId: string) {
    try {
      const productOffers = await firstValueFrom(
        this.natsClient.send('product.offer.findAllProducer', producerId),
      );

      if (!productOffers || productOffers.length === 0) {
        return [];
      }

      const productOfferIds = productOffers
        .map((offer: { id: string }) => offer.id)
        .filter(Boolean);

      if (productOfferIds.length === 0) {
        return [];
      }

      const orders = await this.order.findMany({
        where: {
          status: 'PAID',
          orderDetails: {
            some: {
              productOfferId: {
                in: productOfferIds,
              },
            },
          },
        },
        include: {
          orderDetails: true,
        },
        orderBy: { orderDate: 'desc' },
      });

      return orders.map((order) => ({
        ...order,
        orderDetails: order.orderDetails.filter((detail) =>
          productOfferIds.includes(detail.productOfferId),
        ),
      }));
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      this.logger.error(
        `Failed to fetch orders for producer ${producerId}`,
        (error as Error).stack,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch producer orders',
      });
    }
  }

  /**
   * Retrieves all order details (items) for a specific order
   *
   * @param orderId - The unique identifier of the order
   * @returns Promise resolving to an array of order details sorted by creation date ascending
   * @throws {RpcException} NOT_FOUND if order doesn't exist
   * @throws {RpcException} INTERNAL_SERVER_ERROR if fetching order details fails
   */
  async getOrderDetails(orderId: string) {
    try {
      const existingOrder = await this.findOne(orderId);
      if (!existingOrder) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Order not found',
        });
      }

      const orderDetails = await this.orderDetails.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });

      return orderDetails;
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      this.logger.error(
        `Failed to fetch order details for order ${orderId}`,
        error.stack,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch order details',
      });
    }
  }

  async existsProductOffer(productOfferId: string): Promise<boolean> {
    try {
      const orderDetail = await this.orderDetails.findFirst({
        where: { productOfferId },
        orderBy: { createdAt: 'asc' },
      });

      return !!orderDetail; // true si existe, false si no
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      this.logger.error(
        `Error al verificar si el producto '${productOfferId}' existe en alguna orden`,
        (error as Error).stack,
      );

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al verificar los detalles de la orden',
      });
    }
  }

  async updateStatus(updateStatus: UpdateOrderStatusDto) {
    try {
      const { orderId, status } = updateStatus;

      const existingOrder = await this.findOne(orderId);

      const updatedOrder = await this.order.update({
        where: { id: existingOrder.id },
        data: { status },
        include: { orderDetails: true },
      });
      this.publishOrderStatusEvents(status, updatedOrder.orderDetails);
      return updatedOrder;
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
    }
  }

  private publishOrderStatusEvents(
    status: OrderStatus,
    orderDetails: OrderDetails[],
  ) {
    const detailEventMap = {
      PAID: 'order.confirmed',
      CANCELLED: 'order.cancelled',
    };
    const eventName = detailEventMap[status];
    for (const detail of orderDetails) {
      this.natsClient.emit(eventName, {
        productOfferId: detail.productOfferId,
        quantity: detail.quantity,
      });
    }
  }
}
