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
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
  @Delete(':id')
  removeProductBase(@Param('id') id: string) {
    return this.natsClient.send('product.base.remove', id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }
}
