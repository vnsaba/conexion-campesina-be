import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { catchError, firstValueFrom } from 'rxjs';
import { AuthGuard } from '../auth/guards/auth.guards';
import { UserRoleGuard } from '../auth/guards/user-role.guard';
import { RoleProtected } from '../auth/guards/decorators';
import { ValidRoles } from '../auth/enum/valid-roles.enum';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

const NATS_SERVICE_KEY = process.env.NATS_SERVICE_KEY;

@ApiTags('Shipping')
@ApiBearerAuth('bearer')
@Controller('shipping')
export class ShippingController {
  constructor(
    @Inject(NATS_SERVICE_KEY)
    private readonly natsClient: ClientProxy,
  ) {}

  /**
   * Creates a shipping receipt for an order
   * @param orderId - The order ID to create the shipping receipt for
   * @returns The created shipping receipt
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.CLIENT)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Post(':orderId')
  createShipping(@Param('orderId') orderId: string) {
    return this.natsClient.send('create.Shipping', orderId).pipe(
      catchError((error) => {
        throw new RpcException({
          status: error.status || 500,
          message: error.message || 'Failed to create shipping receipt',
        });
      }),
    );
  }

  /**
   * Find a shipping receipt by its ID
   * @param id - The shipping receipt ID
   * @returns The shipping receipt
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.CLIENT, ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.natsClient.send('findOne.Shipping', id).pipe(
      catchError((error) => {
        throw new RpcException({
          status: error.status || 404,
          message: error.message || 'Shipping receipt not found',
        });
      }),
    );
  }

  /**
   * Find a shipping receipt by order ID
   * @param orderId - The order ID
   * @returns The shipping receipt associated with the order
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.CLIENT, ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('order/:orderId')
  findReceiptByOrder(@Param('orderId') orderId: string) {
    return this.natsClient.send('find.Receipt.By.Order', orderId).pipe(
      catchError((error) => {
        throw new RpcException({
          status: error.status || 404,
          message: error.message || 'Receipt not found for this order',
        });
      }),
    );
  }

  /**
   * Generate and download shipping document PDF
   * @param orderId - The order ID to generate the PDF for
   * @param res - Express response object
   * @returns PDF file as a download
   */
  @RoleProtected(ValidRoles.ADMIN, ValidRoles.CLIENT, ValidRoles.PRODUCER)
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('document/:orderId')
  async generateShippingDocument(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    try {
      const response = await firstValueFrom(
        this.natsClient.send('generate.Shipping.Document', orderId).pipe(
          catchError((error) => {
            throw new RpcException({
              status: error.status || 500,
              message: error.message || 'Failed to generate PDF',
            });
          }),
        ),
      );

      // Convert base64 PDF to Buffer
      const pdfBuffer = Buffer.from(response.pdf as string, 'base64');

      // Set headers for PDF download
      res.set({
        'Content-Type': response.contentType || 'application/pdf',
        'Content-Disposition': `attachment; filename="${response.filename || `shipping-receipt-${orderId}.pdf`}"`,
        'Content-Length': pdfBuffer.length,
      });

      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (err: any) {
      throw new RpcException({
        status: err.status || HttpStatus.INTERNAL_SERVER_ERROR,
        message: err.message || 'Failed to generate shipping document',
      });
    }
  }
}
