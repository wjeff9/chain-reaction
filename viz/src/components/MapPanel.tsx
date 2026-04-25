import React, { useState, useMemo } from 'react';
import * as d3 from 'd3';
import { OrderItem } from '../types';
import { useMapData, SelectedLocation, SVG_SIZE } from '../hooks/useMapData';
import './MapPanel.css';

interface MapPanelProps {
  data: OrderItem[];
  selectedOrderId: string | null;
  onOrderSelect: (orderId: string) => void;
}

interface FilterPanelProps {
  displayMode: 'customer' | 'seller';
  setDisplayMode: (v: 'customer' | 'seller') => void;
  showOnTime: boolean;
  setShowOnTime: (v: boolean) => void;
  showLate: boolean;
  setShowLate: (v: boolean) => void;
  weekIdx: number;
  setWeekIdx: (v: number) => void;
  weekStarts: Date[];
  dateRange: [Date, Date];
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  displayMode, setDisplayMode,
  showOnTime, setShowOnTime,
  showLate, setShowLate,
  weekIdx, setWeekIdx,
  weekStarts, dateRange,
}) => {
  const maxIdx = Math.max(0, weekStarts.length - 1);
  const total = weekStarts.length - 1;
  const startPct = total > 0 ? (weekIdx / total) * 100 : 0;
  const endPct   = total > 0 ? ((weekIdx + 1) / total) * 100 : 100;

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekLabel = weekStarts.length > 0
    ? `${fmt(dateRange[0])} – ${fmt(new Date(dateRange[1].getTime() - 86400000))}, ${dateRange[0].getFullYear()}`
    : '';

  return (
    <aside className="map-panel-filters">
      <h4 className="panel-section-title">Filters</h4>
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
            <div className="range-slider-range" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
          </div>
          <input type="range" min={0} max={maxIdx} value={weekIdx} onChange={e => setWeekIdx(+e.target.value)} />
        </div>
        <div className="range-slider-labels">
          <span>{weekLabel}</span>
        </div>
      </section>
    </aside>
  );
};

const MapLegend: React.FC = () => (
  <aside className="panel-legend">
    <h4 className="panel-section-title">Legend</h4>
    <div className="panel-legend-item">
      <div className="legend-circle legend-green" />
      <span>On-time customer(s)</span>
    </div>
    <div className="panel-legend-item">
      <div className="legend-square legend-green" />
      <span>On-time seller(s)</span>
    </div>
    <div className="panel-legend-item">
      <div className="legend-circle legend-red" />
      <span>Late customer(s)</span>
    </div>
    <div className="panel-legend-item">
      <div className="legend-square legend-red" />
      <span>Late seller(s)</span>
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
      <h4 className="panel-section-title">{title}</h4>
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
            <div className="subpanel-row-date">
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
      <h4 className="panel-section-title">Orders</h4>
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

export const MapPanel: React.FC<MapPanelProps> = ({ data, selectedOrderId, onOrderSelect }) => {
  const [displayMode, setDisplayMode] = useState<'customer' | 'seller'>('customer');
  const [showOnTime, setShowOnTime] = useState(true);
  const [showLate, setShowLate] = useState(true);
  const [weekIdx, setWeekIdx] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);

  const {
    brazilPathD,
    weekStarts,
    dateRange,
    customerNodes,
    sellerNodes,
    selectedOrderLines,
    participantConnections,
    isSelectedParticipantLate,
  } = useMapData(data, selectedOrderId, displayMode, showOnTime, showLate, weekIdx, selectedLocation, selectedParticipantId);

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

  // Color for the highlighted location node: defer to per-participant lateness
  // when a participant is selected, otherwise use the location's aggregate lateness.
  const highlightColor = (nodeIsLate: boolean) =>
    isSelectedParticipantLate !== null
      ? (isSelectedParticipantLate ? 'var(--red)' : 'var(--green)')
      : (nodeIsLate ? 'var(--red)' : 'var(--green)');

  return (
    <div className="panel map-panel">
      <h3>Map</h3>
      <div className="map-panel-body">
        <div className="map-panel-sidebar">
          <MapLegend />
          <FilterPanel
            displayMode={displayMode} setDisplayMode={(v) => { setDisplayMode(v); handleFilterChange(); }}
            showOnTime={showOnTime} setShowOnTime={(v) => { setShowOnTime(v); handleFilterChange(); }}
            showLate={showLate} setShowLate={(v) => { setShowLate(v); handleFilterChange(); }}
            weekIdx={weekIdx} setWeekIdx={(v) => { setWeekIdx(v); handleFilterChange(); }}
            weekStarts={weekStarts} dateRange={dateRange}
          />
        </div>

        <div className="map-panel-content">
          <div className="map-panel-canvas-wrapper">
            <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} className="map-panel-canvas" style={{ background: 'var(--panel-bg)' }}>
              {brazilPathD && (
                <path d={brazilPathD} fill="var(--border)" stroke="var(--panel-bg)" strokeWidth={1} />
              )}

              <g opacity={selectedLocation ? 0.2 : 0.5}>
                {customerNodes.filter(n => !(selectedLocation?.lat === n.lat && selectedLocation?.lng === n.lng)).map((n, i) => (
                  <circle key={i} cx={n.px} cy={n.py} r={3} fill={n.isLate ? 'var(--red)' : 'var(--green)'} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(n.lat, n.lng, 'customer')} />
                ))}
                {sellerNodes.filter(n => !(selectedLocation?.lat === n.lat && selectedLocation?.lng === n.lng)).map((n, i) => (
                  <rect key={i} x={n.px - 3} y={n.py - 3} width={6} height={6} fill={n.isLate ? 'var(--red)' : 'var(--green)'} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(n.lat, n.lng, 'seller')} />
                ))}
              </g>

              {participantConnections.lines.map((l, i) => (
                <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.isLate ? 'var(--red)' : 'var(--green)'} strokeWidth={1} opacity={0.6} style={{ pointerEvents: 'none' }} />
              ))}

              {customerNodes.filter(n => selectedLocation?.lat === n.lat && selectedLocation?.lng === n.lng).map((n, i) => (
                <circle key={i} cx={n.px} cy={n.py} r={3} fill={highlightColor(n.isLate)} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(n.lat, n.lng, 'customer')} />
              ))}
              {sellerNodes.filter(n => selectedLocation?.lat === n.lat && selectedLocation?.lng === n.lng).map((n, i) => (
                <rect key={i} x={n.px - 3} y={n.py - 3} width={6} height={6} fill={highlightColor(n.isLate)} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(n.lat, n.lng, 'seller')} />
              ))}
              {participantConnections.counterparts.map((n, i) => (
                selectedLocation?.type === 'customer'
                  ? <rect key={i} x={n.px - 3} y={n.py - 3} width={6} height={6} fill={n.isLate ? 'var(--red)' : 'var(--green)'} style={{ pointerEvents: 'none' }} />
                  : <circle key={i} cx={n.px} cy={n.py} r={3} fill={n.isLate ? 'var(--red)' : 'var(--green)'} style={{ pointerEvents: 'none' }} />
              ))}

              {selectedOrderLines.map(({ d, pS, pC }, i) => (
                <g key={i}>
                  <line x1={pS[0]} y1={pS[1]} x2={pC[0]} y2={pC[1]} stroke={d.arrival_delta > 0 ? 'var(--red)' : 'var(--green)'} strokeWidth={1} />
                  <rect x={pS[0] - 3} y={pS[1] - 3} width={6} height={6} fill={d.arrival_delta > 0 ? 'var(--red)' : 'var(--green)'} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(d.seller_lat, d.seller_lng, 'seller')} />
                  <circle cx={pC[0]} cy={pC[1]} r={3} fill={d.arrival_delta > 0 ? 'var(--red)' : 'var(--green)'} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(d.customer_lat, d.customer_lng, 'customer')} />
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
