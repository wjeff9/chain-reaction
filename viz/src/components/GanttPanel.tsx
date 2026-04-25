import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { OrderItem } from '../types';
import { buildGanttPhases, createTooltip } from '../utils';
import './GanttPanel.css';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const CHART_WIDTH = 600;
const CHART_HEIGHT = 300;
const MARGIN = { top: 40, right: 30, bottom: 40, left: 120 };

interface GanttPanelProps {
  orderItems: OrderItem[];
}

export const GanttPanel: React.FC<GanttPanelProps> = ({ orderItems }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || orderItems.length === 0) return;

    const innerWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const item = orderItems[0];
    const estimatedDelivery = item.order_estimated_delivery_date;
    const phases = buildGanttPhases(item);

    const domainMax = d3.max(phases, d => Math.max(d.end.getTime(), d.expectedEnd.getTime())) || 0;

    const xScale = d3.scaleTime()
      .domain([d3.min(phases, d => d.start) || new Date(), new Date(domainMax)])
      .range([0, innerWidth]);

    const yScale = d3.scaleBand()
      .domain(phases.map(p => p.name))
      .range([0, innerHeight])
      .padding(0.3);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .selectAll('text')
      .style('fill', 'var(--text)')
      .style('font-family', 'inherit')
      .style('font-size', '12px');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('fill', 'var(--text)')
      .style('font-family', 'inherit')
      .style('font-size', '12px');

    g.selectAll('.domain, .tick line').attr('stroke', 'var(--border)');

    const tooltip = createTooltip();

    const addTooltip = (rect: any, label: string) =>
      rect
        .on('mouseover', () => tooltip.style('visibility', 'visible').text(label))
        .on('mousemove', (event: MouseEvent) => {
          tooltip.style('top', `${event.pageY + 10}px`).style('left', `${event.pageX + 10}px`);
        })
        .on('mouseout', () => tooltip.style('visibility', 'hidden'));

    const hasDeadline = !isNaN(estimatedDelivery.getTime());

    phases.forEach(p => {
      const y = yScale(p.name) ?? 0;
      const h = yScale.bandwidth();
      const days = (d: Date, e: Date) => Math.round((e.getTime() - d.getTime()) / MS_PER_DAY);

      // Split the bar at the deadline when the phase straddles it
      if (hasDeadline && p.start < estimatedDelivery && p.end > estimatedDelivery) {
        addTooltip(
          g.append('rect')
            .attr('x', xScale(p.start)).attr('y', y)
            .attr('width', Math.max(0, xScale(estimatedDelivery) - xScale(p.start))).attr('height', h)
            .attr('fill', 'var(--green)'),
          `${days(p.start, estimatedDelivery)} days`
        );
        addTooltip(
          g.append('rect')
            .attr('x', xScale(estimatedDelivery)).attr('y', y)
            .attr('width', Math.max(0, xScale(p.end) - xScale(estimatedDelivery))).attr('height', h)
            .attr('fill', 'var(--red)'),
          `${days(estimatedDelivery, p.end)} days over`
        );
      } else {
        const isLate = hasDeadline && p.start >= estimatedDelivery;
        addTooltip(
          g.append('rect')
            .attr('x', xScale(p.start)).attr('y', y)
            .attr('width', Math.max(0, xScale(p.end) - xScale(p.start))).attr('height', h)
            .attr('fill', isLate ? 'var(--red)' : 'var(--green)'),
          `${days(p.start, p.end)} days`
        );
      }
    });

    if (hasDeadline) {
      g.append('line')
        .attr('x1', xScale(estimatedDelivery)).attr('x2', xScale(estimatedDelivery))
        .attr('y1', 0).attr('y2', innerHeight)
        .attr('stroke', 'var(--cyan)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,3');
    }

    return () => { tooltip.remove(); };
  }, [orderItems]);

  return (
    <div className="panel gantt-panel">
      <h3>Delivery Timeline</h3>
      <div className="gantt-panel-body">
        <div className="gantt-panel-chart">
          {orderItems.length === 0
            ? <p className="panel-placeholder">Select an order.</p>
            : <svg ref={svgRef} width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} />}
        </div>
        <aside className="panel-legend panel-legend-aside">
          <h4 className="panel-section-title">Legend</h4>
          <div className="panel-legend-item">
            <div className="legend-square legend-green" />
            <span>On time</span>
          </div>
          <div className="panel-legend-item">
            <div className="legend-square legend-red" />
            <span>Late</span>
          </div>
          <div className="panel-legend-item">
            <svg className="legend-dash-icon" viewBox="0 0 10 10">
              <line x1="0" y1="5" x2="10" y2="5" stroke="var(--cyan)" strokeWidth="2" strokeDasharray="4,3" />
            </svg>
            <span>Est. delivery</span>
          </div>
        </aside>
      </div>
    </div>
  );
};
