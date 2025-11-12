import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { catchError } from 'rxjs';
import { AuthGuard } from '../auth/guards/auth.guards';
import { UserRoleGuard } from '../auth/guards/user-role.guard';
import { RoleProtected, User } from '../auth/guards/decorators';
import { ValidRoles } from '../auth/enum/valid-roles.enum';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/guards/interface/current-user.interface';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { CreateOrderDto } from '../../order-service/src/order/dto/create-order.dto';

const NATS_SERVICE_KEY = process.env.NATS_SERVICE_KEY;

@ApiBearerAuth('bearer')
@Controller('orders')
export class OrderController {
  constructor(
    @Inject(NATS_SERVICE_KEY)
    private readonly natsClient: ClientProxy,
  ) {}

  @RoleProtected(ValidRoles.CLIENT, ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Post()
  createOrder(
    @User() user: CurrentUser,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.natsClient
      .send('order.create', {
        clientId: user.id,
        createOrderDto,
      })
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  @RoleProtected(ValidRoles.ADMIN)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get()
  findAllOrders(@Query() paginationDto: OrderPaginationDto) {
    return this.natsClient.send('order.findAll', paginationDto).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  @RoleProtected(ValidRoles.ADMIN, ValidRoles.CLIENT, ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get(':id')
  findOneOrder(@Param('id') id: string) {
    return this.natsClient.send('order.findOne', id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  @RoleProtected(ValidRoles.ADMIN)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Delete(':id')
  removeOrder(@Param('id') id: string) {
    return this.natsClient.send('order.remove', id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  @RoleProtected(ValidRoles.CLIENT, ValidRoles.ADMIN)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('client/:clientId')
  findOrdersByClientId(@Param('clientId') clientId: string) {
    return this.natsClient.send('order.findByClientId', clientId).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  @RoleProtected(ValidRoles.ADMIN, ValidRoles.CLIENT, ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get(':orderId/details')
  getOrderDetails(@Param('orderId') orderId: string) {
    return this.natsClient.send('order.getOrderDetails', orderId).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }
}
