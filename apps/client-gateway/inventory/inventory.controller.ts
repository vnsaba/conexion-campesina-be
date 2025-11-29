import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { AuthGuard } from 'apps/client-gateway/auth/guards/auth.guards';
import { UserRoleGuard } from 'apps/client-gateway/auth/guards/user-role.guard';
import {
  RoleProtected,
  User,
} from 'apps/client-gateway/auth/guards/decorators';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreateInventoryDto } from 'apps/inventory-service/src/dto/create-inventory.dto';
import { ValidRoles } from '../auth/enum/valid-roles.enum';
import { catchError } from 'rxjs';
import { UpdateInventoryDto } from 'apps/inventory-service/src/dto/update-inventory.dto';
import { CurrentUser } from '../auth/guards/interface/current-user.interface';

const NATS_SERVICE_KEY = process.env.NATS_SERVICE_KEY;

@ApiBearerAuth('bearer')
@Controller('inventory')
export class InventoryController {
  constructor(
    @Inject(NATS_SERVICE_KEY)
    private readonly natsClient: ClientProxy,
  ) {}

  /**
   * Creates a new inventory record.
   */
  @RoleProtected(ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Post('')
  createInventory(
    @Body() createInventoryDto: CreateInventoryDto,
    @User() user: CurrentUser,
  ) {
    return this.natsClient
      .send('inventory.create', {
        producerId: user.id,
        createInventoryDto,
      })
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  /**
   * Retrieves all inventory records.
   */
  @RoleProtected(ValidRoles.ADMIN)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('')
  findAll() {
    return this.natsClient.send('inventory.findAll', {}).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  @RoleProtected(ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('/producer')
  findByProducer(@User() user: CurrentUser) {
    return this.natsClient.send('inventory.findAll', user.id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Retrieves inventory by product offer ID.
   */
  @RoleProtected(ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('/productOffer/:productOfferId')
  findByProductOffer(@Param('productOfferId') productOfferId: string) {
    return this.natsClient
      .send('inventory.findByProductOffer', productOfferId)
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  /**
   * * Retrieves a specific inventory record by ID.
   */
  @RoleProtected(ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('/:inventoryId')
  findOne(@Param('inventoryId') inventoryId: string) {
    return this.natsClient.send('inventory.findOne', inventoryId).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Updates an existing inventory record.
   */
  @RoleProtected(ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Patch('/:inventoryId')
  update(
    @Param('inventoryId') inventoryId: string,
    @Body() updateInventoryDto: UpdateInventoryDto,
  ) {
    return this.natsClient
      .send('inventory.update', { inventoryId, updateInventoryDto })
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  /**
   * Deletes an inventory record by ID.
   */
  @RoleProtected(ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Delete('/:inventoryId')
  remove(@Param('inventoryId') inventoryId: string) {
    return this.natsClient.send('inventory.remove', inventoryId).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }
}
