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

    const nearestSellers: any[] = [];
    const sellerKnnLinks: any[] = [];

    const uniqueSellers = Array.from(new Map(orderItems.map(item => [item.seller_id, item])).values());

    uniqueSellers.forEach(sellerItem => {
      const neighbors = Array.from(d3.rollup(candidates, v => v[0], d => d.seller_id).values())
        .map(d => ({
          ...d,
          dist: haversineDistance([sellerItem.seller_lng, sellerItem.seller_lat], [d.seller_lng, d.seller_lat])
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 5);
      
      nearestSellers.push(...neighbors);
      
      neighbors.forEach(d => {
        sellerKnnLinks.push({
          source: `s_${sellerItem.seller_id}`,
          target: `s_${d.seller_id}`,
          type: 'knn'
        });
      });
    });

    const nearestCustomers = Array.from(d3.rollup(candidates, v => v[0], d => d.customer_id).values())
      .map(d => ({
        ...d,
        dist: haversineDistance([o.customer_lng, o.customer_lat], [d.customer_lng, d.customer_lat])
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);

    const rawNodes: any[] = [
      { id: `c_${o.customer_id}`, type: 'customer', data: o, root: true },
      ...orderItems.map(d => ({ id: `s_${d.seller_id}`, type: 'seller', data: d, root: true })),
      ...nearestCustomers.map(d => ({ id: `c_${d.customer_id}`, type: 'customer', data: d, root: false })),
      ...nearestSellers.map(d => ({ id: `s_${d.seller_id}`, type: 'seller', data: d, root: false }))
    ];

    // Deduplicate nodes by ID (prioritize roots and earlier occurrences)
    const nodes = Array.from(d3.group(rawNodes, d => d.id).values()).map(g => g[0]);

    const links: any[] = [];

    orderItems.forEach(d => {
      links.push({
        source: `s_${d.seller_id}`,
        target: `c_${o.customer_id}`,
        type: 'order'
      });
    });

    sellerKnnLinks.forEach(link => links.push(link));

    nearestCustomers.forEach(d => {
      links.push({
        source: `c_${o.customer_id}`,
        target: `c_${d.customer_id}`,
        type: 'knn'
      });
    });

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(50))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => d.type === 'order' ? 'var(--text)' : 'var(--text-muted)')
      .attr('stroke-dasharray', d => d.type === 'knn' ? '5,5' : '0')
      .attr('stroke-width', d => d.type === 'order' ? 2 : 1)
      .attr('opacity', d => d.type === 'knn' ? 0.5 : 1);

    const node = svg.append('g')
      .selectAll<SVGGElement, any>('g')
      .data(nodes)
      .join('g');

    node.filter((d: any) => d.type === 'customer')
      .append('circle')
      .attr('r', d => d.root ? 8 : 4)
      .attr('fill', d => d.data.arrival_delta > 0 ? 'var(--red)' : 'var(--border)')
      .attr('stroke', d => d.root ? 'var(--bg)' : 'none')
      .attr('stroke-width', d => d.root ? 2 : 0);

    node.filter((d: any) => d.type === 'seller')
      .append('rect')
      .attr('width', d => d.root ? 16 : 8)
      .attr('height', d => d.root ? 16 : 8)
      .attr('x', d => d.root ? -8 : -4)
      .attr('y', d => d.root ? -8 : -4)
      .attr('fill', d => d.data.departure_delta > 0 ? 'var(--red)' : 'var(--border)')
      .attr('stroke', d => d.root ? 'var(--bg)' : 'none')
      .attr('stroke-width', d => d.root ? 2 : 0);

    node.append('title').text((d: any) => `${d.type}: ${d.id.substring(2)}`);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

  }, [orderItems, allData]);

  return (
    <div className="knn-panel">
      <h3>KNN Graph</h3>
      <svg ref={svgRef} width="100%" height={400} viewBox="0 0 600 400"></svg>
    </div>
  );
};
