import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  HttpStatus,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

import { PrismaClient } from '../../generated/prisma';
import { CreateProductBaseDto } from './dto/create-product-base.dto';
import { UpdateProductBaseDto } from './dto/update-product-base.dto';

/**
 * Service responsible for managing ProductBase entities
 */
@Injectable()
export class ProductBaseService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('ProductBaseService');

  /**
   * Initializes the database connection when the module starts
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  /**
   * Creates a new product base
   * @param createProductBaseDto - Data Transfer Object for creating a product base
   * @returns The created product base
   * @throws {RpcException} If a product with the same name and category already exists
   */
  async create(createProductBase: CreateProductBaseDto) {
    const { name, category } = createProductBase;

    try {
      const productExist = await this.productBase.findFirst({
        where: { name, category },
      });

      if (productExist) {
        throw new RpcException({
          status: HttpStatus.CONFLICT,
          message: `Product base '${name}' already exists in category '${category}'`,
        });
      }

      const product = await this.productBase.create({
        data: createProductBase,
      });

      this.logger.log(`ProductBase created: ${product.id}`);
      return product;
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      this.logger.error('Error creating product base', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to create product base',
      });
    }
  }

  /**
   * Retrieves all product bases
   * @returns An array of product bases ordered by name
   */
  async findAll() {
    try {
      return await this.productBase.findMany({
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      this.logger.error('Error fetching product bases', error.stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch product bases',
      });
    }
  }

  /**
   * Retrieves a product base by its ID
   * @param id - The MongoDB ObjectId of the product base
   * @returns The product base with its associated offers
   * @throws {RpcException} If the product base is not found
   */
  async findOne(id: string) {
    try {
      const product = await this.productBase.findUnique({
        where: { id },
        include: { offers: true },
      });

      if (!product) {
        throw new NotFoundException(`ProductBase with id '${id}' not found`);
      }

      return product;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: error.message,
        });
      }

      this.logger.error(
        `Error fetching product base with id ${id}`,
        error.stack,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch product base',
      });
    }
  }

  /**
   * Updates an existing product base
   * @param id - The MongoDB ObjectId of the product base
   * @param updateProductBaseDto - Data Transfer Object with fields to update
   * @returns The updated product base with its offers
   * @throws {RpcException} If no fields are provided or product is not found
   */
  async update(id: string, updateProductBaseDto: UpdateProductBaseDto) {
    try {
      if (Object.keys(updateProductBaseDto).length === 0) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'At least one field must be provided to update',
        });
      }

      const productBaseExist = await this.findOne(id);

      if (!productBaseExist) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'Product base not found',
        });
      }

      const productUpdate = await this.productBase.update({
        where: { id },
        data: updateProductBaseDto,
      });

      this.logger.log(`ProductBase updated: ${id}`);
      return productUpdate;
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      this.logger.error(
        `Error updating product base with id ${id}`,
        error.stack,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to update product base',
      });
    }
  }

  /**
   * Deletes a product base
   * @param id - The MongoDB ObjectId of the product base
   * @returns Confirmation message with the deleted product base ID
   * @throws {RpcException} If product is not found or has associated offers
   */
  async remove(id: string) {
    try {
      const productBaseExist = await this.findOne(id);

      if (!productBaseExist) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `ProductBase with id '${id}' not found`,
        });
      }

      const offersCount = await this.productOffer.count({
        where: { productBaseId: id },
      });

      if (offersCount > 0) {
        throw new RpcException({
          status: HttpStatus.CONFLICT,
          message: `Cannot delete ProductBase with ${offersCount} associated offers. Delete offers first.`,
        });
      }

      await this.productBase.delete({ where: { id } });

      this.logger.log(`ProductBase deleted: ${id}`);
      return { message: 'ProductBase deleted successfully', id };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      this.logger.error(
        `Error deleting product base with id ${id}`,
        error.stack,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to delete product base',
      });
    }
  }
}
