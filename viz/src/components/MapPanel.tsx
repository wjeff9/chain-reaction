import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { OrderItem } from '../types';
import './MapPanel.css';

interface MapPanelProps {
  data: OrderItem[];
  selectedOrderId: string | null;
  onOrderSelect: (orderId: string) => void;
}

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export const MapPanel: React.FC<MapPanelProps> = ({ data, selectedOrderId, onOrderSelect }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [showCustomers, setShowCustomers] = useState(true);
  const [showSellers, setShowSellers] = useState(false);
  const [showOnTime, setShowOnTime] = useState(true);
  const [showLate, setShowLate] = useState(true);
  const [showSingle, setShowSingle] = useState(true);
  const [showMulti, setShowMulti] = useState(true);
  const [dateRange, setDateRange] = useState<[Date, Date]>([new Date('2017-01-01'), new Date('2017-01-15')]);
  const initializedRef = useRef(false);
  let hitZones: any[] = [];

  useEffect(() => {
    d3.json(`${import.meta.env.BASE_URL}brazil.json`).then((json) => setGeoData(json));
  }, []);

  useEffect(() => {
    if (data.length === 0 || initializedRef.current) return;
    initializedRef.current = true;
    const minDate = new Date(Math.min(...data.map(o => o.order_purchase_timestamp.getTime())));
    setDateRange([minDate, new Date(minDate.getTime() + TWO_WEEKS_MS)]);
  }, [data]);

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
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

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
    const cBlue = docStyle.getPropertyValue('--blue').trim() || '#7aa2f7';

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
          context.fillStyle = cBlue;
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
            context.fillStyle = cBlue;
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
      const [x, y] = d3.pointer(event);
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

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = new Date(e.target.value);
    if (isNaN(newStart.getTime())) return;
    const cappedEnd = new Date(Math.min(dateRange[1].getTime(), newStart.getTime() + TWO_WEEKS_MS));
    setDateRange([newStart, cappedEnd]);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = new Date(e.target.value);
    if (isNaN(newEnd.getTime())) return;
    const cappedStart = new Date(Math.max(dateRange[0].getTime(), newEnd.getTime() - TWO_WEEKS_MS));
    setDateRange([cappedStart, newEnd]);
  };

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
            <label>
              From
              <input
                type="date"
                value={dateRange[0].toISOString().split('T')[0]}
                onChange={handleStartDateChange}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={dateRange[1].toISOString().split('T')[0]}
                max={new Date(dateRange[0].getTime() + TWO_WEEKS_MS).toISOString().split('T')[0]}
                onChange={handleEndDateChange}
              />
            </label>
          </section>
        </aside>

        <div className="map-panel-content">
          <div className="map-panel-canvas-wrapper">
            <canvas ref={canvasRef} className="map-panel-canvas" width={800} height={800} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapPanel;
