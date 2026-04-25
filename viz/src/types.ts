export interface OrderItem {
  order_id: string;
  customer_id: string;
  seller_id: string;
  customer_lat: number;
  customer_lng: number;
  seller_lat: number;
  seller_lng: number;
  departure_delta: number;
  arrival_delta: number;
  order_purchase_timestamp: Date;
  order_approved_at: Date;
  order_delivered_carrier_date: Date;
  order_estimated_delivery_date: Date;
  order_delivered_customer_date: Date;
}

