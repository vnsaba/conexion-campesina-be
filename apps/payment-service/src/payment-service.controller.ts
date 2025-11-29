import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { PaymentServiceService } from './payment-service.service';
import { PaymentSessionDto } from './dto/create-payment.dto';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller('payments')
export class PaymentServiceController {
  constructor(private readonly paymentServiceService: PaymentServiceService) {}

  @MessagePattern('create.payment.session')
  createPaymentSession(@Payload() paymentSessionDto: PaymentSessionDto) {
    return this.paymentServiceService.createPaymentSession(paymentSessionDto);
  }

  @Post('webhook')
  stripeWebhook(@Req() req: Request, @Res() res: Response) {
    return this.paymentServiceService.stripeWebhook(req, res);
  }
}
