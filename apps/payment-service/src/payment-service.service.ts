import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/create-payment.dto';
import { Request, Response } from 'express';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class PaymentServiceService {
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET!);
  private readonly logger = new Logger('PaymentServiceService');

  constructor(
    @Inject('NATS_SERVICE') private readonly natsClient: ClientProxy,
  ) {}

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {
    const { currency, items, orderId } = paymentSessionDto;

    const lineItems = items.map((item) => {
      return {
        price_data: {
          currency: currency,
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      };
    });

    const session = await this.stripe.checkout.sessions.create({
      metadata: {
        orderId: orderId,
      },
      payment_intent_data: {
        metadata: {
          orderId: orderId,
        },
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: process.env.STRIPE_SUCCESS_URL!,
      cancel_url: process.env.STRIPE_CANCEL_URL!,
    });

    return {
      cancelUrl: session.cancel_url,
      successUrl: session.success_url,
      url: session.url,
    };
  }

  async stripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'];
    let event: Stripe.Event;

    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !endpointSecret) {
      return res.status(400).send('Webhook Error: Missing signature or secret');
    }

    try {
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'],
        sig,
        endpointSecret,
      );
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        let receiptUrl = 'Recibo no disponible';

        if (session.payment_intent) {
          try {
            const paymentIntent = await this.stripe.paymentIntents.retrieve(
              session.payment_intent as string,
              { expand: ['latest_charge'] },
            );

            const charge = paymentIntent.latest_charge as Stripe.Charge;
            receiptUrl =
              charge.receipt_url || session.success_url || 'Sin recibo';
          } catch (error) {
            this.logger.error('No se pudo obtener el recibo de Stripe', error);
          }
        }
        const payload = {
          stripePaymentId: session.id,
          orderId: session.metadata?.orderId,
          receiptUrl: receiptUrl,
        };
        console.log('receiptUrl:', receiptUrl);

        this.natsClient.emit('payment.paid', payload);

        this.logger.log(
          `Payment Session Completed for Order: ${payload.orderId}`,
        );
        break;
      }

      default:
        console.log(`Event ${event.type} not handled`);
    }

    return res.status(200).json({ sig });
  }
}
