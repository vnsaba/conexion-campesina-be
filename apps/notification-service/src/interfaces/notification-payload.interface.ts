export interface NotificationPayload {
  orderId: string;
  producerIds: string[];
  clientName: string;
  address: string;
  totalAmount: number;
  productCount: number;
  orderDate: Date;
}

export interface LowStockPayload {
  producerId: string;
  productOfferId: string;
  available_quantity: number;
  minimum_threshold: number;
}
