import React, { useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { OrderItem } from '../types';
import './MapPanel.css';

interface MapPanelProps {
  data: OrderItem[];
  selectedOrderId: string | null;
  onOrderSelect: (orderId: string) => void;
}

interface SelectedLocation {
  lat: number;
  lng: number;
  type: 'customer' | 'seller';
}

interface FilterPanelProps {
  displayMode: 'customer' | 'seller';
  setDisplayMode: (v: 'customer' | 'seller') => void;
  showOnTime: boolean;
  setShowOnTime: (v: boolean) => void;
  showLate: boolean;
  setShowLate: (v: boolean) => void;
  monthIdx: number;
  setMonthIdx: (v: number) => void;
  monthStarts: Date[];
  dateRange: [Date, Date];
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  displayMode, setDisplayMode,
  showOnTime, setShowOnTime,
  showLate, setShowLate,
  monthIdx, setMonthIdx,
  monthStarts, dateRange,
}) => {
  const maxIdx = Math.max(0, monthStarts.length - 2);
  const startPct = monthStarts.length > 1 ? (monthIdx / (monthStarts.length - 1)) * 100 : 0;
  const endPct = monthStarts.length > 1 ? ((monthIdx + 1) / (monthStarts.length - 1)) * 100 : 100;
  const formatMonth = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <aside className="map-panel-filters">
      <h4 className="map-panel-filters-title">Filters</h4>
      <section className="map-panel-filter-section">
        <span className="map-panel-filter-label">Entities</span>
        <label><input type="radio" name="displayMode" checked={displayMode === 'customer'} onChange={() => setDisplayMode('customer')} /> Customers</label>
        <label><input type="radio" name="displayMode" checked={displayMode === 'seller'} onChange={() => setDisplayMode('seller')} /> Sellers</label>
      </section>

      <section className="map-panel-filter-section">
        <span className="map-panel-filter-label">Delivery</span>
        <label><input type="checkbox" checked={showOnTime} onChange={e => setShowOnTime(e.target.checked)} /> On-time</label>
        <label><input type="checkbox" checked={showLate} onChange={e => setShowLate(e.target.checked)} /> Late</label>
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
  );
};

const MapLegend: React.FC = () => (
  <aside className="map-panel-legend">
    <h4 className="map-panel-filters-title">Legend</h4>
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
);

interface ParticipantListProps {
  items: OrderItem[];
  location: SelectedLocation | null;
  dateRange: [Date, Date];
  selectedParticipantId: string | null;
  onSelect: (id: string) => void;
}

const ParticipantList: React.FC<ParticipantListProps> = ({ items, location, dateRange, selectedParticipantId, onSelect }) => {
  const participants = useMemo(() => {
    if (!location) return [];
    const filtered = items.filter(d => {
      if (d.order_purchase_timestamp < dateRange[0] || d.order_purchase_timestamp >= dateRange[1]) return false;
      return location.type === 'customer'
        ? d.customer_lat === location.lat && d.customer_lng === location.lng
        : d.seller_lat === location.lat && d.seller_lng === location.lng;
    });
    const grouped = d3.group(filtered, d => location.type === 'customer' ? d.customer_id : d.seller_id);
    return Array.from(grouped.entries()).map(([id, orders]) => {
      const orderGroups = Array.from(d3.group(orders, o => o.order_id).values());
      let onTimeCount = 0;
      let lateCount = 0;
      orderGroups.forEach(orderItems => {
        if (orderItems.some(o => o.arrival_delta > 0)) lateCount++;
        else onTimeCount++;
      });
      return { id, isLate: lateCount > 0, onTimeCount, lateCount };
    });
  }, [items, location, dateRange]);

  const title = location?.type === 'seller' ? 'Sellers' : 'Customers';

  return (
    <div className="map-panel-subpanel">
      <h4 className="subpanel-title">{title}</h4>
      <div className="subpanel-list">
        {!location && <span className="subpanel-empty">Select a location.</span>}
        {location && participants.length === 0 && <span className="subpanel-empty">None in window</span>}
        {participants.map(({ id, isLate, onTimeCount, lateCount }) => (
          <div
            key={id}
            className={`subpanel-row${selectedParticipantId === id ? ' selected' : ''}`}
            onClick={() => onSelect(id)}
          >
            <span style={{ color: isLate ? 'var(--red)' : 'var(--green)' }}>{id.slice(-8)}</span>
            <div className="subpanel-row-date" style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ color: 'var(--green)', opacity: onTimeCount > 0 ? 1 : 0.5 }}>{onTimeCount}</span>
              <span style={{ color: 'var(--red)', opacity: lateCount > 0 ? 1 : 0.5 }}>{lateCount}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface OrderListProps {
  items: OrderItem[];
  participantId: string | null;
  participantType: 'customer' | 'seller' | null;
  displayMode: 'customer' | 'seller';
  dateRange: [Date, Date];
  selectedOrderId: string | null;
  onSelect: (orderId: string) => void;
}

const OrderList: React.FC<OrderListProps> = ({ items, participantId, participantType, displayMode, dateRange, selectedOrderId, onSelect }) => {
  const orders = useMemo(() => {
    if (!participantId || !participantType) return [];
    const filtered = items.filter(d => {
      if (d.order_purchase_timestamp < dateRange[0] || d.order_purchase_timestamp >= dateRange[1]) return false;
      return participantType === 'customer' ? d.customer_id === participantId : d.seller_id === participantId;
    });
    const grouped = d3.group(filtered, d => d.order_id);
    return Array.from(grouped.entries()).map(([orderId, orderItems]) => ({
      orderId,
      isLate: orderItems.some(o => o.arrival_delta > 0),
      date: orderItems[0].order_purchase_timestamp,
    }));
  }, [items, participantId, participantType, dateRange]);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="map-panel-subpanel">
      <h4 className="subpanel-title">Orders</h4>
      <div className="subpanel-list">
        {!participantId && <span className="subpanel-empty">Select a {displayMode}.</span>}
        {participantId && orders.length === 0 && <span className="subpanel-empty">None in window</span>}
        {orders.map(({ orderId, isLate, date }) => (
          <div
            key={orderId}
            className={`subpanel-row${selectedOrderId === orderId ? ' selected' : ''}`}
            style={{ color: isLate ? 'var(--red)' : 'var(--green)' }}
            onClick={() => onSelect(orderId)}
          >
            <span>{orderId.slice(-8)}</span>
            <span className="subpanel-row-date">{formatDate(date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SVG_SIZE = 800;

export const MapPanel: React.FC<MapPanelProps> = ({ data, selectedOrderId, onOrderSelect }) => {
  const [geoData, setGeoData] = useState<any>(null);
  const [displayMode, setDisplayMode] = useState<'customer' | 'seller'>('customer');
  const [showOnTime, setShowOnTime] = useState(true);
  const [showLate, setShowLate] = useState(true);
  const [monthIdx, setMonthIdx] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);

  useEffect(() => {
    d3.json(`${import.meta.env.BASE_URL}brazil.json`).then((json) => setGeoData(json));
  }, []);

  const colors = useMemo(() => {
    const s = getComputedStyle(document.documentElement);
    const get = (v: string, fb: string) => s.getPropertyValue(v).trim() || fb;
    return {
      panelBg: get('--panel-bg', '#24283b'),
      border: get('--border', '#414868'),
      text: get('--text', '#c0caf5'),
      red: get('--red', '#f7768e'),
      green: get('--green', '#9ece6a'),
      cyan: get('--cyan', '#7dcfff'),
    };
  }, []);

  const projection = useMemo(() =>
    d3.geoMercator().center([-55, -15]).scale(SVG_SIZE).translate([SVG_SIZE / 2, SVG_SIZE / 2]),
    []);

  const brazilPathD = useMemo(() => {
    if (!geoData) return '';
    return d3.geoPath().projection(projection)(geoData) ?? '';
  }, [geoData, projection]);

  const monthStarts = useMemo(() => {
    if (data.length === 0) return [];
    const dataMin = d3.min(data, d => d.order_purchase_timestamp)!;
    const dataMax = d3.max(data, d => d.order_purchase_timestamp)!;

    const firstOfMin = new Date(dataMin.getFullYear(), dataMin.getMonth(), 1);
    const firstComplete = dataMin.getDate() === 1
      ? firstOfMin
      : new Date(firstOfMin.getFullYear(), firstOfMin.getMonth() + 1, 1);
    const start = new Date(Math.max(firstComplete.getTime(), new Date(2017, 0, 1).getTime()));

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

  const inBrazil = (lat: number, lng: number) =>
    lat >= -33.75 && lat <= 5.27 && lng >= -73.99 && lng <= -28.85;

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

  const ordersGroup = useMemo(() => d3.group(filteredData, d => d.order_id), [filteredData]);

  const { customerNodes, sellerNodes } = useMemo(() => {
    const unselected = filteredData.filter(d => d.order_id !== selectedOrderId);

    const customerNodes: { lat: number; lng: number; isLate: boolean; px: number; py: number }[] = [];
    if (displayMode === 'customer') {
      d3.group(unselected, d => `${d.customer_lat},${d.customer_lng}`).forEach(items => {
        const p = projection([items[0].customer_lng, items[0].customer_lat]);
        if (!p) return;
        customerNodes.push({ lat: items[0].customer_lat, lng: items[0].customer_lng, isLate: items.some(d => d.arrival_delta > 0), px: p[0], py: p[1] });
      });
      customerNodes.sort((a, b) => +a.isLate - +b.isLate);
    }

    const sellerNodes: { lat: number; lng: number; isLate: boolean; px: number; py: number }[] = [];
    if (displayMode === 'seller') {
      d3.group(unselected, d => `${d.seller_lat},${d.seller_lng}`).forEach(items => {
        const p = projection([items[0].seller_lng, items[0].seller_lat]);
        if (!p) return;
        sellerNodes.push({ lat: items[0].seller_lat, lng: items[0].seller_lng, isLate: items.some(d => d.arrival_delta > 0), px: p[0], py: p[1] });
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
    if (selectedOrderId || !selectedLocation) return { lines: [], counterparts: [] };
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
    const counterpartMap = new Map<string, { px: number; py: number; lat: number; lng: number; isLate: boolean }>();
    const lines: { x1: number; y1: number; x2: number; y2: number; isLate: boolean }[] = [];
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
      const isMatch = selectedLocation.type === 'customer' ? d.customer_id === selectedParticipantId : d.seller_id === selectedParticipantId;
      return isMatch && d.arrival_delta > 0;
    });
  }, [selectedParticipantId, selectedLocation, data, dateRange]);


  const handleNodeClick = (lat: number, lng: number, type: 'customer' | 'seller') => {
    if (selectedLocation?.lat === lat && selectedLocation?.lng === lng && selectedLocation?.type === type) {
      setSelectedLocation(null);
      setSelectedParticipantId(null);
      onOrderSelect('');
    } else {
      setSelectedLocation({ lat, lng, type });
      setSelectedParticipantId(null);
      onOrderSelect('');
    }
  };

  const handleFilterChange = () => {
    setSelectedLocation(null);
    setSelectedParticipantId(null);
    onOrderSelect('');
  };

  return (
    <div className="map-panel">
      <h3>Map</h3>
      <div className="map-panel-body">
        <div className="map-panel-sidebar">
          <MapLegend />
          <FilterPanel
            displayMode={displayMode} setDisplayMode={(v) => { setDisplayMode(v); handleFilterChange(); }}
            showOnTime={showOnTime} setShowOnTime={(v) => { setShowOnTime(v); handleFilterChange(); }}
            showLate={showLate} setShowLate={(v) => { setShowLate(v); handleFilterChange(); }}
            monthIdx={monthIdx} setMonthIdx={(v) => { setMonthIdx(v); handleFilterChange(); }}
            monthStarts={monthStarts} dateRange={dateRange}
          />
        </div>

        <div className="map-panel-content">
          <div className="map-panel-canvas-wrapper">
            <svg
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              className="map-panel-canvas"
              style={{ background: colors.panelBg }}
            >
              {brazilPathD && (
                <path d={brazilPathD} fill={colors.border} stroke={colors.panelBg} strokeWidth={1} />
              )}

              <g opacity={selectedLocation ? 0.2 : 0.5}>
                {customerNodes.filter(n => !(selectedLocation?.lat === n.lat && selectedLocation?.lng === n.lng)).map((n, i) => (
                  <circle key={i} cx={n.px} cy={n.py} r={3} fill={n.isLate ? colors.red : colors.green} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(n.lat, n.lng, 'customer')} />
                ))}
                {sellerNodes.filter(n => !(selectedLocation?.lat === n.lat && selectedLocation?.lng === n.lng)).map((n, i) => (
                  <rect key={i} x={n.px - 3} y={n.py - 3} width={6} height={6} fill={n.isLate ? colors.red : colors.green} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(n.lat, n.lng, 'seller')} />
                ))}
              </g>

              {participantConnections.lines.map((l, i) => (
                <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.isLate ? colors.red : colors.green} strokeWidth={1} opacity={0.6} style={{ pointerEvents: 'none' }} />
              ))}

              {customerNodes.filter(n => selectedLocation?.lat === n.lat && selectedLocation?.lng === n.lng).map((n, i) => (
                <circle key={i} cx={n.px} cy={n.py} r={3} fill={isSelectedParticipantLate !== null ? (isSelectedParticipantLate ? colors.red : colors.green) : (n.isLate ? colors.red : colors.green)} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(n.lat, n.lng, 'customer')} />
              ))}
              {sellerNodes.filter(n => selectedLocation?.lat === n.lat && selectedLocation?.lng === n.lng).map((n, i) => (
                <rect key={i} x={n.px - 3} y={n.py - 3} width={6} height={6} fill={isSelectedParticipantLate !== null ? (isSelectedParticipantLate ? colors.red : colors.green) : (n.isLate ? colors.red : colors.green)} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(n.lat, n.lng, 'seller')} />
              ))}
              {participantConnections.counterparts.map((n, i) => (
                selectedLocation?.type === 'customer'
                  ? <rect key={i} x={n.px - 3} y={n.py - 3} width={6} height={6} fill={n.isLate ? colors.red : colors.green} style={{ pointerEvents: 'none' }} />
                  : <circle key={i} cx={n.px} cy={n.py} r={3} fill={n.isLate ? colors.red : colors.green} style={{ pointerEvents: 'none' }} />
              ))}

              {selectedOrderLines.map(({ d, pS, pC }, i) => (
                <g key={i}>
                  <line x1={pS[0]} y1={pS[1]} x2={pC[0]} y2={pC[1]} stroke={d.arrival_delta > 0 ? colors.red : colors.green} strokeWidth={1} />
                  <rect x={pS[0] - 3} y={pS[1] - 3} width={6} height={6} fill={d.arrival_delta > 0 ? colors.red : colors.green} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(d.seller_lat, d.seller_lng, 'seller')} />
                  <circle cx={pC[0]} cy={pC[1]} r={3} fill={d.arrival_delta > 0 ? colors.red : colors.green} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(d.customer_lat, d.customer_lng, 'customer')} />
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="map-panel-sidebar">
          <ParticipantList
            items={data}
            location={selectedLocation}
            dateRange={dateRange}
            selectedParticipantId={selectedParticipantId}
            onSelect={id => { setSelectedParticipantId(id === selectedParticipantId ? null : id); onOrderSelect(''); }}
          />
          <OrderList
            items={data}
            participantId={selectedParticipantId}
            participantType={selectedLocation?.type ?? null}
            displayMode={displayMode}
            dateRange={dateRange}
            selectedOrderId={selectedOrderId}
            onSelect={orderId => onOrderSelect(orderId === selectedOrderId ? '' : orderId)}
          />
        </div>
      </div>
    </div>
  );
};

export default MapPanel;
