import { OrderStatus } from 'apps/order-service/generated/prisma';

export interface OrderWithProducts {
  clientId: string;
  id: string;
  status: OrderStatus;
  totalAmount: number;
  totalItems: number;
  address: string;
  orderDate: Date;
  createdAt: Date;
  updatedAt: Date;
  orderDetails: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    productOfferId: string;
    quantity: number;
    price: number;
    subtotal: number;
    orderId: string;
  }[];
}
