import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { OrderItem } from '../types';
import { haversineDistance } from '../utils';
import './KNNPanel.css';

interface KNNPanelProps {
  orderItems: OrderItem[];
  allData: OrderItem[];
}

export const KNNPanel: React.FC<KNNPanelProps> = ({ orderItems, allData }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || orderItems.length === 0) return;

    const height = 400;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const o = orderItems[0];
    const timestamp = o.order_purchase_timestamp.getTime();
    const windowDateStart = new Date(timestamp - 3 * 24 * 60 * 60 * 1000);
    const windowDateEnd = new Date(timestamp + 3 * 24 * 60 * 60 * 1000);

    const candidates = allData.filter(d =>
      d.order_purchase_timestamp >= windowDateStart &&
      d.order_purchase_timestamp <= windowDateEnd &&
      d.order_id !== o.order_id
    );



    const nearestCustomers = Array.from(d3.rollup(candidates, v => v[0], d => d.customer_id).values())
      .map(d => ({
        ...d,
        dist: haversineDistance([o.customer_lng, o.customer_lat], [d.customer_lng, d.customer_lat])
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);

    const rawNodes: any[] = [
      { id: `c_${o.customer_id}`, type: 'customer', data: o, root: true, dist: 0 },
      ...nearestCustomers.map(d => ({ id: `c_${d.customer_id}`, type: 'customer', data: d, root: false, dist: d.dist }))
    ];

    // Deduplicate nodes by ID (prioritize roots and earlier occurrences)
    const nodes = Array.from(d3.group(rawNodes, d => d.id).values()).map(g => g[0]);

    const links: any[] = nearestCustomers.map(d => ({
      source: `c_${o.customer_id}`,
      target: `c_${d.customer_id}`,
      type: 'knn',
      dist: d.dist
    }));

    const maxDist = d3.max(links, (d: any) => d.dist) || 1;
    const rMax = 170;
    const radialScale = d3.scaleLinear().domain([0, maxDist]).range([90, rMax]);

    const rootX = 300 - rMax / 2;  // centers fan horizontally in the 600px viewBox
    const rootY = height / 2;
    const n = nearestCustomers.length;

    const posMap = new Map<string, { x: number; y: number }>();
    posMap.set(`c_${o.customer_id}`, { x: rootX, y: rootY });
    nearestCustomers.forEach((d, i) => {
      const angle = -Math.PI / 2 + i * Math.PI / (n > 1 ? n - 1 : 1);
      const r = radialScale(d.dist);
      posMap.set(`c_${d.customer_id}`, { x: rootX + r * Math.cos(angle), y: rootY + r * Math.sin(angle) });
    });

    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'var(--text-muted)')
      .attr('stroke-width', 2)
      .attr('opacity', 0.6);

    const node = svg.append('g')
      .selectAll<SVGGElement, any>('g')
      .data(nodes)
      .join('g');

    node.filter((d: any) => d.type === 'customer')
      .append('circle')
      .attr('r', 13)
      .attr('fill', d => d.root ? 'var(--cyan)' : d.data.arrival_delta > 0 ? 'var(--red)' : 'var(--green)')
      .attr('stroke', 'none')
      .attr('stroke-width', 0);

    node.filter((d: any) => d.type === 'customer')
      .append('text')
      .text((d: any) => d.data.order_id ? d.data.order_id.slice(-8) : '')
      .attr('text-anchor', 'middle')
      .attr('dy', 28)
      .attr('fill', 'var(--text)')
      .attr('font-size', '11px')
      .style('pointer-events', 'none');

    const titleFn = (d: any) => {
      let text = `Customer: ${d.id.slice(-8)}`;
      if (d.data && d.data.order_purchase_timestamp) {
        text += `\nOrder Date: ${d.data.order_purchase_timestamp.toLocaleDateString()}`;
      }
      if (!d.root && d.dist !== undefined) {
        text += `\nDistance: ${d.dist.toFixed(2)} km`;
      }
      return text;
    };

    const tooltip = d3.select('body').append('div')
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

    link.on('mouseover', (_event, d: any) => {
      tooltip.style('visibility', 'visible').text(`Distance: ${d.dist.toFixed(2)} km`);
    })
      .on('mousemove', (event) => {
        tooltip.style('top', (event.pageY + 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', () => {
        tooltip.style('visibility', 'hidden');
      });

    node.on('mouseover', (_event, d: any) => {
      tooltip.style('visibility', 'visible').text(titleFn(d));
    })
      .on('mousemove', (event) => {
        tooltip.style('top', (event.pageY + 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', () => {
        tooltip.style('visibility', 'hidden');
      });

    link
      .attr('x1', (d: any) => posMap.get(d.source)?.x ?? 0)
      .attr('y1', (d: any) => posMap.get(d.source)?.y ?? 0)
      .attr('x2', (d: any) => posMap.get(d.target)?.x ?? 0)
      .attr('y2', (d: any) => posMap.get(d.target)?.y ?? 0);

    node.attr('transform', (d: any) => {
      const p = posMap.get(d.id) ?? { x: 0, y: 0 };
      return `translate(${p.x},${p.y})`;
    });


    return () => {
      tooltip.remove();
    };
  }, [orderItems, allData]);

  return (
    <div className="knn-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <h3>Related Orders</h3>
      <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          {orderItems.length === 0
            ? <p className="panel-placeholder">Select an order.</p>
            : <svg ref={svgRef} width="100%" style={{ display: 'block', height: '100%' }} viewBox="0 0 600 400"></svg>}
        </div>
        <aside className="map-panel-legend" style={{ width: '9rem', flexShrink: 0, alignSelf: 'flex-start' }}>
          <h4 className="map-panel-filters-title">Legend</h4>
          <div className="map-panel-legend-item">
            <div className="legend-circle" style={{ background: 'var(--cyan)' }} />
            <span>Selected</span>
          </div>
          <div className="map-panel-legend-item">
            <div className="legend-circle legend-green" />
            <span>On time</span>
          </div>
          <div className="map-panel-legend-item">
            <div className="legend-circle legend-red" />
            <span>Late</span>
          </div>
        </aside>
      </div>
    </div>
  );
};
