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
import { catchError } from 'rxjs';

import { AuthGuard } from 'apps/client-gateway/auth/guards/auth.guards';

import { CreateProductOfferDto } from 'apps/product-service/src/product-offer/dto/create-product-offer.dto';
import { UpdateProductOfferDto } from 'apps/product-service/src/product-offer/dto/update-product-offer.dto';

const NATS_SERVICE_KEY = process.env.NATS_SERVICE_KEY;

/**
 * Exposes REST endpoints to manage Product Offer entities.
 * Proxies requests to product-service via NATS message patterns (product.offer.*).
 * Protected by AuthGuard and restricted by RolesGuard.
 */
@Controller('product/offer')
export class ProductOfferController {
  constructor(
    @Inject(NATS_SERVICE_KEY)
    private readonly natsClient: ClientProxy,
  ) {}

  /**
   * Creates a new Product Offer.
   * Sends message pattern: 'product.offer.create'
   * Authorization: ADMIN or PRODUCER
   *
   * @param createProductOfferDto Product Offer data to create
   * @returns Observable with the created Product Offer (including productBase)
   */
  @UseGuards(AuthGuard)
  @Post('')
  createProductOffer(@Body() createProductOfferDto: CreateProductOfferDto) {
    return this.natsClient
      .send('product.offer.create', createProductOfferDto)
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  /**
   * Retrieves all Product Offers.
   * Sends message pattern: 'product.offer.findAll'
   * Authorization: ADMIN or PRODUCER
   *
   * @returns Observable with the list of Product Offers (including productBase)
   */
  @UseGuards(AuthGuard)
  @Get('')
  findAllProductOffer() {
    return this.natsClient.send('product.offer.findAll', {}).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Retrieves a Product Offer by its ID.
   * Sends message pattern: 'product.offer.findOne'
   * Authorization: ADMIN or PRODUCER
   *
   * @param id Product Offer identifier (string/ObjectId)
   * @returns Observable with the found Product Offer (including productBase)
   */
  @UseGuards(AuthGuard)
  @Get(':id')
  findOneProductOffer(@Param('id') id: string) {
    return this.natsClient.send('product.offer.findOne', id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Updates a Product Offer by its ID.
   * Sends message pattern: 'product.offer.update'
   * Payload shape: { id, updateProductOffer: UpdateProductOfferDto }
   * Authorization: ADMIN or PRODUCER
   *
   * @param id Product Offer identifier to update
   * @param updateProductOfferDto Fields to update
   * @returns Observable with the updated Product Offer (including productBase)
   */
  @UseGuards(AuthGuard)
  @Patch(':id')
  updateProductOffer(
    @Param('id') id: string,
    @Body() updateProductOfferDto: UpdateProductOfferDto,
  ) {
    return this.natsClient
      .send('product.offer.update', {
        id,
        updateProductOffer: updateProductOfferDto,
      })
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  /**
   * Removes a Product Offer by its ID.
   * Sends message pattern: 'product.offer.remove'
   * Authorization: ADMIN or PRODUCER
   *
   * @param id Product Offer identifier to remove
   * @returns Observable with deletion confirmation
   */
  @UseGuards(AuthGuard)
  @Delete(':id')
  removeProductOffer(@Param('id') id: string) {
    return this.natsClient.send('product.offer.remove', id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }
}
