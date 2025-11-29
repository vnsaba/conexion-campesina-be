import { Controller } from '@nestjs/common';
import { InventoryService } from './inventory-service.service';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { OrderPendingDto } from './dto/order-pending.dto';

@Controller()
export class InventoryServiceController {
  constructor(private readonly inventoryService: InventoryService) {}

  // Crear un nuevo inventario
  @MessagePattern('inventory.create')
  create(
    @Payload()
    paylaod: {
      producerId: string;
      createInventoryDto: CreateInventoryDto;
    },
  ) {
    const { producerId, createInventoryDto } = paylaod;
    return this.inventoryService.create(producerId, createInventoryDto);
  }

  // Obtener todos los inventarios
  @MessagePattern('inventory.findAll')
  findAll() {
    return this.inventoryService.findAll();
  }

  // Obtener inventarios filtrados por productor
  @MessagePattern('inventory.findByProducer')
  findByProducer(@Payload() producerId: string) {
    return this.inventoryService.findByProducer(producerId);
  }

  // Obtener inventario por productOfferId
  @MessagePattern('inventory.findByProductOffer')
  findByProductOffer(@Payload() productOfferId: string) {
    return this.inventoryService.findByProductOffer(productOfferId);
  }

  // Obtener un inventario específico por id
  @MessagePattern('inventory.findOne')
  findOne(@Payload() id: string) {
    return this.inventoryService.findOne(id);
  }

  // Actualizar inventario (cantidad o threshold)
  @MessagePattern('inventory.update')
  update(@Payload() data: { id: string; updateInventory: UpdateInventoryDto }) {
    const { id, updateInventory } = data;
    return this.inventoryService.update(id, updateInventory);
  }

  // Eliminar inventario
  @MessagePattern('inventory.remove')
  remove(@Payload() id: string) {
    return this.inventoryService.remove(id);
  }

  @EventPattern('order.confirmed')
  handleOrderConfirmed(
    @Payload() data: { productOfferId: string; quantity: number },
  ) {
    const { productOfferId, quantity } = data;
    return this.inventoryService.handleOrderConfirmed(productOfferId, quantity);
  }

  @EventPattern('order.cancelled')
  handleOrderCancelled(
    @Payload() data: { productOfferId: string; quantity: number },
  ) {
    const { productOfferId, quantity } = data;
    return this.inventoryService.handleOrderCancelled(productOfferId, quantity);
  }

  @EventPattern('order.pending')
  handleOrderPending(data: OrderPendingDto) {
    return this.inventoryService.handleOrderPending(data);
  }
}
