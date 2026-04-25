import { useState, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { OrderItem } from '../types';

export interface SelectedLocation {
  lat: number;
  lng: number;
  type: 'customer' | 'seller';
}

interface MapNode {
  lat: number;
  lng: number;
  isLate: boolean;
  px: number;
  py: number;
}

interface ConnectionLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isLate: boolean;
}

interface Counterpart {
  px: number;
  py: number;
  lat: number;
  lng: number;
  isLate: boolean;
}

export const SVG_SIZE = 800;

// Rough bounding box for mainland Brazil, used to exclude bogus coordinates
const inBrazil = (lat: number, lng: number) =>
  lat >= -33.75 && lat <= 5.27 && lng >= -73.99 && lng <= -28.85;

export function useMapData(
  data: OrderItem[],
  selectedOrderId: string | null,
  displayMode: 'customer' | 'seller',
  showOnTime: boolean,
  showLate: boolean,
  weekIdx: number,
  selectedLocation: SelectedLocation | null,
  selectedParticipantId: string | null,
) {
  const [geoData, setGeoData] = useState<d3.GeoPermissibleObjects | null>(null);

  useEffect(() => {
    d3.json(`${import.meta.env.BASE_URL}brazil.json`).then(json => setGeoData(json as d3.GeoPermissibleObjects));
  }, []);

  const projection = useMemo(() =>
    d3.geoMercator().center([-55, -15]).scale(SVG_SIZE).translate([SVG_SIZE / 2, SVG_SIZE / 2]),
    []);

  const brazilPathD = useMemo(() => {
    if (!geoData) return '';
    return d3.geoPath().projection(projection)(geoData) ?? '';
  }, [geoData, projection]);

  const weekStarts = useMemo(() => {
    if (data.length === 0) return [];
    const dataMax = d3.max(data, d => d.order_purchase_timestamp)!;
    const starts: Date[] = [];
    const cur = new Date(2017, 0, 1);
    while (cur <= dataMax) {
      starts.push(new Date(cur));
      cur.setDate(cur.getDate() + 7);
    }
    return starts;
  }, [data]);

  const dateRange = useMemo((): [Date, Date] => {
    if (weekStarts.length === 0) return [new Date(), new Date()];
    const start = weekStarts[weekIdx];
    return [start, new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)];
  }, [weekIdx, weekStarts]);

  const filteredData = useMemo(() =>
    data.filter(d => {
      if (!inBrazil(d.customer_lat, d.customer_lng) || !inBrazil(d.seller_lat, d.seller_lng)) return false;
      if (d.order_id === selectedOrderId) return true;
      if (d.order_purchase_timestamp < dateRange[0] || d.order_purchase_timestamp > dateRange[1]) return false;
      if (!showOnTime && d.arrival_delta <= 0) return false;
      if (!showLate && d.arrival_delta > 0) return false;
      return true;
    }),
    [data, dateRange, showOnTime, showLate, selectedOrderId]);

  const ordersGroup = useMemo(() =>
    d3.group(filteredData, d => d.order_id),
    [filteredData]);

  const { customerNodes, sellerNodes } = useMemo(() => {
    const unselected = filteredData.filter(d => d.order_id !== selectedOrderId);

    const customerNodes: MapNode[] = [];
    if (displayMode === 'customer') {
      d3.group(unselected, d => `${d.customer_lat},${d.customer_lng}`).forEach(items => {
        const p = projection([items[0].customer_lng, items[0].customer_lat]);
        if (!p) return;
        customerNodes.push({
          lat: items[0].customer_lat,
          lng: items[0].customer_lng,
          isLate: items.some(d => d.arrival_delta > 0),
          px: p[0],
          py: p[1],
        });
      });
      customerNodes.sort((a, b) => +a.isLate - +b.isLate);
    }

    const sellerNodes: MapNode[] = [];
    if (displayMode === 'seller') {
      d3.group(unselected, d => `${d.seller_lat},${d.seller_lng}`).forEach(items => {
        const p = projection([items[0].seller_lng, items[0].seller_lat]);
        if (!p) return;
        sellerNodes.push({
          lat: items[0].seller_lat,
          lng: items[0].seller_lng,
          isLate: items.some(d => d.arrival_delta > 0),
          px: p[0],
          py: p[1],
        });
      });
      sellerNodes.sort((a, b) => +a.isLate - +b.isLate);
    }

    return { customerNodes, sellerNodes };
  }, [filteredData, selectedOrderId, displayMode, projection]);

  const selectedOrderLines = useMemo(() => {
    if (!selectedOrderId) return [];
    const items = ordersGroup.get(selectedOrderId) ?? [];
    return items.flatMap(d => {
      const pS = projection([d.seller_lng, d.seller_lat]);
      const pC = projection([d.customer_lng, d.customer_lat]);
      if (!pS || !pC) return [];
      return [{ d, pS, pC }];
    });
  }, [selectedOrderId, ordersGroup, projection]);

  const participantConnections = useMemo(() => {
    if (selectedOrderId || !selectedLocation) {
      return { lines: [] as ConnectionLine[], counterparts: [] as Counterpart[] };
    }
    const locType = selectedLocation.type;
    const items = data.filter(d => {
      if (!inBrazil(d.customer_lat, d.customer_lng) || !inBrazil(d.seller_lat, d.seller_lng)) return false;
      if (d.order_purchase_timestamp < dateRange[0] || d.order_purchase_timestamp > dateRange[1]) return false;
      if (selectedParticipantId) {
        return locType === 'customer' ? d.customer_id === selectedParticipantId : d.seller_id === selectedParticipantId;
      }
      return locType === 'customer'
        ? d.customer_lat === selectedLocation.lat && d.customer_lng === selectedLocation.lng
        : d.seller_lat === selectedLocation.lat && d.seller_lng === selectedLocation.lng;
    });
    const counterpartMap = new Map<string, Counterpart>();
    const lines: ConnectionLine[] = [];
    d3.group(items, d => d.order_id).forEach(orderItems => {
      const first = orderItems[0];
      const pFrom = locType === 'customer'
        ? projection([first.customer_lng, first.customer_lat])
        : projection([first.seller_lng, first.seller_lat]);
      const pTo = locType === 'customer'
        ? projection([first.seller_lng, first.seller_lat])
        : projection([first.customer_lng, first.customer_lat]);
      if (!pFrom || !pTo) return;
      const isLate = orderItems.some(o => o.arrival_delta > 0);
      const cLat = locType === 'customer' ? first.seller_lat : first.customer_lat;
      const cLng = locType === 'customer' ? first.seller_lng : first.customer_lng;
      const key = `${cLat},${cLng}`;
      if (!counterpartMap.has(key)) {
        counterpartMap.set(key, { px: pTo[0], py: pTo[1], lat: cLat, lng: cLng, isLate });
      } else if (isLate) {
        counterpartMap.get(key)!.isLate = true;
      }
      if (!lines.some(l => l.x2 === pTo[0] && l.y2 === pTo[1])) {
        lines.push({ x1: pFrom[0], y1: pFrom[1], x2: pTo[0], y2: pTo[1], isLate });
      }
    });
    return { lines, counterparts: Array.from(counterpartMap.values()) };
  }, [selectedLocation, selectedParticipantId, selectedOrderId, data, dateRange, projection]);

  const isSelectedParticipantLate = useMemo(() => {
    if (!selectedParticipantId || !selectedLocation) return null;
    return data.some(d => {
      if (d.order_purchase_timestamp < dateRange[0] || d.order_purchase_timestamp > dateRange[1]) return false;
      const isMatch = selectedLocation.type === 'customer'
        ? d.customer_id === selectedParticipantId
        : d.seller_id === selectedParticipantId;
      return isMatch && d.arrival_delta > 0;
    });
  }, [selectedParticipantId, selectedLocation, data, dateRange]);

  return {
    brazilPathD,
    weekStarts,
    dateRange,
    customerNodes,
    sellerNodes,
    selectedOrderLines,
    participantConnections,
    isSelectedParticipantLate,
  };
}
