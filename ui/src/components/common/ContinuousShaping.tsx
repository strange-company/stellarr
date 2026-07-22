import { useEffect, useState } from 'react';
import { MappingPreview } from './shaping/MappingPreview';
import { Input } from './Input';
import { InputGroup, InputGroupLabel } from './InputGroup';
import { Select } from './Select';
import type { TargetMeta } from './shaping/targetMeta';
import type { MidiCurve } from '../../store';
import { clamp } from '../../utils/clamp';
import styles from './ContinuousShaping.module.css';

const CURVE_OPTIONS = [
  { value: 'linear',  label: 'Linear' },
  { value: 'log',     label: 'Log' },
  { value: 'exp',     label: 'Exp' },
  { value: 'sigmoid', label: 'S-curve' },
];

export interface ShapingState {
  ccMin: number;
  ccMax: number;
  paramMin: number | undefined; // undefined = use target default
  paramMax: number | undefined;
  curve: MidiCurve;
}

interface Props {
  meta: TargetMeta;
  state: ShapingState;
  onChange: (next: ShapingState) => void;
}

interface ParamInputProps {
  meta: TargetMeta;
  value: number;            // canonical
  onCommit: (canonical: number) => void;
}

function ParamInput({ meta, value, onCommit }: ParamInputProps) {
  // Local text state so the user can type intermediate forms ("-", "0.", "")
  // without immediate normalisation. Live-commit on every keystroke that
  // parses to a finite number — that's what drives the live graph update.
  const [str, setStr] = useState<string>(String(meta.paramToDisplay!(value)));

  useEffect(() => {
    const expected = meta.paramToDisplay!(value);
    const parsed = parseFloat(str);
    // Only resync from `value` when local text doesn't match — preserves
    // mid-edit text like "-" or "0." while still picking up external changes
    // (e.g. up/down arrow steppers from the input itself).
    if (!Number.isFinite(parsed) || Math.abs(parsed - expected) > 1e-6) {
      setStr(String(expected));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (raw: string) => {
    setStr(raw);
    const n = parseFloat(raw);
    if (Number.isFinite(n)) {
      const clamped = clamp(n, meta.paramInputMin!, meta.paramInputMax!);
      onCommit(meta.paramFromDisplay!(clamped));
    }
  };

  const handleBlur = () => {
    const expected = meta.paramToDisplay!(value);
    const n = parseFloat(str);
    // Revert when input is non-numeric OR when the typed value disagrees with
    // the committed canonical value (e.g. "200" was clamped to 100 but the
    // commit was a no-op because state was already at 100).
    if (!Number.isFinite(n) || Math.abs(n - expected) > 1e-6) {
      setStr(String(expected));
    }
  };

  // Always inGroup — parent always wraps this in an InputGroup with a "Min" /
  // "Max" prefix label (and a unit suffix label when meta.paramSuffix is set).
  return (
    <Input
      inGroup
      type="number"
      min={meta.paramInputMin}
      max={meta.paramInputMax}
      step={meta.paramInputStep}
      value={str}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
    />
  );
}

export function ContinuousShaping({ meta, state, onChange }: Props) {
  if (
    meta.kind !== 'continuous'
    || !meta.paramRange
    || meta.paramInputMin == null
    || meta.paramInputMax == null
    || meta.paramInputStep == null
    || !meta.paramToDisplay
    || !meta.paramFromDisplay
  ) {
    return null;
  }
  const range = meta.paramRange;

  const commitCcMin = (v: number) => {
    // Cap at 126 so there's always room for ccMax > ccMin. The input itself
    // accepts 0..127; we just guarantee a non-empty CC range in committed state.
    const ccMin = Math.min(126, clamp(Math.round(v), 0, 127));
    const ccMax = state.ccMax > ccMin ? state.ccMax : Math.min(127, ccMin + 1);
    onChange({ ...state, ccMin, ccMax });
  };
  const commitCcMax = (v: number) => {
    // Floor at 1 so there's always room for ccMin < ccMax.
    const ccMax = Math.max(1, clamp(Math.round(v), 0, 127));
    const ccMin = state.ccMin < ccMax ? state.ccMin : Math.max(0, ccMax - 1);
    onChange({ ...state, ccMin, ccMax });
  };

  const previewParamMin = state.paramMin ?? range.min;
  const previewParamMax = state.paramMax ?? range.max;

  // Hover-readout formatter — preserves the input's display precision (e.g.
  // 50.5% for Mix at 0.5% step) instead of `meta.paramFormat`'s row-display
  // rounding.
  const step = meta.paramInputStep!;
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  const formatHover = (canonical: number) =>
    `${meta.paramToDisplay!(canonical).toFixed(decimals)}${meta.paramSuffix ?? ''}`;

  const paramNoun = meta.paramLabel ?? 'value';
  const paramHeader = meta.paramSuffix ? `${paramNoun} ${meta.paramSuffix}` : paramNoun;

  const ccGroup = (
    label: string,
    value: number,
    onCommit: (n: number) => void,
    fallback: number,
  ) => (
    <InputGroup>
      <InputGroupLabel className={styles.minMaxPrefix}>{label}</InputGroupLabel>
      <Input
        inGroup
        type="number"
        min={0}
        max={127}
        step={1}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onCommit(Number.isNaN(n) ? fallback : n);
        }}
      />
    </InputGroup>
  );

  const paramGroup = (label: string, canonicalValue: number, onCommit: (canonical: number) => void) => (
    <InputGroup>
      <InputGroupLabel className={styles.minMaxPrefix}>{label}</InputGroupLabel>
      <ParamInput meta={meta} value={canonicalValue} onCommit={onCommit} />
      {meta.paramSuffix && <InputGroupLabel>{meta.paramSuffix}</InputGroupLabel>}
    </InputGroup>
  );

  return (
    <>
      <div className={styles.fg}>
        <span className={styles.label}>Curve</span>
        <Select
          value={state.curve}
          onValueChange={(v) => onChange({ ...state, curve: v as MidiCurve })}
          options={CURVE_OPTIONS}
          ariaLabel="Curve"
          inDialog
        />
      </div>

      <div className={styles.row}>
        <div className={styles.col}>
          <span className={styles.label}>CC value</span>
          {ccGroup('Min', state.ccMin, commitCcMin, 0)}
          {ccGroup('Max', state.ccMax, commitCcMax, 127)}
        </div>
        <div className={styles.col}>
          <span className={styles.label}>{paramHeader}</span>
          {paramGroup(
            'Min',
            state.paramMin ?? range.min,
            (canonical) => onChange({ ...state, paramMin: canonical }),
          )}
          {paramGroup(
            'Max',
            state.paramMax ?? range.max,
            (canonical) => onChange({ ...state, paramMax: canonical }),
          )}
        </div>
      </div>

      <MappingPreview
        ccMin={state.ccMin}
        ccMax={state.ccMax}
        paramMin={previewParamMin}
        paramMax={previewParamMax}
        paramRange={range}
        curve={state.curve}
        xAxisLabel="CC value"
        yAxisLabel={paramNoun}
        formatParam={formatHover}
      />

      <p className={styles.helpText}>
        CC values inside the range map to the parameter range. Outside = clamped. Set Min &gt; Max in the parameter column to invert.
      </p>
    </>
  );
}
