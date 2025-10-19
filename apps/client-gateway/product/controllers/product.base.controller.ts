import {
  Body,
  Controller,
  Inject,
  Post,
  UseGuards,
  Get,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { CreateProductBaseDto } from 'apps/product-service/src/product-base/dto/create-product-base.dto';
import { UpdateProductBaseDto } from 'apps/product-service/src/product-base/dto/update-product-base.dto';
import { catchError } from 'rxjs';
import { AuthGuard } from 'apps/client-gateway/auth/guards/auth.guards';
import { UserRoleGuard } from 'apps/client-gateway/auth/guards/user-role.guard';
import { RoleProtected } from 'apps/client-gateway/auth/guards/decorators';
import { ValidRoles } from '../../auth/enum/valid-roles.enum';

const NATS_SERVICE_KEY = process.env.NATS_SERVICE_KEY;

@Controller('product/base')
export class ProductBaseController {
  constructor(
    @Inject(NATS_SERVICE_KEY)
    private readonly natsClient: ClientProxy,
  ) {}

  /**
   * Creates a new Product Base.
   * Sends message pattern: 'product.base.create'
   * Authorization: ADMIN or PRODUCER
   *
   * @param createProductBaseDto Product Base data to create
   * @returns Observable with the created Product Base
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Post('')
  createProductBase(@Body() createProductBaseDto: CreateProductBaseDto) {
    return this.natsClient
      .send('product.base.create', createProductBaseDto)
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  /**
   * Retrieves all Product Bases.
   * Sends message pattern: 'product.base.findAll'
   * Authorization: ADMIN or PRODUCER
   *
   * @returns Observable with the list of Product Bases
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('')
  findAllProductBase() {
    return this.natsClient.send('product.base.findAll', {}).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Retrieves a Product Base by its ID.
   * Sends message pattern: 'product.base.findOne'
   * Authorization: ADMIN or PRODUCER
   *
   * @param id Product Base identifier (string/ObjectId)
   * @returns Observable with the found Product Base
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get(':id')
  findOneProductBase(@Param('id') id: string) {
    return this.natsClient.send('product.base.findOne', id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Updates a Product Base by its ID.
   * Sends message pattern: 'product.base.update'
   * Payload shape: { id, updateProductBase: UpdateProductBaseDto }
   * Authorization: ADMIN or PRODUCER
   *
   * @param id Product Base identifier to update
   * @param updateProductBaseDto Fields to update
   * @returns Observable with the updated Product Base
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Patch(':id')
  updateProductBase(
    @Param('id') id: string,
    @Body() updateProductBaseDto: UpdateProductBaseDto,
  ) {
    return this.natsClient
      .send('product.base.update', {
        id,
        updateProductBase: updateProductBaseDto,
      })
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  /**
   * Removes a Product Base by its ID.
   * Sends message pattern: 'product.base.remove'
   * Authorization: ADMIN or PRODUCER
   *
   * @param id Product Base identifier to remove
   * @returns Observable with deletion confirmation
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Delete(':id')
  removeProductBase(@Param('id') id: string) {
    return this.natsClient.send('product.base.remove', id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }
}
