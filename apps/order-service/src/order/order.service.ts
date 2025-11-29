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
import { catchError, of } from 'rxjs';
import { OrderWithProducts } from './interfaces/order-with-product.interface';
import { PaidOrderDto } from './dto/paid-order.dto';

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

    if (!orderDetails || orderDetails.length === 0) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Order must contain at least one product',
      });
    }

    try {
      // 1. Obtener los IDs de los productos solicitados
      const productOfferIds = orderDetails.map((detail) => {
        if (detail.quantity <= 0) {
          throw new RpcException({
            status: HttpStatus.BAD_REQUEST,
            message: 'Quantity must be greater than zero',
          });
        }
        return detail.productOfferId;
      });

      // 2. Traer la información REAL de los productos desde el Microservicio de Catálogo
      const products: any[] = await Promise.all(
        productOfferIds.map((id) =>
          firstValueFrom(
            this.natsClient.send('product.offer.findOne', id).pipe(
              catchError(() => {
                this.logger.warn(`Producto no encontrado: ${id}`);
                return of(null);
              }),
            ),
          ),
        ),
      );

      // 3. Validar que todos los productos existan
      // Si alguno es null, significa que no existe en el catálogo
      const missingProducts = products
        .map((p, index) => (p ? null : productOfferIds[index]))
        .filter((id) => id !== null);

      if (missingProducts.length > 0) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: `Los siguientes productos no existen o no están disponibles: ${missingProducts.join(', ')}`,
        });
      }

      const unavailableProducts = products.filter((p) => !p.isAvailable);
      if (unavailableProducts.length > 0) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: `Los siguientes productos no están disponibles para venta: ${unavailableProducts.map((p) => p.name).join(', ')}`,
        });
      }

      // 5. Calcular totales usando el PRECIO REAL (de la BD, no del usuario)
      let totalAmount = 0;
      let totalItems = 0;

      const processedOrderDetails = orderDetails.map((detail) => {
        // Buscamos el producto real correspondiente a este detalle
        const product = products.find((p) => p.id === detail.productOfferId);

        // Aquí tomamos el precio real
        const realPrice = product.price;
        const subtotal = detail.quantity * realPrice;

        totalAmount += subtotal;
        totalItems += detail.quantity;

        return {
          productOfferId: detail.productOfferId,
          quantity: detail.quantity,
          price: realPrice, // Guardamos el precio histórico real
          subtotal: subtotal,
        };
      });

      // 6. Guardar la orden en la Base de Datos
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

      // 7. Publicar eventos
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
          orderReceipt: true,
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

      const uniqueClientIds = [
        ...new Set(orders.map((order) => order.clientId)),
      ];

      const clientPromises = uniqueClientIds.map((clientId) =>
        firstValueFrom(
          this.natsClient.send('auth.get.user', clientId).pipe(
            catchError(() =>
              of({
                id: clientId,
                fullName: 'Unknown Client',
              }),
            ),
          ),
        ),
      );

      const clients = await Promise.all(clientPromises);

      const clientMap = new Map<string, string>();
      clients.forEach((client: { id: string; fullName: string }) => {
        clientMap.set(client.id, client.fullName);
      });

      return orders.map((order) => ({
        ...order,
        clientName: clientMap.get(order.clientId) || 'Unknown Client',
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
    //1. busca la orden
    const { orderId, status } = updateStatus;
    const existingOrder = await this.findOne(orderId);

    if (existingOrder.status === status) {
      return existingOrder; // No hacer nada si el estado es el mismo
    }

    // 2. Actualizas en Base de Datos
    const updatedOrder = await this.order.update({
      where: { id: orderId },
      data: { status },
      include: { orderDetails: true },
    });

    // 3. Avisas a los otros microservicios (Inventario)
    this.publishOrderStatusEvents(status, updatedOrder.orderDetails);

    return updatedOrder;
  }

  private publishOrderStatusEvents(
    status: OrderStatus,
    orderDetails: OrderDetails[],
  ) {
    const detailEventMap = {
      CANCELLED: 'order.cancelled',
    };
    const eventName = detailEventMap[status];

    if (!eventName) {
      return;
    }

    for (const detail of orderDetails) {
      this.natsClient.emit(eventName, {
        productOfferId: detail.productOfferId,
        quantity: detail.quantity,
      });
    }
  }

  async createPaymentSession(order: OrderWithProducts) {
    // Usa el tipo correcto OrderWithProducts
    // 1. Obtenemos los nombres de los productos correctamente usando Promise.all
    const items = await Promise.all(
      order.orderDetails.map(async (item) => {
        const productName = await firstValueFrom(
          this.natsClient.send('product.offer.getName', item.productOfferId),
        );
        return {
          name: productName || 'Producto sin nombre',
          price: item.price,
          quantity: item.quantity,
        };
      }),
    );

    // 2. Enviamos a Payment Service
    const paymentSession = await firstValueFrom(
      this.natsClient.send('create.payment.session', {
        orderId: order.id,
        currency: 'COP',
        items: items,
      }),
    );

    return paymentSession;
  }

  async paidOrder(paidOrderDto: PaidOrderDto) {
    this.logger.log(`Procesando pago para orden: ${paidOrderDto.orderId}`);

    const updatedOrder = await this.order.update({
      where: { id: paidOrderDto.orderId },
      data: {
        status: 'PAID',
        paid: true,
        paidAt: new Date(),
        stripeChargeId: paidOrderDto.stripePaymentId,
        orderReceipt: {
          create: {
            receiptUrl: paidOrderDto.receiptUrl,
          },
        },
      },
      include: {
        orderDetails: true,
      },
    });

    // 2. Avisar al inventario (usando los detalles que ya trajimos)
    this.publishOrderStatusEvents('PAID', updatedOrder.orderDetails);

    // 3. Notificar a productores sobre la orden pagada
    this.notifyProducers(
      updatedOrder,
      updatedOrder.orderDetails,
      updatedOrder.clientId,
    ).catch((error) => {
      this.logger.warn(
        `Failed to send notifications for order ${updatedOrder.id}`,
        error,
      );
    });

    this.logger.log(
      `Orden ${updatedOrder.id} actualizada a PAID y notificada a inventario`,
    );
  }

  /**
   * Regenera la sesión de pago para una orden existente.
   */
  async retryPayment(orderId: string) {
    const order = await this.findOne(orderId);

    if (order.status === 'PAID') {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Order is already paid',
      });
    }

    if (order.status === 'CANCELLED') {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Order is cancelled',
      });
    }

    const paymentSession = await this.createPaymentSession(order);

    return paymentSession;
  }

  /**
   * Notifies producers about a new paid order containing their products
   * @param order - The paid order
   * @param orderDetails - The order details
   * @param clientId - The ID of the client who placed the order
   */
  private async notifyProducers(
    order: OrderWithProducts,
    orderDetails: OrderDetails[],
    clientId: string,
  ): Promise<void> {
    const uniqueProductOfferIds = [
      ...new Set(orderDetails.map((detail) => detail.productOfferId)),
    ];

    const producerPromises = uniqueProductOfferIds.map((productOfferId) =>
      firstValueFrom(
        this.natsClient
          .send('product.offer.getProducerId', productOfferId)
          .pipe(catchError(() => of(null))),
      ),
    );

    const producerIds = await Promise.all(producerPromises);
    const uniqueProducerIds = [
      ...new Set(producerIds.filter((id) => id !== null)),
    ];

    if (uniqueProducerIds.length === 0) {
      return;
    }

    const clientInfo = await firstValueFrom(
      this.natsClient
        .send('auth.get.user', clientId)
        .pipe(catchError(() => of({ fullName: 'Unknown Client' }))),
    );

    this.natsClient.emit('notification.order.created', {
      orderId: order.id,
      producerIds: uniqueProducerIds,
      clientName: clientInfo.fullName || 'Unknown Client',
      totalAmount: order.totalAmount,
      productCount: order.totalItems,
      orderDate: order.orderDate,
    });
  }
}
