import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { OrderItem } from '../types';
import './MapPanel.css';

interface MapPanelProps {
  data: OrderItem[];
  selectedOrderId: string | null;
  onOrderSelect: (orderId: string) => void;
}


export const MapPanel: React.FC<MapPanelProps> = ({ data, selectedOrderId, onOrderSelect }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [showCustomers, setShowCustomers] = useState(true);
  const [showSellers, setShowSellers] = useState(false);
  const [showOnTime, setShowOnTime] = useState(true);
  const [showLate, setShowLate] = useState(true);
  const [showSingle, setShowSingle] = useState(true);
  const [showMulti, setShowMulti] = useState(true);
  const [monthIdx, setMonthIdx] = useState(0);
  let hitZones: any[] = [];

  useEffect(() => {
    d3.json(`${import.meta.env.BASE_URL}brazil.json`).then((json) => setGeoData(json));
  }, []);

  const monthStarts = useMemo(() => {
    if (data.length === 0) return [];
    const dataMin = d3.min(data, d => d.order_purchase_timestamp)!;
    const dataMax = d3.max(data, d => d.order_purchase_timestamp)!;

    const firstOfMin = new Date(dataMin.getFullYear(), dataMin.getMonth(), 1);
    const start = dataMin.getDate() === 1
      ? firstOfMin
      : new Date(firstOfMin.getFullYear(), firstOfMin.getMonth() + 1, 1);

    const lastDayOfMax = new Date(dataMax.getFullYear(), dataMax.getMonth() + 1, 0).getDate();
    const firstOfMax = new Date(dataMax.getFullYear(), dataMax.getMonth(), 1);
    const end = dataMax.getDate() >= lastDayOfMax
      ? firstOfMax
      : new Date(firstOfMax.getFullYear(), firstOfMax.getMonth() - 1, 1);

    const starts: Date[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      starts.push(new Date(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
    return starts;
  }, [data]);

  const dateRange = useMemo((): [Date, Date] => {
    if (monthStarts.length === 0) return [new Date(), new Date()];
    const start = monthStarts[monthIdx];
    const end = monthIdx + 1 < monthStarts.length
      ? monthStarts[monthIdx + 1]
      : new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return [start, end];
  }, [monthIdx, monthStarts]);

  const multiSellerOrderIds = useMemo(() => {
    const result = new Set<string>();
    d3.group(data, d => d.order_id).forEach((items, orderId) => {
      if (new Set(items.map(i => i.seller_id)).size > 1) result.add(orderId);
    });
    return result;
  }, [data]);

  useEffect(() => {
    if (!geoData || !canvasRef.current) return;

    const width = 800;
    const height = 800;

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.scale(dpr, dpr);

    const docStyle = getComputedStyle(document.documentElement);
    const cBg = docStyle.getPropertyValue('--bg').trim() || '#1a1b26';
    const cPanelBg = docStyle.getPropertyValue('--panel-bg').trim() || '#24283b';
    const cBorder = docStyle.getPropertyValue('--border').trim() || '#414868';
    const cText = docStyle.getPropertyValue('--text').trim() || '#c0caf5';
    const cRed = docStyle.getPropertyValue('--red').trim() || '#f7768e';
    const cGreen = docStyle.getPropertyValue('--green').trim() || '#9ece6a';

    context.fillStyle = cPanelBg;
    context.fillRect(0, 0, width, height);

    const projection = d3.geoMercator()
      .center([-55, -15])
      .scale(800)
      .translate([width / 2, height / 2]);
    const path = d3.geoPath().projection(projection).context(context);

    context.beginPath();
    path(geoData);
    context.fillStyle = cBorder;
    context.fill();
    context.strokeStyle = cBg;
    context.stroke();

    const filteredData = data.filter((d) => {
      if (d.order_purchase_timestamp < dateRange[0] || d.order_purchase_timestamp > dateRange[1]) return false;
      if (!showOnTime && d.arrival_delta <= 0) return false;
      if (!showLate && d.arrival_delta > 0) return false;
      if (!showSingle && !multiSellerOrderIds.has(d.order_id)) return false;
      if (!showMulti && multiSellerOrderIds.has(d.order_id)) return false;
      return true;
    });

    const ordersGroup = d3.group(filteredData, d => d.order_id);
    const orderEntries = Array.from(ordersGroup.entries());

    context.globalAlpha = 0.5;

    const drawOrder = (orderId: string, items: OrderItem[], isSelected: boolean) => {
      items.forEach(d => {
        const pSeller = projection([d.seller_lng, d.seller_lat]);
        const pCustomer = projection([d.customer_lng, d.customer_lat]);
        if (!pSeller || !pCustomer) return;

        if (isSelected) {
          hitZones.push({ x: pCustomer[0], y: pCustomer[1], r: 10, orderId });
          hitZones.push({ x: pSeller[0], y: pSeller[1], r: 10, orderId });

          context.beginPath();
          context.moveTo(pSeller[0], pSeller[1]);
          context.lineTo(pCustomer[0], pCustomer[1]);
          context.strokeStyle = cText;
          context.stroke();

          const size = 10;
          context.fillStyle = d.arrival_delta > 0 ? cRed : cGreen;
          context.fillRect(pSeller[0] - size / 2, pSeller[1] - size / 2, size, size);

          const r = 3;
          context.beginPath();
          context.arc(pCustomer[0], pCustomer[1], r, 0, 2 * Math.PI);
          context.fillStyle = d.arrival_delta > 0 ? cRed : cGreen;
          context.fill();
        } else {
          if (showCustomers) {
            hitZones.push({ x: pCustomer[0], y: pCustomer[1], r: 10, orderId });
            const r = 3;
            context.beginPath();
            context.arc(pCustomer[0], pCustomer[1], r, 0, 2 * Math.PI);
            context.fillStyle = d.arrival_delta > 0 ? cRed : cGreen;
            context.fill();
          }
          if (showSellers) {
            hitZones.push({ x: pSeller[0], y: pSeller[1], r: 10, orderId });
            const size = 6;
            context.fillStyle = d.arrival_delta > 0 ? cRed : cGreen;
            context.fillRect(pSeller[0] - size / 2, pSeller[1] - size / 2, size, size);
          }
        }
      });
    };

    const unselectedOnTime: [string, OrderItem[]][] = [];
    const unselectedLate: [string, OrderItem[]][] = [];

    orderEntries.forEach(([orderId, items]) => {
      if (orderId !== selectedOrderId) {
        const isLate = items.some(item => item.arrival_delta > 0);
        if (isLate) unselectedLate.push([orderId, items]);
        else unselectedOnTime.push([orderId, items]);
      }
    });

    unselectedOnTime.forEach(([orderId, items]) => drawOrder(orderId, items, false));
    unselectedLate.forEach(([orderId, items]) => drawOrder(orderId, items, false));

    if (selectedOrderId) {
      const selectedItems = ordersGroup.get(selectedOrderId);
      if (selectedItems) drawOrder(selectedOrderId, selectedItems, true);
    }

    context.globalAlpha = 1;

    const clickHandler = (event: any) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      const [cssX, cssY] = d3.pointer(event);
      const x = cssX * scaleX;
      const y = cssY * scaleY;
      let closestObj: any = null;
      let minD = Infinity;

      for (const hz of hitZones) {
        const dist = Math.pow(hz.x - x, 2) + Math.pow(hz.y - y, 2);
        if (dist < Math.pow(hz.r, 2) && dist < minD) {
          minD = dist;
          closestObj = hz;
        }
      }

      onOrderSelect(closestObj ? closestObj.orderId : '');
    };

    d3.select(canvasRef.current).on('click', clickHandler);

  }, [data, geoData, selectedOrderId, dateRange, showOnTime, showLate, showSingle, showMulti, showCustomers, showSellers, onOrderSelect, multiSellerOrderIds]);

  const maxIdx = Math.max(0, monthStarts.length - 2);
  const startPct = monthStarts.length > 1 ? (monthIdx / (monthStarts.length - 1)) * 100 : 0;
  const endPct = monthStarts.length > 1 ? ((monthIdx + 1) / (monthStarts.length - 1)) * 100 : 100;

  const formatMonth = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <div className="map-panel">
      <h3>Brazil Map</h3>
      <div className="map-panel-body">
        <aside className="map-panel-filters">
          <section className="map-panel-filter-section">
            <span className="map-panel-filter-label">Display</span>
            <label><input type="checkbox" checked={showCustomers} onChange={e => setShowCustomers(e.target.checked)} /> Customers</label>
            <label><input type="checkbox" checked={showSellers} onChange={e => setShowSellers(e.target.checked)} /> Sellers</label>
          </section>

          <section className="map-panel-filter-section">
            <span className="map-panel-filter-label">Delivery</span>
            <label><input type="checkbox" checked={showOnTime} onChange={e => setShowOnTime(e.target.checked)} /> On-time</label>
            <label><input type="checkbox" checked={showLate} onChange={e => setShowLate(e.target.checked)} /> Late</label>
          </section>

          <section className="map-panel-filter-section">
            <span className="map-panel-filter-label">Order type</span>
            <label><input type="checkbox" checked={showSingle} onChange={e => setShowSingle(e.target.checked)} /> Single seller</label>
            <label><input type="checkbox" checked={showMulti} onChange={e => setShowMulti(e.target.checked)} /> Multi-seller</label>
          </section>

          <section className="map-panel-filter-section">
            <span className="map-panel-filter-label">Time range</span>
            <div className="range-slider">
              <div className="range-slider-track">
                <div
                  className="range-slider-range"
                  style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={maxIdx}
                value={monthIdx}
                onChange={e => setMonthIdx(+e.target.value)}
              />
            </div>
            <div className="range-slider-labels">
              <span>{monthStarts.length > 0 ? formatMonth(dateRange[0]) : ''}</span>
            </div>
          </section>
        </aside>

        <div className="map-panel-content">
          <div className="map-panel-canvas-wrapper">
            <canvas ref={canvasRef} className="map-panel-canvas" width={800} height={800} />
          </div>
        </div>

        <aside className="map-panel-legend">
          <span className="map-panel-filter-label">Legend</span>
          <div className="map-panel-legend-item">
            <div className="legend-circle legend-green" />
            <span>On-time customer</span>
          </div>
          <div className="map-panel-legend-item">
            <div className="legend-square legend-green" />
            <span>On-time seller</span>
          </div>
          <div className="map-panel-legend-item">
            <div className="legend-circle legend-red" />
            <span>Late customer</span>
          </div>
          <div className="map-panel-legend-item">
            <div className="legend-square legend-red" />
            <span>Late seller</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MapPanel;
