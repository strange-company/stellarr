import { useState, useRef } from 'react';
import { useStore } from '../../store';
import { LoudnessWindowPopup } from '../options/LoudnessWindowPopup';
import { Numeric } from '../common/Numeric';
import { clamp } from '../../utils/clamp';
import styles from './Footer.module.css';

function CpuMeter() {
  const cpu = useStore((s) => s.cpuPercent);
  const clamped = clamp(cpu, 0, 100);

  // CPU uses primary for healthy, secondary (amber) for hot, danger for overload
  const hot = clamped >= 70;
  const overload = clamped >= 90;
  const healthyPct = hot ? 70 : clamped;
  const hotPct = overload ? 20 : hot ? clamped - 70 : 0;

  return (
    <div className={styles.meter}>
      <span className={styles.label}>CPU</span>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{
            width: `${healthyPct}%`,
            background: 'var(--color-primary)',
          }}
        />
        {hotPct > 0 && (
          <div
            className={styles.fillHot}
            style={{
              width: `${hotPct}%`,
              background: overload ? 'var(--color-danger)' : 'var(--color-warning)',
            }}
          />
        )}
      </div>
      <Numeric className={styles.value}>{clamped.toFixed(0)}%</Numeric>
    </div>
  );
}

function LufsMeter({
  label,
  blockType,
  clickable,
}: {
  label: string;
  blockType: 'input' | 'output';
  clickable?: boolean;
}) {
  const lufsByBlockId = useStore((s) => s.lufsByBlockId);
  const targetLufsByBlockId = useStore((s) => s.targetLufsByBlockId);
  const blocks = useStore((s) => s.blocks);

  const block = blocks.find((b) => b.type === blockType);
  const lufs = block ? (lufsByBlockId[block.id] ?? -60) : -60;
  const target = block ? targetLufsByBlockId[block.id] : null;

  const meterRef = useRef<HTMLDivElement>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const openPopup = () => {
    if (!clickable) return;
    if (meterRef.current) setAnchorRect(meterRef.current.getBoundingClientRect());
    setPopupOpen(true);
  };

  // Map LUFS [-60..0] to width [0..100]
  const pct = clamp(((lufs + 60) / 60) * 100, 0, 100);

  // Healthy orchid fill; amber hot zone above -6 LUFS; danger near clip
  const hotThreshold = 90; // ~-6 LUFS
  const dangerThreshold = 97; // ~-2 LUFS
  const healthyPct = Math.min(pct, hotThreshold);
  const hotPct =
    pct > hotThreshold ? Math.min(pct - hotThreshold, dangerThreshold - hotThreshold) : 0;

  // Target-based colouring for output meter
  let fillColor = 'var(--color-primary)';
  if (target != null) {
    const delta = Math.abs(lufs - target);
    if (delta <= 1) fillColor = 'var(--color-green)';
    else if (delta <= 3) fillColor = 'var(--color-warning)';
    else if (lufs > target) fillColor = 'var(--color-danger)';
  }

  const display = lufs <= -60 ? '-inf' : lufs.toFixed(1);

  return (
    <>
      <div className={styles.meter}>
        <span className={styles.label}>{label}</span>
        <div
          ref={meterRef}
          className={`${styles.track} ${clickable ? styles.clickable : ''}`}
          onClick={openPopup}
        >
          <div className={styles.fill} style={{ width: `${healthyPct}%`, background: fillColor }} />
          {hotPct > 0 && (
            <div
              className={styles.fillHot}
              style={{
                width: `${hotPct}%`,
                background: 'var(--color-warning)',
              }}
            />
          )}
        </div>
        <Numeric className={styles.value}>{display}</Numeric>
      </div>
      {clickable && (
        <LoudnessWindowPopup
          open={popupOpen}
          onClose={() => setPopupOpen(false)}
          anchorRect={anchorRect}
        />
      )}
    </>
  );
}

export function Footer() {
  return (
    <div className={styles.footer}>
      <CpuMeter />
      <LufsMeter label="IN" blockType="input" />
      <LufsMeter label="OUT" blockType="output" clickable />
    </div>
  );
}
