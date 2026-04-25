import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { OrderItem } from '../types';
import { computeKNNNeighbors, createTooltip } from '../utils';
import './KNNPanel.css';

const SVG_WIDTH = 600;
const SVG_HEIGHT = 400;

const NODE_RADIUS = 13;
const EDGE_MIN = NODE_RADIUS * 2;
const EDGE_MAX = 170;

interface KNNNode {
  id: string;
  data: OrderItem;
  root: boolean;
  dist: number;
}

interface KNNLink {
  source: string;
  target: string;
  dist: number;
}

interface KNNPanelProps {
  orderItems: OrderItem[];
  allData: OrderItem[];
}

export const KNNPanel: React.FC<KNNPanelProps> = ({ orderItems, allData }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || orderItems.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const anchor = orderItems[0];
    const nearestCustomers = computeKNNNeighbors(anchor, allData);

    const rawNodes: KNNNode[] = [
      { id: `c_${anchor.customer_id}`, data: anchor, root: true, dist: 0 },
      ...nearestCustomers.map(d => ({ id: `c_${d.customer_id}`, data: d, root: false, dist: d.dist })),
    ];

    // Deduplicate — the anchor's customer may appear in nearestCustomers
    const nodes = Array.from(d3.group(rawNodes, d => d.id).values()).map(g => g[0]);

    const links: KNNLink[] = nearestCustomers.map(d => ({
      source: `c_${anchor.customer_id}`,
      target: `c_${d.customer_id}`,
      dist: d.dist,
    }));

    const maxDist = d3.max(links, d => d.dist) || 1;
    const radialScale = d3.scaleLinear().domain([0, maxDist]).range([EDGE_MIN, EDGE_MAX]);

    // Fan layout: anchor on the left, neighbors in a semicircle to the right
    const rootX = SVG_WIDTH / 2 - EDGE_MAX / 2;
    const rootY = SVG_HEIGHT / 2;
    const n = nearestCustomers.length;

    const posMap = new Map<string, { x: number; y: number }>();
    posMap.set(`c_${anchor.customer_id}`, { x: rootX, y: rootY });
    nearestCustomers.forEach((d, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI) / (n > 1 ? n - 1 : 1);
      const r = radialScale(d.dist);
      posMap.set(`c_${d.customer_id}`, { x: rootX + r * Math.cos(angle), y: rootY + r * Math.sin(angle) });
    });

    const tooltip = createTooltip();

    const nodeTooltip = (d: KNNNode) => {
      const lines = [
        `Customer: ${d.id.slice(-8)}`,
        `Order Date: ${d.data.order_purchase_timestamp.toLocaleDateString()}`,
      ];
      if (!d.root) lines.push(`Distance: ${d.dist.toFixed(2)} km`);
      return lines.join('\n');
    };

    const link = svg.append('g')
      .selectAll<SVGLineElement, KNNLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', 'var(--text-muted)')
      .attr('stroke-width', 2)
      .attr('opacity', 0.6)
      .attr('x1', d => posMap.get(d.source)?.x ?? 0)
      .attr('y1', d => posMap.get(d.source)?.y ?? 0)
      .attr('x2', d => posMap.get(d.target)?.x ?? 0)
      .attr('y2', d => posMap.get(d.target)?.y ?? 0);

    const node = svg.append('g')
      .selectAll<SVGGElement, KNNNode>('g')
      .data(nodes)
      .join('g')
      .attr('transform', d => {
        const p = posMap.get(d.id) ?? { x: 0, y: 0 };
        return `translate(${p.x},${p.y})`;
      });

    node.append('circle')
      .attr('r', NODE_RADIUS)
      .attr('fill', d => d.root ? 'var(--cyan)' : d.data.arrival_delta > 0 ? 'var(--red)' : 'var(--green)')
      .attr('stroke', 'none');

    node.append('text')
      .text(d => d.data.order_id.slice(-8))
      .attr('text-anchor', 'middle')
      .attr('dy', NODE_RADIUS + 15)
      .attr('fill', 'var(--text)')
      .attr('font-size', '11px')
      .style('pointer-events', 'none');

    link
      .on('mouseover', (_event, d) => tooltip.style('visibility', 'visible').text(`Distance: ${d.dist.toFixed(2)} km`))
      .on('mousemove', event => tooltip.style('top', `${event.pageY + 10}px`).style('left', `${event.pageX + 10}px`))
      .on('mouseout', () => tooltip.style('visibility', 'hidden'));

    node
      .on('mouseover', (_event, d) => tooltip.style('visibility', 'visible').text(nodeTooltip(d)))
      .on('mousemove', event => tooltip.style('top', `${event.pageY + 10}px`).style('left', `${event.pageX + 10}px`))
      .on('mouseout', () => tooltip.style('visibility', 'hidden'));

    return () => { tooltip.remove(); };
  }, [orderItems, allData]);

  return (
    <div className="panel knn-panel">
      <h3>Related Orders</h3>
      <div className="knn-panel-body">
        <div className="knn-panel-chart">
          {orderItems.length === 0
            ? <p className="panel-placeholder">Select an order.</p>
            : <svg ref={svgRef} width="100%" style={{ display: 'block', height: '100%' }} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} />}
        </div>
        <aside className="panel-legend panel-legend-aside">
          <h4 className="panel-section-title">Legend</h4>
          <div className="panel-legend-item">
            <div className="legend-circle" style={{ background: 'var(--cyan)' }} />
            <span>Selected</span>
          </div>
          <div className="panel-legend-item">
            <div className="legend-circle legend-green" />
            <span>On time</span>
          </div>
          <div className="panel-legend-item">
            <div className="legend-circle legend-red" />
            <span>Late</span>
          </div>
        </aside>
      </div>
    </div>
  );
};
