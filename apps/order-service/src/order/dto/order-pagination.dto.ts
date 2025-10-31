import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrderStatusList } from '../enum/order.enum';
import { OrderStatus } from '../../../generated/prisma';

export class OrderPaginationDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OrderStatus, {
    message: `Valid status are: ${OrderStatusList.join(', ')}`,
  })
  status?: OrderStatus;
}
