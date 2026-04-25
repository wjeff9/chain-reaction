import * as d3 from 'd3';
import { OrderItem } from './types';

// Truncate a datetime string to YYYY-MM-DD and construct a local-time Date.
const parseDate = (s: string): Date => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const loadData = async (): Promise<OrderItem[]> => {
  const data = await d3.csv(`${import.meta.env.BASE_URL}data/olist_data.csv`, (d: any) => {
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
      order_purchase_timestamp: parseDate(d.order_purchase_timestamp),
      order_approved_at: parseDate(d.order_approved_at),
      order_delivered_carrier_date: parseDate(d.order_delivered_carrier_date),
      order_estimated_delivery_date: parseDate(d.order_estimated_delivery_date),
      order_delivered_customer_date: parseDate(d.order_delivered_customer_date),
    };
  });
  return data as OrderItem[];
};

// Three delivery phases for the Gantt chart; phases with invalid dates are excluded.
export function buildGanttPhases(item: OrderItem) {
  return [
    { name: 'Approval', start: item.order_purchase_timestamp, end: item.order_approved_at, expectedEnd: item.order_approved_at },
    { name: 'Processing', start: item.order_approved_at, end: item.order_delivered_carrier_date, expectedEnd: item.order_delivered_carrier_date },
    { name: 'Shipping', start: item.order_delivered_carrier_date, end: item.order_delivered_customer_date, expectedEnd: item.order_estimated_delivery_date },
  ].filter(p => !isNaN(p.start.getTime()) && !isNaN(p.end.getTime()));
}

// k nearest customers by haversine distance within ±windowDays of the anchor order.
export function computeKNNNeighbors(anchor: OrderItem, allData: OrderItem[], k = 5, windowDays = 3) {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const anchorTime = anchor.order_purchase_timestamp.getTime();
  const candidates = allData.filter(d =>
    d.order_id !== anchor.order_id &&
    Math.abs(d.order_purchase_timestamp.getTime() - anchorTime) <= windowMs
  );
  return Array.from(d3.rollup(candidates, v => v[0], d => d.customer_id).values())
    .map(d => ({ ...d, dist: haversineDistance([anchor.customer_lng, anchor.customer_lat], [d.customer_lng, d.customer_lat]) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, k);
}

// Shared D3 tooltip <div> appended to body; call .remove() in useEffect cleanup.
export function createTooltip() {
  return d3.select('body').append('div')
    .style('position', 'absolute')
    .style('visibility', 'hidden')
    .style('background', 'var(--panel-bg)')
    .style('color', 'var(--text)')
    .style('padding', '0.5rem')
    .style('border', '1px solid var(--border)')
    .style('border-radius', '0.25rem')
    .style('pointer-events', 'none')
    .style('font-size', '0.75rem')
    .style('z-index', '1000')
    .style('white-space', 'pre-wrap')
    .style('box-shadow', '0 4px 6px rgba(0,0,0,0.3)');
}

// Haversine distance in km
const haversineDistance = (
  coords1: [number, number],
  coords2: [number, number]
) => {
  const toRad = (x: number) => (x * Math.PI) / 180;

  const lon1 = coords1[0];
  const lat1 = coords1[1];
  const lon2 = coords2[0];
  const lat2 = coords2[1];

  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
