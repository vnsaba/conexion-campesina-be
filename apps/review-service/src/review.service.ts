import { Injectable, Logger, OnModuleInit, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaClient } from '../generated/prisma';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('ReviewService');
  /**
   * Initializes the database connection when the module starts.
   * @returns Promise that resolves when the connection is established
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }
  /**
   * Creates a new review for a product offer.
   * Ensures the client has not already reviewed the same product offer.
   * @param createReviewDto Data for the review to create
   * @param clientId Id of the authenticated client creating the review
   * @returns The created review record
   */
  async create(createReviewDto: CreateReviewDto, clientId: string) {
    const { productOfferId } = createReviewDto;
    try {
      const reviewExist = await this.review.findFirst({
        where: { productOfferId, clientId },
      });

      if (reviewExist) {
        throw new RpcException({
          status: HttpStatus.CONFLICT,
          message: `Review already exists for this product offer and client`,
        });
      }

      const review = await this.review.create({
        data: { ...createReviewDto, clientId },
      });

      this.logger.log(`Review created: ${review.id}`);
      return review;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      this.logger.error('Error creating review', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to create review',
      });
    }
  }

  /**
   * Retrieves all reviews ordered by newest first.
   * @returns An array of reviews
   */
  async findAll() {
    try {
      return await this.review.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error('Error fetching reviews', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch reviews',
      });
    }
  }

  /**
   * Retrieves all reviews for a given product offer.
   * @param productOfferId Id of the product offer
   * @returns An array of reviews for the product offer ordered by newest first
   */
  async findAllProductOffer(productOfferId: string) {
    try {
      return await this.review.findMany({
        where: { productOfferId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error('Error fetching product reviews', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch product reviews',
      });
    }
  }

  /**
   * Retrieves all reviews created by a specific client.
   * @param clientId Id of the client
   * @returns An array of the client's reviews ordered by newest first
   */
  async findAllClientReview(clientId: string) {
    try {
      return await this.review.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error('Error fetching client reviews', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch client reviews',
      });
    }
  }

  /**
   * Calculates the average rating for a product offer.
   * @param productOfferId Id of the product offer
   * @returns An object with the `averageRating` number (0 if no reviews)
   */
  async findAverageRatingProduct(productOfferId: string) {
    try {
      const result = await this.review.aggregate({
        _avg: { rating: true },
        where: { productOfferId },
      });
      return { averageRating: result._avg.rating ?? 0 };
    } catch (error) {
      this.logger.error('Error calculating average rating', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to calculate average rating',
      });
    }
  }

  /**
   * Retrieves a single review by id.
   * @param id Review id
   * @returns The review record or throws if not found
   */
  async findOne(id: string) {
    try {
      const review = await this.review.findUnique({ where: { id } });
      if (!review) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `Review with id ${id} not found`,
        });
      }
      return review;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      this.logger.error('Error fetching review', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch review',
      });
    }
  }

  /**
   * Updates a review. Only the owner (client) can update their review.
   * @param id Review id to update
   * @param updateReviewDto Partial review data (rating/comments)
   * @param clientId Id of the authenticated client requesting the update
   * @returns The updated review record
   */
  async update(id: string, updateReviewDto: UpdateReviewDto, clientId: string) {
    try {
      const reviewExist = await this.review.findUnique({ where: { id } });

      if (!reviewExist) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `Review with id ${id} not found`,
        });
      }

      if (reviewExist.clientId !== clientId) {
        throw new RpcException({
          status: HttpStatus.FORBIDDEN,
          message: 'You are not allowed to modify this review',
        });
      }

      const review = await this.review.update({
        where: { id },
        data: updateReviewDto,
      });

      this.logger.log(`Review updated: ${id}`);
      return review;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      this.logger.error('Error updating review', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to update review',
      });
    }
  }

  /**
   * Deletes a review. If `clientId` is provided, deletion is restricted to that client;
   * otherwise the review is deleted by id (used for admin operations).
   * @param id Review id to delete
   * @param clientId Optional client id to enforce ownership when deleting
   * @returns An object with a success message
   */
  async remove(id: string, clientId?: string): Promise<{ message: string }> {
    try {
      const review = clientId
        ? await this.review.findFirst({ where: { id, clientId } })
        : await this.review.findUnique({ where: { id } });

      if (!review) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `Review with id ${id} not found${clientId ? ' for this client' : ''}`,
        });
      }

      await this.review.delete({ where: { id } });
      this.logger.log(`Review deleted: ${id}`);
      return { message: `Review with id ${id} deleted successfully` };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      this.logger.error('Error deleting review', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to delete review',
      });
    }
  }
}
