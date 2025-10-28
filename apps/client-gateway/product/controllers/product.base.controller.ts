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
import { ApiBearerAuth } from '@nestjs/swagger';

const NATS_SERVICE_KEY = process.env.NATS_SERVICE_KEY;
@ApiBearerAuth('bearer')
@Controller('product/base')
export class ProductBaseController {
  constructor(
    @Inject(NATS_SERVICE_KEY)
    private readonly natsClient: ClientProxy,
  ) {}

  /**
   * Creates a new product base.
   * Sends product data to the NATS product service for base product creation.
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
   * Retrieves all product bases.
   * Sends request to the NATS product service and returns the list of base products.
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
   * Retrieves the list of categories defined in the Product service enum.
   * Sends message pattern: 'product.base.getCategories'
   *
   * @returns Observable<Category[]> Observable that resolves with the array of category strings.
   * @throws RpcException if the microservice call fails.
   */
  @Get('categories')
  getCategories() {
    return this.natsClient.send('product.base.getCategories', {}).pipe(
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
   * Updates a product base.
   * Sends updated data to the NATS product service and returns the updated product base.
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
   * Deletes a product base.
   * Sends deletion request to the NATS product service.
   */
  @RoleProtected(ValidRoles.ADMIN)
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
