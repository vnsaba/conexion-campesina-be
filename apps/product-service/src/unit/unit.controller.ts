import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UnitService } from './unit.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Controller()
export class UnitController {
  constructor(private readonly unitService: UnitService) {}

  @MessagePattern('product.createUnit')
  create(@Payload() createUnitDto: CreateUnitDto) {
    return this.unitService.create(createUnitDto);
  }

  @MessagePattern('product.findAllUnit')
  findAll() {
    return this.unitService.findAll();
  }

  @MessagePattern('product.findOneUnit')
  findOne(@Payload() id: string) {
    return this.unitService.findOne(id);
  }

  @MessagePattern('product.updateUnit')
  update(@Payload() updatePayload: { id: string; updateUnit: UpdateUnitDto }) {
    const { id, updateUnit } = updatePayload;
    return this.unitService.update(id, updateUnit);
  }

  @MessagePattern('product.removeUnit')
  remove(@Payload() id: string) {
    return this.unitService.remove(id);
  }
}
