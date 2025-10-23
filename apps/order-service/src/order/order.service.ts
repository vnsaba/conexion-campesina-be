import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  HttpStatus,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaClient } from '../../generated/prisma';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderPaginationDto } from './dto/order-pagination.dto';

@Injectable()
export class OrderService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('OrderService');

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  /**
   * Crea una nueva orden con el total calculado automaticamente
   */
  async create(createOrderDto: CreateOrderDto) {
    const { clientId, status, address, orderDetails } = createOrderDto;

    try {
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
          status: status || 'PENDING',
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

      this.logger.log(`Orden creada correctamente: ${order.id}`);
      return order;
    } catch (error) {
      this.logger.error('Error al crear la orden', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al crear la orden',
      });
    }
  }

  /**
   * Obtiene todas las ordenes
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
      this.logger.error('Error al obtener todas las ordenes', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al obtener todas las ordenes',
      });
    }
  }

  /**
   * Obtiene una orden por su ID
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
        throw new NotFoundException(`Orden con id '${id}' no encontrada`);
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
   * Actualiza una orden (incluyendo orderDetails si se proporcionan)
   */
  async update(id: string, updateOrderDto: UpdateOrderDto) {
    try {
      if (Object.keys(updateOrderDto).length === 0) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'Al menos un campo debe ser proporcionado para actualizar',
        });
      }

      const existingOrder = await this.findOne(id);

      if (!existingOrder) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Orden no encontrada',
        });
      }

      const orderUpdateData: any = {};
      if (updateOrderDto.status) {
        orderUpdateData.status = updateOrderDto.status;
      }
      if (updateOrderDto.address) {
        orderUpdateData.address = updateOrderDto.address;
      }
      if (updateOrderDto.clientId) {
        orderUpdateData.clientId = updateOrderDto.clientId;
      }

      if (
        updateOrderDto.orderDetails &&
        updateOrderDto.orderDetails.length > 0
      ) {
        await this.orderDetails.deleteMany({
          where: { orderId: id },
        });

        let newTotalAmount = 0;
        let newTotalItems = 0;

        for (const detail of updateOrderDto.orderDetails) {
          const subtotal = detail.quantity * detail.price;
          newTotalAmount += subtotal;
          newTotalItems += detail.quantity;

          await this.orderDetails.create({
            data: {
              orderId: id,
              productOfferId: detail.productOfferId,
              quantity: detail.quantity,
              price: detail.price,
              subtotal: subtotal,
            },
          });
        }

        orderUpdateData.totalAmount = newTotalAmount;
        orderUpdateData.totalItems = newTotalItems;
      }

      const updatedOrder = await this.order.update({
        where: { id },
        data: orderUpdateData,
        include: {
          orderDetails: true,
        },
      });

      this.logger.log(`Orden actualizada correctamente: ${id}`);
      return updatedOrder;
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      this.logger.error(`Error al actualizar la orden ${id}`, error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al actualizar la orden',
      });
    }
  }

  /**
   * Elimina una orden
   */
  async remove(id: string) {
    try {
      const existingOrder = await this.findOne(id);

      if (!existingOrder) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `Orden con id '${id}' no encontrada`,
        });
      }

      await this.order.delete({ where: { id } });

      this.logger.log(`Orden eliminada correctamente: ${id}`);
      return { message: 'Orden eliminada correctamente', id };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      this.logger.error(`Error al eliminar la orden ${id}`, error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al eliminar la orden',
      });
    }
  }

  /**
   * Obtiene las ordenes por el ID del cliente
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
        `Error al obtener las ordenes del cliente ${clientId}`,
        error.stack,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al obtener las ordenes del cliente',
      });
    }
  }

  /**
   * Obtiene todos los detalles de una orden
   */
  async getOrderDetails(orderId: string) {
    try {
      const existingOrder = await this.findOne(orderId);
      if (!existingOrder) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Orden no encontrada',
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
        `Error al obtener los detalles de la orden ${orderId}`,
        error.stack,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al obtener los detalles de la orden',
      });
    }
  }
}
