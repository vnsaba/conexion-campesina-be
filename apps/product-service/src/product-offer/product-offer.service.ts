import {
  Injectable,
  Logger,
  OnModuleInit,
  HttpStatus,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ClientProxy } from '@nestjs/microservices';
import { Category, Prisma, PrismaClient } from '../../generated/prisma';
import { CreateProductOfferDto } from './dto/create-product-offer.dto';
import { UpdateProductOfferDto } from './dto/update-product-offer.dto';
import { CategoryEnum } from './enum/category.enum';
import { catchError, firstValueFrom, of } from 'rxjs';

type ProductOfferWithRelations = Prisma.ProductOfferGetPayload<{
  include: { productBase: true };
}> & { producerName?: string };

@Injectable()
export class ProductOfferService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('ProductOfferService');
  constructor(
    @Inject(process.env.NATS_SERVICE_KEY || 'NATS_SERVICE')
    private readonly natsClient: ClientProxy,
  ) {
    super();
  }
  /**
   * Initializes the database connection when the module starts
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  /**
   * Creates a new product offer
   * @param createProductOfferDto - Data Transfer Object for creating a product offer
   * @param producerId - The identifier of the producer creating the offer
   * @returns The created product offer with its associated ProductBase and Unit
   * @throws {RpcException} If the referenced ProductBase does not exist
   * @throws {RpcException} If a product offer with the same name already exists for the producer and product base
   * @throws {RpcException} If there's a database error during creation
   */
  async create(
    createProductOfferDto: CreateProductOfferDto,
    producerId: string,
  ): Promise<ProductOfferWithRelations> {
    const { productBaseId, name } = createProductOfferDto;

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
          producerId,
        },
        include: {
          productBase: true,
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
        },
        orderBy: { createdAt: 'desc' },
      });
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
        },
      });

      if (!productOffer) {
        throw new NotFoundException(`ProductOffer with id '${id}' not found`);
      }

      const userProduct = await firstValueFrom(
        this.natsClient.send('auth.get.user', productOffer.producerId).pipe(
          catchError(() =>
            of({
              id: productOffer.producerId,
              fullName: 'Unknown Client',
            }),
          ),
        ),
      );

      return { ...productOffer, producerName: userProduct.fullName };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: error.message,
        });
      }
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

      const productNow = await this.findOne(id);
      const { producerId } = productNow;

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

      if (updateProductOfferDto.productBaseId && updateProductOfferDto.name) {
        const { productBaseId, name } = updateProductOfferDto;
        const existingProductOffer = await this.productOffer.findMany({
          where: {
            productBaseId,
            producerId,
            name,
            NOT: { id },
          },
        });

        if (existingProductOffer.length > 0) {
          throw new RpcException({
            status: HttpStatus.CONFLICT,
            message: `Product offer '${name}' already exists for this producer and product base`,
          });
        }
      }

      const updatedProductOffer = await this.productOffer.update({
        where: { id },
        data: updateProductOfferDto,
        include: {
          productBase: true,
        },
      });
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
   * Returns all product offers for a specific producer including their ProductBase and Unit
   * @param producerId - The producer's identifier
   * @returns Array of product offers for the specified producer ordered by creation date (newest first)
   * @throws {RpcException} If there's a database error during retrieval
   */
  async findAllProduct(
    producerId: string,
  ): Promise<ProductOfferWithRelations[]> {
    try {
      return await this.productOffer.findMany({
        where: { producerId },
        include: {
          productBase: true,
        },
        orderBy: { createdAt: 'desc' },
      });
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

  async findAllProductOffersByName(
    name: string,
  ): Promise<ProductOfferWithRelations[]> {
    try {
      const productOffers = await this.productOffer.findMany({
        where: {
          name: {
            contains: name,
            mode: 'insensitive',
          },
        },
        include: {
          productBase: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return productOffers;
    } catch (error: unknown) {
      this.logger.error(
        `Error retrieving product offers by name '${name}'`,
        (error as Error).stack,
      );
      if (error instanceof RpcException) throw error;

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve product offers by name',
      });
    }
  }

  async findAllProductOffersByCategory(category: string) {
    try {
      if (!category) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'Category must be provided',
        });
      }

      const cat = category.trim().toLocaleUpperCase();

      if (!CategoryEnum[cat]) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `Category '${category}' not found`,
        });
      }

      const allProducts = await this.productOffer.findMany({
        include: { productBase: true },
        where: { productBase: { category: cat as Category } },
      });

      return allProducts;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve product offers by category',
      });
    }
  }
}
