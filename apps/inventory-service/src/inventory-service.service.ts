import { Inject, Injectable, Logger } from '@nestjs/common';
import { Inventory } from '../generated/prisma';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { ClientProxy } from '@nestjs/microservices';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { firstValueFrom } from 'rxjs';
import { UnitConverterService } from './UnitConverterService';
import { RpcError } from '../../../libs/helpers/rcp-error.helpers';
import { PrismaService } from '../provider/prisma.service';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @Inject('NATS_SERVICE') private readonly natsClient: ClientProxy,
    private readonly prisma: PrismaService,
    private readonly unitConverter: UnitConverterService,
  ) {}

  /**
   * Crea un nuevo registro de inventario asociado a una oferta de producto y un productor.
   * - Valida que el productor exista (vía NATS al MS de Auth)
   * - Valida que la oferta de producto exista (vía NATS al MS de ProductOffers)
   * - Asegura que no exista un inventario con la misma dupla productOffer + producer
   *
   * @param createInventory - DTO con los datos de creación del inventario
   * @returns El registro de inventario creado
   * @throws RpcError si las validaciones fallan o la operación de BD falla
   */
  async create(producerId: string, createInventory: CreateInventoryDto) {
    try {
      const {
        productOfferId,
        available_quantity,
        unit,
        minimum_threshold,
        maximum_capacity,
      } = createInventory;
      if (available_quantity < 0 || maximum_capacity < 1) {
        throw RpcError.badRequest('avaliable_quantity must be >= 0');
      }

      if (maximum_capacity < 1) {
        throw RpcError.badRequest('maximum_capacity must be >= 1');
      }

      if (maximum_capacity < available_quantity) {
        throw RpcError.badRequest(
          'maximum_capacity must be >= available_quantity',
        );
      }

      this.logger.log('producerId: ' + producerId);
      const producer = this.natsClient.send('auth.get.user', producerId);

      if (!producer) {
        throw RpcError.notFound(`Producer with id '${producerId}' not found`);
      }

      const productOffer = await firstValueFrom(
        this.natsClient.send('product.offer.findOne', productOfferId),
      );

      if (!productOffer)
        throw RpcError.notFound(
          `Product Offer with id '${productOfferId}' not found`,
        );

      const existingInventory = await this.prisma.inventory.findFirst({
        where: { productOfferId, producerId },
      });

      if (existingInventory)
        throw RpcError.internal(
          'Inventory for this Product Offer and Producer already exists',
        );
      const inventory = await this.prisma.inventory.create({
        data: {
          producerId,
          productOfferId,
          available_quantity,
          unit,
          minimum_threshold,
          maximum_capacity,
        },
      });

      return inventory;
    } catch (error) {
      RpcError.handle(
        this.logger,
        'InventoryService',
        error,
        'Failed to create inventory',
      );
    }
  }

  /**
   * Obtiene todos los registros de inventario existentes en el sistema.
   *
   * @returns Un arreglo con todos los registros de inventario
   * @throws RpcError si la operación de BD falla
   */
  async findAll() {
    try {
      const findAll = await this.prisma.inventory.findMany();
      if (!findAll) {
        throw RpcError.notFound('No inventories found');
      }
      return findAll;
    } catch (error) {
      RpcError.handle(
        this.logger,
        'InventoryService',
        error,
        'Failed to retrieve inventories',
      );
    }
  }

  /**
   * Busca y devuelve todos los inventarios que pertenecen a un productor específico.
   *
   * @param producerId - El ID único del productor
   * @returns Un arreglo con los inventarios encontrados para ese productor
   * @throws RpcError si la operación de BD falla
   */
  async findByProducer(producerId: string) {
    try {
      const existingProducer = await firstValueFrom(
        this.natsClient.send('auth.get.user', producerId),
      );

      if (!existingProducer) {
        throw RpcError.notFound(`Producer with id '${producerId}' not found`);
      }

      const inventories = await this.prisma.inventory.findMany({
        where: { producerId },
      });

      return inventories;
    } catch (error) {
      RpcError.handle(
        this.logger,
        'InventoryService',
        error,
        'Failed to retrieve inventories by producer',
      );
    }
  }

  /**
   * Busca un registro de inventario basándose en el ID de la oferta de producto (productOfferId).
   * Este método asume que solo existe un inventario por cada oferta de producto.
   *
   * @param productOfferId - El ID único de la oferta de producto
   * @returns El registro de inventario encontrado
   * @throws RpcError (NotFound) si no se encuentra ningún inventario para esa oferta
   */
  async findByProductOffer(productOfferId: string) {
    try {
      const inventory = await this.prisma.inventory.findFirst({
        where: { productOfferId },
      });
      if (!inventory)
        throw RpcError.notFound(
          `Inventory with product offer id '${productOfferId}' not found`,
        );
      return inventory;
    } catch (error) {
      RpcError.handle(
        this.logger,
        'InventoryService',
        error,
        'Failed to retrieve inventories by product offer',
      );
    }
  }

  /**
   * Busca un registro de inventario por su ID único del inventario.
   *
   * @param id - El ID único  del registro de inventario
   * @returns El registro de inventario encontrado
   * @throws RpcError (NotFound) si no se encuentra el inventario
   */
  async findOne(id: string) {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { id },
      });

      if (!inventory) {
        throw RpcError.notFound(`Inventory with id '${id}' not found`);
      }
      return inventory;
    } catch (error) {
      RpcError.handle(
        this.logger,
        'InventoryService',
        error,
        'Failed to retrieve inventory',
      );
    }
  }

  /**
   * (Método Obrero) Ejecuta la actualización pura en la base de datos.
   * Actualiza los campos 'available_quantity' y/o 'minimum_threshold'.
   * No maneja efectos secundarios (eventos, logs de stock).
   *
   * @param id - El ID del inventario a actualizar
   * @param updateInventory - DTO con los campos a actualizar
   * @returns El registro de inventario actualizado
   * @throws RpcError si el inventario no se encuentra o la BD falla
   */
  async updateBase(id: string, updateInventory: UpdateInventoryDto) {
    try {
      const { available_quantity, minimum_threshold } = updateInventory;

      const inventory = await this.findOne(id);

      return await this.prisma.inventory.update({
        where: { id: inventory!.id },
        data: {
          ...(available_quantity !== undefined && { available_quantity }),
          ...(minimum_threshold !== undefined && { minimum_threshold }),
        },
      });
    } catch (error) {
      RpcError.handle(
        this.logger,
        'InventoryService',
        error,
        'Failed to update inventory',
      );
    }
  }

  /**
   * (Método Orquestador) Maneja el caso de uso completo de actualizar un inventario.
   * Útil cuando un productor añade stock manualmente.
   *
   * @description
   * 1. Llama a `updateBase` para actualizar la base de datos.
   * 2. Llama a `checkLowStock` para verificar si se debe emitir una alerta de stock bajo.
   * 3. Llama a `productAvailability` para sincronizar el estado (disponible/agotado) con el MS de Productos.
   *
   * @param id - El ID del inventario a actualizar
   * @param updateInventory - DTO con los campos a actualizar
   * @returns El registro de inventario actualizado
   * @throws RpcError si `updateBase` falla
   */
  async update(id: string, updateInventory: UpdateInventoryDto) {
    try {
      const updatedInventory = await this.updateBase(id, updateInventory);

      if (updatedInventory) {
        this.checkLowStock(updatedInventory);
        this.productAvailability(updatedInventory);
      }

      return updatedInventory;
    } catch (error) {
      RpcError.handle(
        this.logger,
        'InventoryService',
        error,
        'Failed to update inventory',
      );
    }
  }

  /**
   * Elimina un registro de inventario.
   *
   * @description
   * 1. Busca el inventario por su ID.
   * 2. Valida (vía NATS) que la 'ProductOffer' asociada ya no exista.
   * 3. Lanza un error si la oferta de producto aún existe, para prevenir la eliminación de un inventario activo.
   * 4. Elimina el registro de inventario de la BD.
   *
   * @param id - El ID del inventario a eliminar
   * @returns void
   * @throws RpcError si el inventario no se encuentra, si la oferta de producto aún existe, o si la BD falla
   */
  async remove(id: string) {
    try {
      const inventory = await this.findOne(id);
      if (!inventory)
        throw RpcError.notFound(`Inventory with id '${id}' not found`);

      const exitingInProduct = await firstValueFrom(
        this.natsClient.send('product.offer.findOne', inventory.productOfferId),
      );
      if (exitingInProduct) {
        throw RpcError.internal(
          `Cannot delete inventory with id '${id}' as it is associated with an existing product offer`,
        );
      }

      await this.prisma.inventory.delete({ where: { id } });
    } catch (error) {
      RpcError.handle(
        this.logger,
        'InventoryService',
        error,
        'Failed to remove inventory',
      );
    }
  }

  /**
   * [Manejador de Evento] Reacciona al evento 'order.paid'.
   * Completa la "venta" del stock.
   *
   * @description
   * 1. Valida que haya stock suficiente (disponible < solicitado).
   * 2. Decrementa `reserved_quantity` (libera la reserva).
   * 3. Decrementa `available_quantity` (descuenta el stock real vendido).
   * 4. Llama a `checkLowStock` y `productAvailability` para reflejar el nuevo stock.
   *
   * @param productOfferId - ID del producto en la orden
   * @param quantity - Cantidad comprada
   * @returns void
   * @note Atrapa errores internamente (log) y NO relanza la excepción para evitar "Mensajes Envenenados" en NATS.
   */
  async handleOrderConfirmed(productOfferId: string, quantity: number) {
    try {
      const inventory = await this.findByProductOffer(productOfferId);
      const productOffer = await firstValueFrom(
        this.natsClient.send('product.offer.findOne', productOfferId),
      );

      if (!inventory || !productOffer) return;

      const totalQuantity = quantity * productOffer.quantity;

      const unitEquivalent = this.unitConverter.convert(
        totalQuantity,
        productOffer.unit,
        inventory.unit,
      );

      if (inventory.available_quantity < unitEquivalent) {
        throw RpcError.internal(
          `Insufficient stock for product offer id '${productOfferId}'`,
        );
      }

      const updatedInventory = await this.prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          available_quantity: { decrement: unitEquivalent },
        },
      });

      this.checkLowStock(updatedInventory);
      this.productAvailability(updatedInventory);
    } catch (error) {
      this.logger.error(
        `Failed to decrease stock for productOfferId '${productOfferId}'`,
        (error as Error).stack,
      );
    }
  }

  /**
   * [Manejador de Evento] Reacciona al evento 'order.cancelled'.
   * Libera el stock que estaba reservado.
   *
   * @description
   * 1. Busca el inventario.
   *
   * @param productOfferId - ID del producto en la orden
   * @param quantity - Cantidad que se había reservado
   * @returns void
   * @note Atrapa errores internamente (log) y NO relanza la excepción.
   */

  async handleOrderCancelled(productOfferId: string, quantity: number) {
    try {
      const inventory = await this.findByProductOffer(productOfferId);
      const productOffer = await firstValueFrom(
        this.natsClient.send('product.offer.findOne', productOfferId),
      );
      if (!inventory || !productOffer) return;

      const totalQuantity = quantity * productOffer.quantity;

      const unitEquivalent = this.unitConverter.convert(
        totalQuantity,
        productOffer.unit,
        inventory.unit,
      );

      await this.prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          available_quantity: { increment: unitEquivalent },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to increase stock for productOfferId '${productOfferId}'`,
        (error as Error).stack,
      );
    }
  }

  /**
   * [Auxiliar Privado] Verifica si el stock disponible está por debajo del umbral mínimo.
   * @param inventory - El registro de inventario (actualizado) a verificar
   * @returns void
   */
  private checkLowStock(inventory: Inventory) {
    if (inventory.available_quantity <= inventory.minimum_threshold) {
      this.logger.warn(
        `Inventory with id '${inventory.id}' is below minimum threshold`,
      );
      this.natsClient.emit('inventory.lowStock', {
        producerId: inventory.producerId,
        productOfferId: inventory.productOfferId,
        available_quantity: inventory.available_quantity,
        minimum_threshold: inventory.minimum_threshold,
      });
    }
  }

  /**
   * [Auxiliar Privado] Sincroniza la disponibilidad del producto con el MS de product.
   *El MS de Productos debe escuchar este evento para marcar la oferta como "Agotada" o "Disponible".
   *
   * @param inventory - El registro de inventario (actualizado) a verificar
   * @returns void
   */
  private productAvailability(inventory: Inventory) {
    const available = inventory.available_quantity > 0;
    this.natsClient.emit('product.offer.updateAvailability', {
      productOfferId: inventory.productOfferId,
      available,
    });
  }
}
