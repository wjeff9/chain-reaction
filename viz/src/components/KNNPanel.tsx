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

    const width = 600;
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

    const links: any[] = [];

    nearestCustomers.forEach(d => {
      links.push({
        source: `c_${o.customer_id}`,
        target: `c_${d.customer_id}`,
        type: 'knn'
      });
    });

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('y', d3.forceY(height / 2));

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
      .attr('r', d => d.root ? 12 : 8)
      .attr('fill', d => d.data.arrival_delta > 0 ? 'var(--red)' : 'var(--green)')
      .attr('stroke', 'none')
      .attr('stroke-width', 0);

    const titleFn = (d: any) => {
      let text = `Customer: ${d.id.substring(2)}`;
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

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      tooltip.remove();
      simulation.stop();
    };
  }, [orderItems, allData]);

  return (
    <div className="knn-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <h3>Related Orders</h3>
      {orderItems.length === 0
        ? <p className="panel-placeholder">Select an order.</p>
        : <svg ref={svgRef} width="100%" style={{ flex: 1, minHeight: 0 }} viewBox="0 0 600 400"></svg>
      }
    </div>
  );
};
