import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { connect, NatsConnection, Subscription } from 'nats';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger('NotificationService');
  private readonly producerStreams = new Map<string, Subject<MessageEvent>>();
  private natsConnection: NatsConnection | null = null;
  private subscriptions = new Map<string, Subscription>();

  async onModuleInit() {
    try {
      const NATS_SERVERS = process.env.NATS_SERVERS?.split(',') || [
        'nats://localhost:4222',
      ];
      this.natsConnection = await connect({
        servers: NATS_SERVERS,
      });
      this.logger.log('Connected to NATS for notifications');
    } catch (error) {
      this.logger.error('Failed to connect to NATS', error);
    }
  }

  getNotificationStream(producerId: string): Observable<MessageEvent> {
    if (!this.producerStreams.has(producerId)) {
      const subject = new Subject<MessageEvent>();
      this.producerStreams.set(producerId, subject);

      if (this.natsConnection) {
        const subscription = this.natsConnection.subscribe(
          `notification.producer.${producerId}`,
          {
            callback: (err, msg) => {
              if (err) {
                this.logger.error(
                  `Error receiving notification for producer ${producerId}`,
                  err,
                );
                return;
              }

              try {
                const rawData = new TextDecoder().decode(msg.data);
                let payload: any;
                try {
                  payload = JSON.parse(rawData);
                } catch {
                  payload = rawData;
                }

                if (
                  payload &&
                  typeof payload === 'object' &&
                  'data' in payload
                ) {
                  payload = payload.data;
                }

                const message: MessageEvent = {
                  type: payload.type || 'message',
                  data: JSON.stringify(payload),
                } as MessageEvent;

                subject.next(message);
              } catch (error) {
                this.logger.error(
                  `Error parsing notification for producer ${producerId}`,
                  error,
                );
              }
            },
          },
        );

        this.subscriptions.set(producerId, subscription);
      }

      const heartbeat = setInterval(() => {
        if (!subject.closed) {
          subject.next({
            type: 'ping',
            data: JSON.stringify({ timestamp: new Date().toISOString() }),
          } as MessageEvent);
        } else {
          clearInterval(heartbeat);
        }
      }, 30000);
    }

    return this.producerStreams.get(producerId)!.asObservable();
  }

  removeStream(producerId: string): void {
    const stream = this.producerStreams.get(producerId);
    if (stream) {
      stream.complete();
      this.producerStreams.delete(producerId);
    }

    const subscription = this.subscriptions.get(producerId);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(producerId);
    }
  }
}
