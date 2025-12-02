import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { catchError, firstValueFrom } from 'rxjs';
import { AuthGuard } from '../auth/guards/auth.guards';
import { UserRoleGuard } from '../auth/guards/user-role.guard';
import { RoleProtected, User } from '../auth/guards/decorators';
import { ValidRoles } from '../auth/enum/valid-roles.enum';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/guards/interface/current-user.interface';
import { CreateReviewDto } from '../../review-service/src/dto/create-review.dto';
import { UpdateReviewDto } from '../../review-service/src/dto/update-review.dto';

const NATS_SERVICE_KEY = process.env.NATS_SERVICE_KEY;

@ApiBearerAuth('bearer')
@Controller('review')
export class ReviewController {
  constructor(
    @Inject(NATS_SERVICE_KEY)
    private readonly natsClient: ClientProxy,
  ) {}

  /**
   * Creates a new review.
   * Sends review data to the review service for creation and associates it with the authenticated client.
   * @returns The created review or an RPC error wrapped in a RpcException
   */
  @RoleProtected(ValidRoles.CLIENT)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Post()
  async createReview(
    @User() user: CurrentUser,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    const { productOfferId } = createReviewDto;
    const productOffer = await this.existProductOffer(productOfferId, user.id);
    if (!productOffer) {
      throw new RpcException('The product offer does not exist in any order');
    }
    try {
      return await firstValueFrom(
        this.natsClient.send('create.Review', {
          clientId: user.id,
          createReview: createReviewDto,
        }),
      );
    } catch (error) {
      throw new RpcException(error);
    }
  }

  /**
   * Checks if a review is associated with any product offer.
   * Sends a message to the product service to verify its existence in productsOrders.
   */
  async existProductOffer(id: string, clientId: string): Promise<boolean> {
    try {
      const existProductOfferObservable = this.natsClient.send(
        'order.existsProductOffer',
        { productOfferId: id, clientId },
      );
      const productOffer = await firstValueFrom(existProductOfferObservable);
      return !!productOffer;
    } catch (error) {
      throw new RpcException(error);
    }
  }

  /**
   * Retrieves all reviews.
   * Sends a request to the review service and returns the list of reviews.
   * @returns An array of reviews
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.CLIENT)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get()
  findAllReviews() {
    return this.natsClient.send('findAll.Review', {}).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  @RoleProtected(ValidRoles.ADMIN, ValidRoles.CLIENT)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('summary/:productOfferId')
  summaryReviews(@Param('productOfferId') productOfferId: string) {
    return this.natsClient
      .send('findAverageRating.Review.ProductOffer', productOfferId)
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  /**
   * Retrieves all reviews for a specific product offer.
   * @param productOfferId Id of the product offer
   * @returns An array of reviews for the specified product offer
   */
  @RoleProtected(ValidRoles.CLIENT, ValidRoles.PRODUCER, ValidRoles.ADMIN)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('product-offer/:productOfferId')
  findAllByProductOffer(@Param('productOfferId') productOfferId: string) {
    return this.natsClient
      .send('findAll.Review.ProductOffer', productOfferId)
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  /**
   * Retrieves all reviews authored by a specific client.
   * @param clientId Id of the client
   * @returns An array of reviews by the client
   */
  @RoleProtected(ValidRoles.CLIENT)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('client')
  findReviewsByClientId(@User() user: CurrentUser) {
    return this.natsClient.send('findAll.Review.Client', user.id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Retrieves a single review by id.
   * @param id Review id
   * @returns The requested review
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.CLIENT, ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get(':id')
  findOneReview(@Param('id') id: string) {
    return this.natsClient.send('findOne.Review', id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Updates a review belonging to the authenticated client.
   * Sends update data to the review service including the requesting client's id.
   * @param id Review id to update
   * @returns The updated review
   */
  @RoleProtected(ValidRoles.CLIENT)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Patch(':id')
  updateReview(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() updateReview: UpdateReviewDto,
  ) {
    return this.natsClient
      .send('update.Review', {
        id,
        clientId: user.id,
        updateReview,
      })
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  /**
   * Deletes a review owned by the authenticated client.
   * Sends the delete request to the review service with the client's id to enforce ownership.
   * @param id Review id to delete
   * @returns A success message or an RPC error
   */
  @RoleProtected(ValidRoles.CLIENT)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Delete('client/:id')
  removeReviewClient(@User() user: CurrentUser, @Param('id') id: string) {
    return this.natsClient
      .send('remove.Review.Client', { id, clientId: user.id })
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  /**
   * Deletes a review as an administrator.
   * Allows admins to remove any review (e.g., policy violations).
   * @param id Review id to delete
   * @returns A success message or an RPC error
   */
  @RoleProtected(ValidRoles.ADMIN)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Delete('admin/:id')
  removeReviewAdmin(@Param('id') id: string) {
    return this.natsClient.send('remove.Review.Admin', id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Verifica si el cliente ya tiene una reseña para este producto
   * y tiene una orden con ese producto para saber si es candidato a hacer una reseña.
   * @param user Usuario autenticado
   * @param productOfferId ID de la oferta de producto
   * @returns true si puede hacer reseña, false si ya la hizo o no ha comprado el producto
   */
  @RoleProtected(ValidRoles.CLIENT)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('has-reviewed/:productOfferId')
  async hasReviewed(
    @User() user: CurrentUser,
    @Param('productOfferId') productOfferId: string,
  ) {
    const productOffer = await this.existProductOffer(productOfferId, user.id);

    if (!productOffer) {
      return false;
    }

    const clientReviews = await firstValueFrom(
      this.findReviewsByClientId(user).pipe(
        catchError((error) => {
          throw new RpcException({
            status: error.status || 500,
            message: error.message || 'Error fetching client reviews',
          });
        }),
      ),
    );

    const hasReviewedProduct = Array.isArray(clientReviews)
      ? clientReviews.some(
          (review: any) => review.productOfferId === productOfferId,
        )
      : false;

    return !hasReviewedProduct;
  }
}
