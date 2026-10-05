import { clamp } from '../../../utils/clamp';

export type TargetKind = 'continuous' | 'binary' | 'none';

export interface TargetMeta {
  kind: TargetKind;

  // Engine-canonical range
  paramRange?: { min: number; max: number };

  // Number-input UX layer (display units)
  paramInputMin?: number;
  paramInputMax?: number;
  paramInputStep?: number;
  paramSuffix?: string;                           // e.g. "%", "dB"; undefined = no suffix
  paramToDisplay?: (canonical: number) => number; // 0.55 → 55 for Mix
  paramFromDisplay?: (display: number) => number; // 55 → 0.55 for Mix

  // Display formatter (for non-input contexts like MidiPage rows)
  paramLabel?: string;
  paramFormat?: (v: number) => string;
  paramParse?: (s: string) => number | null;

  // Binary
  binaryLabels?: { off: string; on: string };
  binaryHelpTemplate?: (threshold: number) => string;
}

const parseNumber = (s: string): number | null => {
  const cleaned = s.replace(/[^0-9.\-]/g, '');
  const v = parseFloat(cleaned);
  return Number.isFinite(v) ? v : null;
};

export const TARGET_META: Record<string, TargetMeta> = {
  blockMix: {
    kind: 'continuous',
    paramRange: { min: 0, max: 1 },
    paramInputMin: 0,
    paramInputMax: 100,
    paramInputStep: 0.5,
    paramSuffix: '%',
    paramToDisplay: (v) => v * 100,
    paramFromDisplay: (d) => clamp(d / 100, 0, 1),
    paramLabel: 'Mix',
    paramFormat: (v) => `${Math.round(v * 100)}%`,
    paramParse: (s) => {
      const n = parseNumber(s);
      return n == null ? null : clamp(n / 100, 0, 1);
    },
  },
  blockBalance: {
    kind: 'continuous',
    paramRange: { min: -1, max: 1 },
    paramInputMin: -100,
    paramInputMax: 100,
    paramInputStep: 1,
    paramSuffix: undefined,
    paramToDisplay: (v) => v * 100,
    paramFromDisplay: (d) => clamp(d / 100, -1, 1),
    paramLabel: 'Balance',
    paramFormat: (v) => `${Math.round(v * 100)}`,
    paramParse: (s) => {
      const n = parseNumber(s);
      return n == null ? null : clamp(n / 100, -1, 1);
    },
  },
  blockLevel: {
    kind: 'continuous',
    paramRange: { min: -60, max: 12 },
    paramInputMin: -60,
    paramInputMax: 12,
    paramInputStep: 0.5,
    paramSuffix: 'dB',
    paramToDisplay: (v) => v,
    paramFromDisplay: (d) => clamp(d, -60, 12),
    paramLabel: 'Level',
    paramFormat: (v) => `${v.toFixed(1)} dB`,
    paramParse: (s) => {
      const n = parseNumber(s);
      return n == null ? null : clamp(n, -60, 12);
    },
  },
  sceneSwitch:  { kind: 'none' },
  presetChange: { kind: 'none' },
  blockBypass: {
    kind: 'binary',
    binaryLabels: { off: 'OFF', on: 'ON' },
    binaryHelpTemplate: (t) => `Block turns ON when CC ≥ ${t}, OFF when CC < ${t}.`,
  },
  tunerToggle: {
    kind: 'binary',
    binaryLabels: { off: 'OFF', on: 'ON' },
    binaryHelpTemplate: (t) => `Tuner turns ON when CC ≥ ${t}, OFF when CC < ${t}.`,
  },
  blockState: {
    kind: 'binary',
    binaryLabels: { off: 'IGNORED', on: 'RECALL' },
    binaryHelpTemplate: (t) => `State recalled when CC ≥ ${t}. Lower values ignored.`,
  },
};
