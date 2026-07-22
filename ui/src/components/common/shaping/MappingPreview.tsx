import { useEffect, useRef, useState } from 'react';
import { line as d3Line } from 'd3-shape';
import type { MidiCurve } from '../../../store';
import { Numeric } from '../Numeric';
import { clamp } from '../../../utils/clamp';
import styles from './MappingPreview.module.css';

interface Props {
  ccMin: number;
  ccMax: number;
  paramMin: number;
  paramMax: number;
  paramRange: { min: number; max: number };
  curve: MidiCurve;
  xAxisLabel?: string;
  yAxisLabel?: string;
  /** Formats a canonical param value for the hover readout (e.g. 0.5 → "50%"). */
  formatParam?: (canonical: number) => string;
}

// Fixed SVG vertical layout. Width is measured at render time so the viewBox
// always matches the container, letting preserveAspectRatio="meet" scale 1:1
// (no text or anchor distortion).
const DEFAULT_VB_W = 320;
const VB_H = 144;
const PAD_LEFT = 64;    // y-axis gutter (rotated 13px title + 13px tick numbers + spacing)
const PAD_RIGHT = 12;
const PAD_TOP = 6;
const PAD_BOTTOM = 50;  // x-axis gutter (13px tick numbers + 13px axis title + spacing)

// Tick mark stride and length
const TICK_LEN = 3;

function curveT(t: number, curve: MidiCurve): number {
  switch (curve) {
    case 'linear':  return t;
    case 'log':     return Math.log10(1 + 9 * t);
    case 'exp':     return (Math.pow(10, t) - 1) / 9;
    case 'sigmoid': {
      const k = 5;
      const top = Math.tanh((t - 0.5) * k);
      const bot = Math.tanh(0.5 * k);
      return 0.5 + 0.5 * top / bot;
    }
  }
}

export function MappingPreview({
  ccMin, ccMax, paramMin, paramMax, paramRange, curve,
  xAxisLabel, yAxisLabel, formatParam,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [vbW, setVbW] = useState<number>(DEFAULT_VB_W);
  const [hoverCc, setHoverCc] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setVbW(Math.round(w));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const PLOT_W = vbW - PAD_LEFT - PAD_RIGHT;
  const PLOT_H = VB_H - PAD_TOP - PAD_BOTTOM;

  // Map a CC value to plot-X
  const xOf = (cc: number) => PAD_LEFT + (cc / 127) * PLOT_W;
  // Map a param value to plot-Y (inverted: top of plot = paramRange.max)
  const yOf = (p: number) => {
    const t = (p - paramRange.min) / (paramRange.max - paramRange.min);
    return PAD_TOP + (1 - t) * PLOT_H;
  };

  // Apply the same affine + curve mapping the engine does, for the hover dot.
  // Mirror MidiMapper::normalisedCc — degenerate CC range (ccMax <= ccMin)
  // is treated as t = 0, so the param sticks at paramMin.
  const paramAtCc = (cc: number): number => {
    if (ccMax <= ccMin) return paramMin;
    if (cc <= ccMin) return paramMin;
    if (cc >= ccMax) return paramMax;
    const tCc = (cc - ccMin) / (ccMax - ccMin);
    const t = curveT(tCc, curve);
    return paramMin + t * (paramMax - paramMin);
  };

  // Curve segment points (sampled along ccMin..ccMax)
  const SAMPLES = 48;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const tCc = i / SAMPLES;
    const cc = ccMin + tCc * (ccMax - ccMin);
    const t = curveT(tCc, curve);
    const param = paramMin + t * (paramMax - paramMin);
    points.push([xOf(cc), yOf(param)]);
  }
  const lineGen = d3Line<[number, number]>().x((d) => d[0]).y((d) => d[1]);
  const segmentD = lineGen(points) ?? '';

  // Flat clamp lines outside [ccMin, ccMax]
  const leftClampD = lineGen([
    [PAD_LEFT, yOf(paramMin)],
    [xOf(ccMin), yOf(paramMin)],
  ]) ?? '';
  const rightClampD = lineGen([
    [xOf(ccMax), yOf(paramMax)],
    [PAD_LEFT + PLOT_W, yOf(paramMax)],
  ]) ?? '';

  // Hover handlers — convert clientX to integer CC value, snapping to 0..127.
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const xInVb = ((e.clientX - rect.left) / rect.width) * vbW;
    if (xInVb < PAD_LEFT || xInVb > PAD_LEFT + PLOT_W) {
      setHoverCc(null);
      return;
    }
    const cc = Math.round(((xInVb - PAD_LEFT) / PLOT_W) * 127);
    setHoverCc(clamp(cc, 0, 127));
  };

  const handleMouseLeave = () => setHoverCc(null);

  // X-axis tick stride: 5 ticks evenly spaced (0, 32, 64, 96, 127). Last is
  // pushed to 127 so the rightmost tick lines up with the plot end.
  const xTicks = [0, 32, 64, 96, 127];
  // Y-axis tick stride: 5 ticks evenly spaced through the param range.
  const yTickCount = 5;
  const yTickValues: number[] = [];
  for (let i = 0; i < yTickCount; i++) {
    const t = i / (yTickCount - 1);
    yTickValues.push(paramRange.min + t * (paramRange.max - paramRange.min));
  }

  // Anchor labels — only label numbers at the user's anchor positions.
  const xLabelCcs = new Set<number>([ccMin, ccMax]);
  const yLabelParams = [paramMin, paramMax];

  // Hover readout
  let hoverPoint: { x: number; y: number; cc: number; param: number } | null = null;
  if (hoverCc !== null) {
    const param = paramAtCc(hoverCc);
    hoverPoint = { x: xOf(hoverCc), y: yOf(param), cc: hoverCc, param };
  }

  const fmt = formatParam ?? ((v: number) => v.toFixed(2));

  return (
    <div ref={containerRef} className={styles.preview}>
      <svg
        viewBox={`0 0 ${vbW} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className={styles.svg}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Plot border */}
        <rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={PLOT_W}
          height={PLOT_H}
          className={styles.plotBox}
        />

        {/* X-axis tick marks */}
        {xTicks.map((cc) => (
          <line
            key={`xt-${cc}`}
            x1={xOf(cc)}
            x2={xOf(cc)}
            y1={PAD_TOP + PLOT_H}
            y2={PAD_TOP + PLOT_H + TICK_LEN}
            className={styles.tickMark}
          />
        ))}
        {/* Y-axis tick marks */}
        {yTickValues.map((p, i) => (
          <line
            key={`yt-${i}`}
            x1={PAD_LEFT - TICK_LEN}
            x2={PAD_LEFT}
            y1={yOf(p)}
            y2={yOf(p)}
            className={styles.tickMark}
          />
        ))}

        {/* Clamp segments (dashed) */}
        <path className={styles.dashed} d={leftClampD} />
        <path className={styles.dashed} d={rightClampD} />

        {/* Curve segment (solid) */}
        <path className={styles.curve} d={segmentD} />

        {/* Anchors */}
        <circle cx={xOf(ccMin)} cy={yOf(paramMin)} r={3} className={styles.anchor} />
        <circle cx={xOf(ccMax)} cy={yOf(paramMax)} r={3} className={styles.anchor} />

        {/* Anchor numeric labels — X axis */}
        {Array.from(xLabelCcs).map((cc) => (
          <Numeric
            as="text"
            key={`xl-${cc}`}
            x={xOf(cc)}
            y={PAD_TOP + PLOT_H + 13}
            textAnchor="middle"
            className={styles.tick}
          >{cc}</Numeric>
        ))}
        {/* Anchor numeric labels — Y axis */}
        {yLabelParams.map((p, i) => (
          <Numeric
            as="text"
            key={`yl-${i}`}
            x={PAD_LEFT - 5}
            y={yOf(p) + 3}
            textAnchor="end"
            className={styles.axisLabel}
          >{fmt(p)}</Numeric>
        ))}

        {/* Crosshair + hover dot — readout label rendered as DOM overlay below */}
        {hoverPoint && (
          <g className={styles.hoverGroup}>
            <line
              x1={hoverPoint.x}
              x2={hoverPoint.x}
              y1={PAD_TOP}
              y2={PAD_TOP + PLOT_H}
              className={styles.crosshair}
            />
            <line
              x1={PAD_LEFT}
              x2={PAD_LEFT + PLOT_W}
              y1={hoverPoint.y}
              y2={hoverPoint.y}
              className={styles.crosshair}
            />
            <circle
              cx={hoverPoint.x}
              cy={hoverPoint.y}
              r={4}
              className={styles.hoverDot}
            />
          </g>
        )}

        {/* Axis titles */}
        {xAxisLabel && (
          <text
            x={PAD_LEFT + PLOT_W / 2}
            y={VB_H - 4}
            textAnchor="middle"
            className={styles.axisTitle}
          >{xAxisLabel}</text>
        )}
        {yAxisLabel && (
          <text
            x={10}
            y={PAD_TOP + PLOT_H / 2}
            textAnchor="middle"
            className={styles.axisTitle}
            transform={`rotate(-90 10 ${PAD_TOP + PLOT_H / 2})`}
          >{yAxisLabel}</text>
        )}
      </svg>
      {hoverPoint && (
        <Numeric as="div" className={styles.hoverLabel}>
          CC {hoverPoint.cc} → {fmt(hoverPoint.param)}
        </Numeric>
      )}
    </div>
  );
}
