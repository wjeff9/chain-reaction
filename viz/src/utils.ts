import * as d3 from 'd3';
import { OrderItem } from './types';

export const loadData = async (): Promise<OrderItem[]> => {
  const data = await d3.csv('/data/olist_data.csv', (d: any) => {
    return {
      order_id: d.order_id,
      customer_id: d.customer_id,
      seller_id: d.seller_id,
      customer_lat: +d.customer_lat,
      customer_lng: +d.customer_lng,
      seller_lat: +d.seller_lat,
      seller_lng: +d.seller_lng,
      departure_delta: +d.departure_delta,
      arrival_delta: +d.arrival_delta,
      order_purchase_timestamp: new Date(d.order_purchase_timestamp),
      order_approved_at: new Date(d.order_approved_at),
      order_delivered_carrier_date: new Date(d.order_delivered_carrier_date),
      order_estimated_delivery_date: new Date(d.order_estimated_delivery_date),
      order_delivered_customer_date: new Date(d.order_delivered_customer_date),
    };
  });
  return data as OrderItem[];
};

// Haversine distance in km
export const haversineDistance = (
  coords1: [number, number],
  coords2: [number, number]
) => {
  const toRad = (x: number) => (x * Math.PI) / 180;

  const lon1 = coords1[0];
  const lat1 = coords1[1];
  const lon2 = coords2[0];
  const lat2 = coords2[1];

  const R = 6371; // Earth radius in km
  const x1 = lat2 - lat1;
  const dLat = toRad(x1);
  const x2 = lon2 - lon1;
  const dLon = toRad(x2);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
