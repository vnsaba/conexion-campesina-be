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
import { CreateUnitDto } from 'apps/product-service/src/unit/dto/create-unit.dto';
import { UpdateUnitDto } from 'apps/product-service/src/unit/dto/update-unit.dto';
import { RoleProtected } from 'apps/client-gateway/auth/guards/decorators';
import { ValidRoles } from '../../auth/enum/valid-roles.enum';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

const NATS_SERVICE_KEY = process.env.NATS_SERVICE_KEY;

/**
 * Exposes REST endpoints to manage Unit entities.
 * Proxies requests to product-service via NATS message patterns (product.*Unit).
 * Protected by AuthGuard and restricted by RolesGuard.
 */
@ApiTags('Units')
@ApiBearerAuth('bearer')
@Controller('product/unit')
export class UnitController {
  constructor(
    @Inject(NATS_SERVICE_KEY)
    private readonly natsClient: ClientProxy,
  ) {}

  /**
   * Creates a new Unit.
   * Sends message pattern: 'product.createUnit'
   * Authorization: ADMIN only
   */
  @ApiOperation({ summary: 'Create a new unit' })
  @ApiBody({ type: CreateUnitDto })
  @ApiResponse({ status: 201, description: 'Unit created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or duplicate name' })
  @RoleProtected(ValidRoles.ADMIN)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Post('')
  createUnit(@Body() createUnitDto: CreateUnitDto) {
    return this.natsClient.send('product.createUnit', createUnitDto).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Retrieves all Units.
   * Sends message pattern: 'product.findAllUnit'
   * Authorization: ADMIN or PRODUCER
   */
  @ApiOperation({ summary: 'Retrieve all available units' })
  @ApiResponse({ status: 200, description: 'List of all units' })
  @RoleProtected(ValidRoles.ADMIN)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('')
  findAllUnits() {
    return this.natsClient.send('product.findAllUnit', {}).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Retrieves a Unit by its ID.
   * Sends message pattern: 'product.findOneUnit'
   * Authorization: ADMIN or PRODUCER
   */
  @ApiOperation({ summary: 'Retrieve a unit by ID' })
  @ApiParam({ name: 'id', description: 'Unit ID' })
  @ApiResponse({ status: 200, description: 'Unit found' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  @RoleProtected(ValidRoles.ADMIN)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get(':id')
  findOneUnit(@Param('id') id: string) {
    return this.natsClient.send('product.findOneUnit', id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Updates a Unit by its ID.
   * Sends message pattern: 'product.updateUnit'
   * Payload shape: { id, ...updateUnitDto }
   * Authorization: ADMIN only
   */
  @ApiOperation({ summary: 'Update a unit by ID' })
  @ApiParam({ name: 'id', description: 'Unit ID to update' })
  @ApiBody({ type: UpdateUnitDto })
  @ApiResponse({ status: 200, description: 'Unit updated successfully' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  @RoleProtected(ValidRoles.ADMIN)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Patch(':id')
  updateUnit(@Param('id') id: string, @Body() updateUnitDto: UpdateUnitDto) {
    console.log('Updating unit with ID:', id, 'Data:', updateUnitDto);
    return this.natsClient
      .send('product.updateUnit', {
        id,
        updateUnit: updateUnitDto,
      })
      .pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      );
  }

  /**
   * Removes a Unit by its ID.
   * Sends message pattern: 'product.removeUnit'
   * Authorization: ADMIN only
   */
  @ApiOperation({ summary: 'Delete a unit by ID' })
  @ApiParam({ name: 'id', description: 'Unit ID to delete' })
  @ApiResponse({ status: 200, description: 'Unit deleted successfully' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  @RoleProtected(ValidRoles.ADMIN)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Delete(':id')
  removeUnit(@Param('id') id: string) {
    return this.natsClient.send('product.removeUnit', id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }
}
