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
    const shippingLimit = o.shipping_limit_date;

    const phases = [
      { name: 'Approval', start: t0, end: t1, expectedEnd: t1 },
      { name: 'Processing', start: t1, end: t2, expectedEnd: t2 },
      { name: 'Shipping', start: t2, end: t3, expectedEnd: text },
    ].filter(p => !isNaN(p.start.getTime()) && !isNaN(p.end.getTime()));

    const domainMax = Math.max(
      d3.max(phases, d => Math.max(d.end.getTime(), d.expectedEnd.getTime())) || 0,
      isNaN(shippingLimit.getTime()) ? 0 : shippingLimit.getTime()
    );

    const xScale = d3.scaleTime()
      .domain([d3.min(phases, d => d.start) || new Date(), new Date(domainMax)])
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
      .style('font-family', 'inherit')
      .style('font-size', '12px');

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .style('fill', 'var(--text)')
      .style('font-family', 'inherit')
      .style('font-size', '12px');

    g.selectAll('.domain, .tick line').attr('stroke', 'var(--border)');

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
      .style('box-shadow', '0 4px 6px rgba(0,0,0,0.3)');

    const withTooltip = (rect: any, label: string) =>
      rect.style('cursor', 'default')
        .on('mouseover', () => tooltip.style('visibility', 'visible').text(label))
        .on('mousemove', (event: MouseEvent) => {
          tooltip.style('top', (event.pageY + 10) + 'px')
            .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', () => tooltip.style('visibility', 'hidden'));

    const deadlineValid = !isNaN(text.getTime());

    phases.forEach(p => {
      const y = yScale(p.name) || 0;
      const h = yScale.bandwidth();
      const crosses = deadlineValid && p.start < text && p.end > text;
      const totalDays = (p.end.getTime() - p.start.getTime()) / 86400000;

      if (crosses) {
        const beforeDays = (text.getTime() - p.start.getTime()) / 86400000;
        const afterDays = (p.end.getTime() - text.getTime()) / 86400000;

        withTooltip(
          g.append('rect')
            .attr('x', xScale(p.start)).attr('y', y)
            .attr('width', Math.max(0, xScale(text) - xScale(p.start))).attr('height', h)
            .attr('fill', 'var(--green)'),
          `${beforeDays.toFixed(1)} days`
        );
        withTooltip(
          g.append('rect')
            .attr('x', xScale(text)).attr('y', y)
            .attr('width', Math.max(0, xScale(p.end) - xScale(text))).attr('height', h)
            .attr('fill', 'var(--red)'),
          `${afterDays.toFixed(1)} days over`
        );
      } else {
        const isLate = deadlineValid && p.start >= text;
        withTooltip(
          g.append('rect')
            .attr('x', xScale(p.start)).attr('y', y)
            .attr('width', Math.max(0, xScale(p.end) - xScale(p.start))).attr('height', h)
            .attr('fill', isLate ? 'var(--red)' : 'var(--green)'),
          `${totalDays.toFixed(1)} days`
        );
      }
    });

    if (!isNaN(shippingLimit.getTime())) {
      g.append('line')
        .attr('x1', xScale(shippingLimit))
        .attr('x2', xScale(shippingLimit))
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', 'var(--cyan)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,3');
    }

    if (!isNaN(text.getTime())) {
      g.append('line')
        .attr('x1', xScale(text))
        .attr('x2', xScale(text))
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', 'var(--cyan)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,3');
    }

    return () => { tooltip.remove(); };
  }, [orderItems]);

  return (
    <div className="gantt-panel">
      <h3>Delivery Timeline</h3>
      <div style={{ display: 'flex', gap: '0.75rem', flex: 1, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {orderItems.length === 0
            ? <p className="panel-placeholder">Select an order.</p>
            : <svg ref={svgRef} width="100%" height={300} viewBox="0 0 600 300"></svg>}
        </div>
        <aside className="map-panel-legend" style={{ width: '9rem', flexShrink: 0, alignSelf: 'flex-start' }}>
          <h4 className="map-panel-filters-title">Legend</h4>
          <div className="map-panel-legend-item">
            <div className="legend-square legend-green" />
            <span>On time</span>
          </div>
          <div className="map-panel-legend-item">
            <div className="legend-square legend-red" />
            <span>Late</span>
          </div>
          <div className="map-panel-legend-item">
            <svg style={{ width: '0.625rem', height: '0.625rem', flexShrink: 0 }} viewBox="0 0 10 10">
              <line x1="0" y1="5" x2="10" y2="5" stroke="var(--cyan)" strokeWidth="2" strokeDasharray="4,3" />
            </svg>
            <span>Est. delivery</span>
          </div>
        </aside>
      </div>
    </div>
  );
};
