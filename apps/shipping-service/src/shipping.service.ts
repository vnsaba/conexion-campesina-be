import {
  Injectable,
  Logger,
  OnModuleInit,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { PrismaClient } from '../generated/prisma';
import { catchError, firstValueFrom, of } from 'rxjs';

@Injectable()
export class ShippingService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('ShippingService');

  constructor(
    @Inject(process.env.NATS_SERVICE_KEY || 'NATS_SERVICE')
    private readonly natsClient: ClientProxy,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async create(idOrder: string) {
    try {
      // 1. Obtener orden
      const order = await firstValueFrom(
        this.natsClient.send('order.findOne', idOrder).pipe(
          catchError((err) => {
            throw new RpcException({
              status: HttpStatus.SERVICE_UNAVAILABLE,
              message: `Error communicating with Order Service: ${err.message}`,
            });
          }),
        ),
      );

      if (!order) throw new RpcException('Order not found');

      const clientId = order.clientId;
      const addressShipping = order.address;
      const itemsOrder = order.orderDetails;
      const totalAmount = order.totalAmount;

      // Verificar si ya existe un comprobante para esta orden
      const existingReceipt = await this.findReceiptByOrder(idOrder);
      if (existingReceipt) {
        throw new RpcException({
          status: HttpStatus.CONFLICT,
          message: 'Shipping receipt already exists for this order',
        });
      }

      // 2. Obtener cliente
      const client = await firstValueFrom(
        this.natsClient.send('auth.get.user', clientId).pipe(
          catchError(() =>
            of({
              id: clientId,
              fullName: 'Unknown Client',
              document: '0000',
              phone: '000',
            }),
          ),
        ),
      );

      // 3. Construir items con productOffer
      const items = await Promise.all(
        itemsOrder.map(async (item) => {
          const productOffer = await firstValueFrom(
            this.natsClient
              .send('product.offer.findOne', item.productOfferId)
              .pipe(
                catchError(() =>
                  of({
                    producerId: 'UNKNOWN_PRODUCER',
                    name: 'Unknown Product',
                    unit: 'unit',
                  }),
                ),
              ),
          );

          return {
            productName: productOffer.name,
            quantity: item.quantity,
            unit: productOffer.unit,
            weight: productOffer.weight ?? 0,
            producerId: productOffer.producerId,
          };
        }),
      );

      // 4. Crear número de comprobante
      const receiptNumber = `RCPT-${Date.now()}`;
      const remesaNumber = `REM-${Math.random().toString(36).substring(2, 8)}`;
      // 5. Crear ShippingReceipt en DB
      const shippingReceipt = await this.shippingReceipt.create({
        data: {
          orderId: idOrder,

          // Remitente fijo
          senderName: 'Conexión Campesina',
          senderId: '901234567',
          senderIdType: 'NIT',
          senderAddress: 'Medellín, Antioquia',
          senderPhone: '+57 3000000000',

          // Destinatario
          recipientName: client.fullName,
          recipientId: client.document ?? '0000',
          recipientIdType: 'CC',
          recipientAddress: addressShipping,
          recipientPhone: client.phone ?? '000',

          // Transportadora
          carrierName: 'Transportadora Genérica',
          carrierId: 'NIT 800123123',
          vehiclePlate: 'ABC123',

          // Datos de comprobante
          receiptNumber,
          dispatchDate: new Date(),
          declaredValue: totalAmount,
          shippingCost: totalAmount * 0.05,
          subtotal: totalAmount,
          total: totalAmount * 1.05,
          remesaNumber,

          // Auditoría
          digitalSignature: 'SystemSignature',
          generatedBy: 'SYSTEM',

          ownerClientId: clientId,

          // Crear items
          items: {
            create: items.map((i) => ({
              productName: i.productName,
              quantity: i.quantity,
              unit: i.unit,
              weight: i.weight,
            })),
          },
        },
        include: { items: true },
      });

      return shippingReceipt;
    } catch (error) {
      this.logger.error(error);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create shipping receipt',
      });
    }
  }

  findOne(id: string) {
    return `This action returns a #${id} shipping`;
  }

  async generateShippingDocument(orderId: string) {
    try {
      const receipt = await this.shippingReceipt.findFirst({
        where: { orderId: orderId },
        include: { items: true },
      });

      if (!receipt) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Shipping receipt not found for this order',
        });
      }
      // Lógica para generar el documento PDF usando los datos del comprobante
      return Buffer.from('PDF binary data here');
    } catch (error) {
      this.logger.error(error);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to generate shipping document',
      });
    }
  }

  async findReceiptByOrder(idOrder: string) {
    try {
      const receipt = await this.shippingReceipt.findFirst({
        where: { orderId: idOrder },
        include: { items: true },
      });
      return receipt;
    } catch (error) {
      this.logger.error('Error fetching receipt by order', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch receipt by order',
      });
    }
  }
}
