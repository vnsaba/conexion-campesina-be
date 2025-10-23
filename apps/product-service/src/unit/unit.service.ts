import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaClient } from '../../generated/prisma';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

/**
 * Service responsible for managing Unit entities
 */
@Injectable()
export class UnitService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('UnitService');

  /**
   * Initializes the database connection when the module starts
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  /**
   * Creates a new unit
   * - Prevents duplicates by checking (name, symbol, type)
   * @param createUnitDto - Data Transfer Object to create a unit
   * @returns The created unit
   * @throws {RpcException} CONFLICT if a unit with same name/symbol/type already exists
   * @throws {RpcException} INTERNAL_SERVER_ERROR on database errors
   */
  async create(createUnitDto: CreateUnitDto) {
    const { name, symbol, type } = createUnitDto;

    try {
      const exists = await this.unit.findFirst({
        where: { name, symbol, type },
      });

      if (exists) {
        throw new RpcException({
          status: HttpStatus.CONFLICT,
          message: `Unit '${name}' (${symbol}, ${type}) already exists`,
        });
      }

      const unit = await this.unit.create({ data: createUnitDto });
      this.logger.log(`Unit created: ${unit.id}`);
      return unit;
    } catch (error) {
      if (error instanceof RpcException) throw error;

      this.logger.error('Error creating unit', (error as Error).stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to create unit',
      });
    }
  }

  /**
   * Retrieves all units
   * @returns An array of units
   * @throws {RpcException} INTERNAL_SERVER_ERROR on database errors
   */
  async findAll() {
    try {
      return await this.unit.findMany();
    } catch (error) {
      this.logger.error('Error fetching units', (error as Error).stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch units',
      });
    }
  }

  /**
   * Retrieves a unit by its ID
   * @param id - The MongoDB ObjectId of the unit
   * @returns The unit if found
   * @throws {RpcException} NOT_FOUND if the unit does not exist
   * @throws {RpcException} INTERNAL_SERVER_ERROR on database errors
   */
  async findOne(id: string) {
    try {
      const unit = await this.unit.findUnique({ where: { id } });

      if (!unit) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `Unit with id '${id}' not found`,
        });
      }

      return unit;
    } catch (error) {
      if (error instanceof RpcException) throw error;

      this.logger.error(`Error fetching unit ${id}`, (error as Error).stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch unit',
      });
    }
  }

  /**
   * Updates an existing unit
   * - Prevents duplicates by checking (name, symbol, type)
   * @param id - The MongoDB ObjectId of the unit
   * @param updateUnitDto - Data Transfer Object with fields to update
   * @returns The updated unit
   * @throws {RpcException} BAD_REQUEST if no fields are provided
   * @throws {RpcException} CONFLICT if another unit with same name/symbol/type exists
   * @throws {RpcException} INTERNAL_SERVER_ERROR on database errors
   */
  async update(id: string, updateUnitDto: UpdateUnitDto) {
    try {
      this.logger.log(
        `Unit updated: ${id}, Data: ${JSON.stringify(updateUnitDto)}`,
      );
      if (Object.keys(updateUnitDto).length === 0) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'At least one field must be provided to update',
        });
      }

      const current = await this.findOne(id);

      // Validate duplicates if name/symbol/type change
      const name = updateUnitDto.name ?? current.name;
      const symbol = updateUnitDto.symbol ?? current.symbol;
      const type = updateUnitDto.type ?? current.type;

      const duplicated = await this.unit.findFirst({
        where: {
          name,
          symbol,
          type,
          NOT: { id },
        },
      });

      if (duplicated) {
        throw new RpcException({
          status: HttpStatus.CONFLICT,
          message: `Another unit with '${name}' (${symbol}, ${type}) already exists`,
        });
      }

      const updated = await this.unit.update({
        where: { id },
        data: updateUnitDto,
      });

      this.logger.log(`Unit updated: ${id}`);
      return updated;
    } catch (error) {
      if (error instanceof RpcException) throw error;

      this.logger.error(`Error updating unit ${id}`, (error as Error).stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to update unit',
      });
    }
  }

  /**
   * Deletes a unit
   * - Only if there are no associated product offers
   * @param id - The MongoDB ObjectId of the unit
   * @returns Confirmation message with the deleted unit ID
   * @throws {RpcException} CONFLICT if the unit has associated offers
   * @throws {RpcException} INTERNAL_SERVER_ERROR on database errors
   */
  async remove(id: string) {
    try {
      await this.findOne(id);

      const offersCount = await this.productOffer.count({
        where: { unitId: id },
      });

      if (offersCount > 0) {
        throw new RpcException({
          status: HttpStatus.CONFLICT,
          message: `Cannot delete Unit with ${offersCount} associated offers. Delete offers first.`,
        });
      }

      await this.unit.delete({ where: { id } });

      this.logger.log(`Unit deleted: ${id}`);
      return { message: 'Unit deleted successfully', id };
    } catch (error) {
      if (error instanceof RpcException) throw error;

      this.logger.error(`Error deleting unit ${id}`, (error as Error).stack);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to delete unit',
      });
    }
  }
}
