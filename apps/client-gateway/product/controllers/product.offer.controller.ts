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
import { UserRoleGuard } from 'apps/client-gateway/auth/guards/user-role.guard';
import { CreateProductOfferDto } from 'apps/product-service/src/product-offer/dto/create-product-offer.dto';
import { UpdateProductOfferDto } from 'apps/product-service/src/product-offer/dto/update-product-offer.dto';
import {
  RoleProtected,
  User,
} from 'apps/client-gateway/auth/guards/decorators';
import { ValidRoles } from '../../auth/enum/valid-roles.enum';
import { ApiBearerAuth } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { CurrentUser } from 'apps/client-gateway/auth/guards/interface/current-user.interface';

const NATS_SERVICE_KEY = process.env.NATS_SERVICE_KEY;

/**
 * Exposes REST endpoints to manage Product Offer entities.
 * Proxies requests to product-service via NATS message patterns (product.offer.*).
 * Protected by AuthGuard and restricted by RolesGuard.
 */
@ApiBearerAuth('bearer')
@Controller('product/offer')
export class ProductOfferController {
  constructor(
    @Inject(NATS_SERVICE_KEY)
    private readonly natsClient: ClientProxy,
  ) {}

  /**
   * Creates a new product offer.
   * Sends product offer data to the NATS product service for offer creation.
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Post('')
  createProductOffer(
    @User() user: CurrentUser,
    @Body() createProductOfferDto: CreateProductOfferDto,
  ) {
    return this.natsClient
      .send('product.offer.create', {
        createProductOfferDto,
        producerId: user.id,
      })
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  /**
   * Retrieves all product offers.
   * Sends request to the NATS product service and returns the list of product offers.
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.CLIENT)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('')
  findAllProductOffer() {
    return this.natsClient.send('product.offer.findAll', {}).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Retrieves product offers by name.
   * Sends request to the NATS product service and returns the filtered product offers.
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.CLIENT)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('name/:name')
  findAllProductOffersByName(@Param('name') name: string) {
    return this.natsClient.send('product.offer.searchByName', name).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Retrieves product offers by category.
   * Sends request to the NATS product service and returns the filtered product offers.
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.CLIENT)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('category/:category')
  findAllProductOffersByCategory(@Param('category') category: string) {
    return this.natsClient
      .send('product.offer.searchByCategory', category)
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  /**
   * Retrieves a specific product offer by ID.
   * Sends request to the NATS product service and returns the product offer data.
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.PRODUCER, ValidRoles.CLIENT)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get(':id')
  findOneProductOffer(@Param('id') id: string) {
    return this.natsClient.send('product.offer.findOne', id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Updates a product offer.
   * Sends updated data to the NATS product service and returns the updated product offer.
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
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
   * Deletes a product offer.
   * Sends deletion request to the NATS product service.
   */
  @RoleProtected(ValidRoles.PRODUCER, ValidRoles.ADMIN)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Delete(':id')
  async removeProductOffer(@Param('id') id: string) {
    const existOrderProducts = await this.existOrderProducts(id);

    if (existOrderProducts) {
      throw new RpcException(
        'Cannot delete product offer associated with existing orders.',
      );
    }
    try {
      return await firstValueFrom(
        this.natsClient.send('product.offer.remove', id),
      );
    } catch (error) {
      throw new RpcException(error);
    }
  }

  /**
   * Checks if a product offer is associated with any order.
   * Sends a message to the order service to verify its existence in orders.
   */
  async existOrderProducts(id: string): Promise<boolean> {
    try {
      const existOrderObservable = this.natsClient.send(
        'order.existsProductOffer',
        id,
      );
      return await firstValueFrom(existOrderObservable);
    } catch (error) {
      throw new RpcException(error);
    }
  }

  /**
   * Retrieves all product offers for the authenticated producer.
   * Sends request to the NATS product service and returns the producer's offers.
   */
  @RoleProtected(ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('get/producer')
  findAllProducerOffers(@User() user: CurrentUser) {
    return this.natsClient.send('product.offer.findAllProducer', user.id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }
}
