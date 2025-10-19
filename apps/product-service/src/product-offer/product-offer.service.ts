import {
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

import { Prisma, PrismaClient } from '../../generated/prisma';
import { CreateProductOfferDto } from './dto/create-product-offer.dto';
import { UpdateProductOfferDto } from './dto/update-product-offer.dto';

type ProductOfferWithBase = Prisma.ProductOfferGetPayload<{
  include: { productBase: true };
}>;

@Injectable()
export class ProductOfferService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('ProductOfferService');

  /**
   * Initializes the database connection when the module starts
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  /**
   * Creates a new product offer and returns it including its ProductBase
   * @param createProductOfferDto - Data transfer object containing product offer information
   * @returns The created product offer with its associated ProductBase
   * @throws {RpcException} If a product offer with the same name, producerId and productBaseId already exists
   * @throws {RpcException} If there's a database error during creation
   */
  async create(
    createProductOfferDto: CreateProductOfferDto,
  ): Promise<ProductOfferWithBase> {
    const { productBaseId, producerId, name } = createProductOfferDto;

    try {
      const existingProductOffer = await this.productOffer.findFirst({
        where: { productBaseId, producerId, name },
      });

      if (existingProductOffer) {
        throw new RpcException({
          status: HttpStatus.CONFLICT,
          message: `Product offer '${name}' already exists`,
        });
      }

      const createdProductOffer = await this.productOffer.create({
        data: createProductOfferDto,
        include: { productBase: true },
      });

      this.logger.log(`ProductOffer created: ${createdProductOffer.id}`);
      return createdProductOffer;
    } catch (error: unknown) {
      if (error instanceof RpcException) throw error;

      this.logger.error('Error creating product offer', (error as Error).stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to create product offer',
      });
    }
  }

  /**
   * Returns all product offers including their ProductBase
   * @returns Array of all product offers ordered by creation date (newest first)
   * @throws {RpcException} If there's a database error during retrieval
   */
  async findAll(): Promise<ProductOfferWithBase[]> {
    try {
      const productOffers = await this.productOffer.findMany({
        include: { productBase: true },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.log(`Product offers retrieved: ${productOffers.length}`);
      return productOffers;
    } catch (error: unknown) {
      this.logger.error(
        'Error retrieving product offers',
        (error as Error).stack,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve product offers',
      });
    }
  }

  /**
   * Returns a product offer by id including its ProductBase
   * @param id - The MongoDB ObjectId of the product offer
   * @returns The product offer with its associated ProductBase
   * @throws {RpcException} If the product offer is not found
   * @throws {RpcException} If there's a database error during retrieval
   */
  async findOne(id: string): Promise<ProductOfferWithBase> {
    try {
      const productOffer = await this.productOffer.findUnique({
        where: { id },
        include: { productBase: true },
      });

      if (!productOffer) {
        throw new NotFoundException(`ProductOffer with id '${id}' not found`);
      }

      return productOffer;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: error.message,
        });
      }

      this.logger.error(
        `Error fetching product offer with id ${id}`,
        (error as Error).stack,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch product offer',
      });
    }
  }

  /**
   * Updates a product offer and returns it including its ProductBase
   * @param id - The MongoDB ObjectId of the product offer to update
   * @param updateProductOfferDto - Data transfer object with fields to update
   * @returns The updated product offer with its associated ProductBase
   * @throws {RpcException} If no fields are provided to update
   * @throws {RpcException} If the product offer is not found
   * @throws {RpcException} If there's a database error during update
   */
  async update(
    id: string,
    updateProductOfferDto: UpdateProductOfferDto,
  ): Promise<ProductOfferWithBase> {
    try {
      if (Object.keys(updateProductOfferDto).length === 0) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'At least one field must be provided to update',
        });
      }

      const productOfferExist = await this.findOne(id);

      if (!productOfferExist) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'Product offer not found',
        });
      }

      const updatedProductOffer = await this.productOffer.update({
        where: { id },
        data: updateProductOfferDto,
        include: { productBase: true },
      });

      this.logger.log(`ProductOffer updated: ${id}`);
      return updatedProductOffer;
    } catch (error: unknown) {
      if (error instanceof RpcException) throw error;

      this.logger.error(
        `Error updating product offer with id ${id}`,
        (error as Error).stack,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to update product offer',
      });
    }
  }

  /**
   * Deletes a product offer
   * @param id - The MongoDB ObjectId of the product offer to delete
   * @returns Confirmation message with the deleted product offer ID
   * @throws {RpcException} If the product offer is not found
   * @throws {RpcException} If there's a database error during deletion
   */
  async remove(id: string): Promise<{ message: string; id: string }> {
    try {
      const productOffer = await this.findOne(id);

      if (!productOffer) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `ProductOffer with id '${id}' not found`,
        });
      }

      await this.productOffer.delete({ where: { id } });

      this.logger.log(`ProductOffer deleted: ${id}`);
      return { message: 'ProductOffer deleted successfully', id };
    } catch (error: unknown) {
      if (error instanceof RpcException) throw error;

      this.logger.error(
        `Error deleting product offer with id ${id}`,
        (error as Error).stack,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to delete product offer',
      });
    }
  }
}
