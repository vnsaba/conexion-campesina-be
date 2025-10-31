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
import { ApiBearerAuth } from '@nestjs/swagger';

const NATS_SERVICE_KEY = process.env.NATS_SERVICE_KEY;

@ApiBearerAuth('bearer')
@Controller('product/unit')
export class UnitController {
  constructor(
    @Inject(NATS_SERVICE_KEY)
    private readonly natsClient: ClientProxy,
  ) {}

  /**
   * Creates a new unit.
   * Sends unit data to the NATS product service for unit creation.
   */
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
   * Retrieves all units.
   * Sends request to the NATS product service and returns the list of units.
   */
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
   * Retrieves a specific unit by ID.
   * Sends request to the NATS product service and returns the unit data.
   */
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
   * Updates a unit.
   * Sends updated data to the NATS product service and returns the updated unit.
   */
  @RoleProtected(ValidRoles.ADMIN)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Patch(':id')
  updateUnit(@Param('id') id: string, @Body() updateUnitDto: UpdateUnitDto) {
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
   * Deletes a unit.
   * Sends deletion request to the NATS product service.
   */
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
