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

type ProductOfferWithRelations = Prisma.ProductOfferGetPayload<{
  include: { productBase: true; unit: true };
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
   * Creates a new product offer and returns it including its ProductBase and Unit
   * @param createProductOfferDto - Data transfer object containing product offer information
   * @returns The created product offer with its associated ProductBase and Unit
   * @throws {RpcException} If ProductBase doesn't exist
   * @throws {RpcException} If Unit doesn't exist
   * @throws {RpcException} If a product offer with the same name, producerId and productBaseId already exists
   * @throws {RpcException} If there's a database error during creation
   */
  async create(
    createProductOfferDto: CreateProductOfferDto,
  ): Promise<ProductOfferWithRelations> {
    const { productBaseId, producerId, name, unitId } = createProductOfferDto;

    try {
      const productBase = await this.productBase.findUnique({
        where: { id: productBaseId },
      });

      if (!productBase) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `ProductBase with id '${productBaseId}' not found`,
        });
      }

      const unit = await this.unit.findUnique({
        where: { id: unitId },
      });

      if (!unit) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `Unit with id '${unitId}' not found`,
        });
      }

      const existingProductOffer = await this.productOffer.findFirst({
        where: { productBaseId, producerId, name },
      });

      if (existingProductOffer) {
        throw new RpcException({
          status: HttpStatus.CONFLICT,
          message: `Product offer '${name}' already exists for this producer and product base`,
        });
      }

      const createdProductOffer = await this.productOffer.create({
        data: {
          ...createProductOfferDto,
          isAvailable: createProductOfferDto.isAvailable ?? true,
        },
        include: {
          productBase: true,
          unit: true,
        },
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
   * Returns all product offers including their ProductBase and Unit
   * @returns Array of all product offers ordered by creation date (newest first)
   * @throws {RpcException} If there's a database error during retrieval
   */
  async findAll(): Promise<ProductOfferWithRelations[]> {
    try {
      const productOffers = await this.productOffer.findMany({
        include: {
          productBase: true,
          unit: true,
        },
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
   * Returns a product offer by id including its ProductBase and Unit
   * @param id - The MongoDB ObjectId of the product offer
   * @returns The product offer with its associated ProductBase and Unit
   * @throws {RpcException} If the product offer is not found
   * @throws {RpcException} If there's a database error during retrieval
   */
  async findOne(id: string): Promise<ProductOfferWithRelations> {
    try {
      const productOffer = await this.productOffer.findUnique({
        where: { id },
        include: {
          productBase: true,
          unit: true,
        },
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
   * Updates a product offer and returns it including its ProductBase and Unit
   * @param id - The MongoDB ObjectId of the product offer to update
   * @param updateProductOfferDto - Data transfer object with fields to update
   * @returns The updated product offer with its associated ProductBase and Unit
   * @throws {RpcException} If no fields are provided to update
   * @throws {RpcException} If ProductBase doesn't exist (when updating productBaseId)
   * @throws {RpcException} If Unit doesn't exist (when updating unitId)
   * @throws {RpcException} If the product offer is not found
   * @throws {RpcException} If there's a database error during update
   */
  async update(
    id: string,
    updateProductOfferDto: UpdateProductOfferDto,
  ): Promise<ProductOfferWithRelations> {
    try {
      if (Object.keys(updateProductOfferDto).length === 0) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'At least one field must be provided to update',
        });
      }

      await this.findOne(id);

      if (updateProductOfferDto.productBaseId) {
        const productBase = await this.productBase.findUnique({
          where: { id: updateProductOfferDto.productBaseId },
        });

        if (!productBase) {
          throw new RpcException({
            status: HttpStatus.NOT_FOUND,
            message: `ProductBase with id '${updateProductOfferDto.productBaseId}' not found`,
          });
        }
      }

      if (updateProductOfferDto.unitId) {
        const unit = await this.unit.findUnique({
          where: { id: updateProductOfferDto.unitId },
        });

        if (!unit) {
          throw new RpcException({
            status: HttpStatus.NOT_FOUND,
            message: `Unit with id '${updateProductOfferDto.unitId}' not found`,
          });
        }
      }

      const updatedProductOffer = await this.productOffer.update({
        where: { id },
        data: updateProductOfferDto,
        include: {
          productBase: true,
          unit: true,
        },
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
      await this.findOne(id);

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

  /**
   * Validates if multiple product offers exist
   * @param ids - Array of product offer IDs to validate
   * @returns Object with validation result and missing IDs if any
   */
  async validateMany(
    ids: string[],
  ): Promise<{ valid: boolean; missingIds: string[] }> {
    try {
      const productOffers = await this.productOffer.findMany({
        where: {
          id: {
            in: ids,
          },
        },
        select: {
          id: true,
        },
      });

      const foundIds = productOffers.map((po) => po.id);
      const missingIds = ids.filter((id) => !foundIds.includes(id));

      return {
        valid: missingIds.length === 0,
        missingIds,
      };
    } catch (error: unknown) {
      this.logger.error(
        'Error validating product offers',
        (error as Error).stack,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to validate product offers',
      });
    }
  }
}
