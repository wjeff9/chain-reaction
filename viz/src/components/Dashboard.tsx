import React, { useEffect, useState } from 'react';
import { loadData } from '../utils';
import { OrderItem } from '../types';
import { MapPanel } from './MapPanel';
import { GanttPanel } from './GanttPanel';
import { KNNPanel } from './KNNPanel';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<OrderItem[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    loadData().then(d => setData(d));
  }, []);

  const selectedOrderItems = data.filter(d => d.order_id === selectedOrderId);

  return (
    <div className="dashboard">
      <div className="dashboard-left">
        <MapPanel
          data={data}
          selectedOrderId={selectedOrderId}
          onOrderSelect={setSelectedOrderId}
        />
      </div>
      <div className="dashboard-right">
        <div className="dashboard-right-top">
          <GanttPanel orderItems={selectedOrderItems} />
        </div>
        <div className="dashboard-right-bottom">
          <KNNPanel orderItems={selectedOrderItems} allData={data} />
        </div>
      </div>
    </div>
  );
};
