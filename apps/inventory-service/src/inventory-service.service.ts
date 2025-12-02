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

  private async validateProducer(producerId: string) {
    const producer = await firstValueFrom(
      this.natsClient.send('auth.get.user', producerId),
    );
    if (!producer) {
      throw RpcError.notFound(`Producer with id '${producerId}' not found`);
    }
    return producer;
  }

  private async validateProductOffer(productOfferId: string) {
    const productOffer = await firstValueFrom(
      this.natsClient.send('product.offer.findOne', productOfferId),
    );
    if (!productOffer) {
      throw RpcError.notFound(
        `Product Offer with id '${productOfferId}' not found`,
      );
    }
    return productOffer;
  }

  private validateInventoryInput(createInventory: CreateInventoryDto) {
    const { available_quantity, maximum_capacity, minimum_threshold } =
      createInventory;
    if (available_quantity < 0) {
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
    if (minimum_threshold > available_quantity) {
      throw RpcError.badRequest(
        'minimum_threshold must be < available_quantity',
      );
    }
    if (minimum_threshold > maximum_capacity) {
      throw RpcError.badRequest(
        'minimum_threshold must be <= maximum_capacity',
      );
    }
  }

  private async checkInventoryDuplicate(productOfferId: string) {
    const existingInventory = await this.prisma.inventory.findFirst({
      where: { productOfferId },
    });
    if (existingInventory) {
      throw RpcError.badRequest(
        `Inventory for product offer '${productOfferId}' already exists`,
      );
    }
  }

  private calculateUnitEquivalent(
    quantity: number,
    productOffer: any,
    inventory: Inventory,
  ) {
    const totalQuantity = quantity * productOffer.quantity;
    if (productOffer.unit === inventory.unit) {
      return totalQuantity;
    }
    return this.unitConverter.convert(
      totalQuantity,
      productOffer.unit,
      inventory.unit,
    );
  }

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
      this.validateInventoryInput(createInventory);
      await this.checkInventoryDuplicate(createInventory.productOfferId);
      await this.validateProducer(producerId);
      const productOffer = await this.validateProductOffer(
        createInventory.productOfferId,
      );

      if (createInventory.available_quantity < productOffer.quantity) {
        throw RpcError.badRequest(
          'available_quantity must be >= product offer quantity',
        );
      }

      const inventory = await this.prisma.inventory.create({
        data: {
          producerId,
          ...createInventory,
        },
      });

      this.natsClient.emit('product.offer.updateActive', {
        productOfferId: createInventory.productOfferId,
        isActive: createInventory.available_quantity > productOffer.quantity,
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
      await this.validateProducer(producerId);

      const inventories = await this.prisma.inventory.findMany({
        where: { producerId },
      });

      if (!inventories.length) return [];

      const productNames = await Promise.all(
        inventories.map((inv) =>
          firstValueFrom(
            this.natsClient.send('product.offer.getName', inv.productOfferId),
          ),
        ),
      );

      const inventoriesWithNames = inventories.map((inv, index) => ({
        ...inv,
        product_name: productNames[index],
      }));

      return inventoriesWithNames;
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
      const inventory = await this.findOne(id);
      const productOffer = await this.validateProductOffer(
        inventory!.productOfferId,
      );

      const finalValues = this.getFinalInventoryValues(
        inventory,
        updateInventory,
      );

      this.validateInventoryUpdate(finalValues);

      const updatedInventory = await this.prisma.inventory.update({
        where: { id: inventory!.id },
        data: {
          ...(updateInventory.available_quantity !== undefined && {
            available_quantity: updateInventory.available_quantity,
          }),
          ...(updateInventory.minimum_threshold !== undefined && {
            minimum_threshold: updateInventory.minimum_threshold,
          }),
          ...(updateInventory.maximum_capacity !== undefined && {
            maximum_capacity: updateInventory.maximum_capacity,
          }),
        },
      });

      if (updateInventory.available_quantity !== undefined) {
        this.handleProductOfferActiveStatus(
          updatedInventory,
          productOffer.quantity,
        );
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

  private getFinalInventoryValues(
    inventory: any,
    updateDto: UpdateInventoryDto,
  ) {
    return {
      available: updateDto.available_quantity ?? inventory.available_quantity,
      threshold: updateDto.minimum_threshold ?? inventory.minimum_threshold,
      maxCapacity: updateDto.maximum_capacity ?? inventory.maximum_capacity,
    };
  }

  private validateInventoryUpdate(values: {
    available: number;
    threshold: number;
    maxCapacity: number;
  }) {
    const { available, threshold, maxCapacity } = values;

    if (available < 0) {
      throw RpcError.badRequest('available_quantity must be >= 0');
    }

    if (maxCapacity < 1) {
      throw RpcError.badRequest('maximum_capacity must be >= 1');
    }

    if (available > maxCapacity) {
      throw RpcError.badRequest(
        'available_quantity cannot exceed maximum_capacity',
      );
    }

    if (threshold > maxCapacity) {
      throw RpcError.badRequest(
        'minimum_threshold cannot exceed maximum_capacity',
      );
    }
  }

  private handleProductOfferActiveStatus(
    inventory: any,
    offerQuantity: number,
  ) {
    const isActive = inventory.available_quantity >= offerQuantity;

    this.natsClient.emit('product.offer.updateActive', {
      productOfferId: inventory.productOfferId,
      isActive,
    });
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
   * 3. Decrementa `available_quantity` (descuenta el stock real vendido).
   * 4. Llama a `checkLowStock` y `productAvailability` para reflejar el nuevo stock.
   *
   * @param productOfferId - ID del producto en la orden
   * @param quantity - Cantidad comprada
   * @returns void
   */
  async handleOrderConfirmed(productOfferId: string, quantity_order: number) {
    try {
      const inventory = await this.findByProductOffer(productOfferId);
      const productOffer = await this.validateProductOffer(productOfferId);

      const unitEquivalent = this.calculateUnitEquivalent(
        quantity_order,
        productOffer,
        inventory!,
      );

      if (inventory!.available_quantity < unitEquivalent) {
        throw RpcError.internal(
          `Insufficient stock for product offer id '${productOfferId}'`,
        );
      }

      const updatedInventory = await this.prisma.inventory.update({
        where: { id: inventory!.id },
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

  async handleOrderCancelled(
    orderId: string,
    productOfferId: string,
    quantity: number,
  ) {
    try {
      const order = await firstValueFrom(
        this.natsClient.send('order.findOne', orderId),
      );

      if (!order) {
        this.logger.error(`Order with id '${orderId}' not found`);
        return;
      }

      if (order.status !== 'pending') {
        this.logger.warn(
          `Order '${orderId}' cannot be cancelled because status is '${order.status}'`,
        );
        return;
      }

      const inventory = await this.findByProductOffer(productOfferId);
      const productOffer = await this.validateProductOffer(productOfferId);

      const unitEquivalent = this.calculateUnitEquivalent(
        quantity,
        productOffer,
        inventory!,
      );

      const updatedInventory = await this.prisma.inventory.update({
        where: { id: inventory!.id },
        data: {
          available_quantity: { increment: unitEquivalent },
        },
      });

      this.productAvailability(updatedInventory);

      this.logger.log(
        `Order '${orderId}' cancelled successfully. Stock returned: ${unitEquivalent}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle cancellation for order '${orderId}'`,
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
    this.logger.warn(
      `Inventory with id '${inventory.id}' is below minimum threshold`,
    );

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

  async validateStock(productOfferId: string, quantity: number) {
    try {
      const inventory = await this.findByProductOffer(productOfferId);
      const productOffer = await this.validateProductOffer(productOfferId);

      const requiredAmount = this.calculateUnitEquivalent(
        quantity,
        productOffer,
        inventory!,
      );

      return inventory!.available_quantity >= requiredAmount;
    } catch (error) {
      this.logger.error(
        `Error validating stock for productOfferId '${productOfferId}': ${(error as Error).message}`,
      );
      return false;
    }
  }
}
