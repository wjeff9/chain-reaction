import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { OrderItem } from '../types';
import './GanttPanel.css';

interface GanttPanelProps {
  orderItems: OrderItem[];
}

export const GanttPanel: React.FC<GanttPanelProps> = ({ orderItems }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || orderItems.length === 0) return;

    const width = 600;
    const height = 300;
    const margin = { top: 40, right: 30, bottom: 40, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const o = orderItems[0];
    const t0 = o.order_purchase_timestamp;
    const t1 = o.order_approved_at;
    const t2 = o.order_delivered_carrier_date;
    const t3 = o.order_delivered_customer_date;
    const text = o.order_estimated_delivery_date;

    const phases = [
      { name: 'Approval', start: t0, end: t1, expectedEnd: t1 },
      { name: 'Processing', start: t1, end: t2, expectedEnd: t2 },
      { name: 'Shipping', start: t2, end: t3, expectedEnd: text },
      { name: 'Estimated window', start: t0, end: text, expectedEnd: text, reference: true },
    ].filter(p => !isNaN(p.start.getTime()) && !isNaN(p.end.getTime()));

    const xScale = d3.scaleTime()
      .domain([
        d3.min(phases, d => d.start) || new Date(),
        d3.max(phases, d => Math.max(d.end.getTime(), d.expectedEnd.getTime())) || new Date()
      ])
      .range([0, innerWidth]);

    const yScale = d3.scaleBand()
      .domain(phases.map(p => p.name))
      .range([0, innerHeight])
      .padding(0.3);

    const xAxis = d3.axisBottom(xScale).ticks(5);
    const yAxis = d3.axisLeft(yScale);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('fill', 'var(--text)')
      .style('font-family', 'inherit');

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .style('fill', 'var(--text)')
      .style('font-family', 'inherit');

    g.selectAll('.domain, .tick line').attr('stroke', 'var(--border)');

    phases.forEach(p => {
      const isOverrun = p.end > p.expectedEnd;
      const color = p.reference ? 'var(--panel-bg)' : isOverrun ? 'var(--red)' : 'var(--blue)';

      g.append('rect')
        .attr('x', xScale(p.start))
        .attr('y', yScale(p.name) || 0)
        .attr('width', Math.max(0, xScale(p.end) - xScale(p.start)))
        .attr('height', yScale.bandwidth())
        .attr('fill', color)
        .attr('opacity', p.reference ? 0.8 : 1);
    });

  }, [orderItems]);

  return (
    <div className="gantt-panel">
      <h3>Delivery Timeline</h3>
      {orderItems.length === 0
        ? <p className="panel-placeholder">Select an order.</p>
        : <svg ref={svgRef} width="100%" height={300} viewBox="0 0 600 300"></svg>
      }
    </div>
  );
};
