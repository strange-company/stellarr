import { useState, useEffect, useMemo } from 'react';
import { TbAdjustmentsHorizontal } from 'react-icons/tb';
import { useStore } from '../../store';
import {
  requestStartMidiLearn,
  requestCancelMidiLearn,
  requestAddMidiMapping,
  requestRemoveMidiMapping,
} from '../../bridge';
import { PROGRAM_CHANGE_CC } from './constants';
import { ContinuousShaping, type ShapingState } from './ContinuousShaping';
import { BinaryShaping } from './BinaryShaping';
import { Button } from './Button';
import { DialogShell } from './DialogShell';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { Select } from './Select';
import { TARGET_META } from './shaping/targetMeta';
import styles from './MidiAssignDialog.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  target: string;
  blockId?: string;
  targetIndex?: number;
  existingIndex?: number;
  programChange?: boolean;
}

export function MidiAssignDialog({
  open,
  onOpenChange,
  title,
  target,
  blockId,
  targetIndex,
  existingIndex,
  programChange,
}: Props) {
  const learning = useStore((s) => s.midiLearning);
  const mappings = useStore((s) => s.midiMappings);

  const channelOptions = useMemo(
    () => [
      { value: '-1', label: 'Any' },
      ...Array.from({ length: 16 }, (_, i) => ({ value: String(i), label: `Ch ${i + 1}` })),
    ],
    [],
  );

  const existing =
    existingIndex !== undefined && existingIndex >= 0 ? mappings[existingIndex] : null;

  const targetMeta = TARGET_META[target] ?? { kind: 'none' as const };

  const [ccValue, setCcValue] = useState('');
  const [channel, setChannel] = useState('-1');
  const [shaping, setShaping] = useState<ShapingState>(() => ({
    ccMin: existing?.ccMin ?? 0,
    ccMax: existing?.ccMax ?? 127,
    paramMin: existing?.paramMin,
    paramMax: existing?.paramMax,
    curve: existing?.curve ?? 'linear',
  }));
  const [threshold, setThreshold] = useState<number>(existing?.threshold ?? 64);

  useEffect(() => {
    if (open) setThreshold(existing?.threshold ?? 64);
  }, [open, existing]);

  useEffect(() => {
    if (open && existing) {
      setCcValue(String(existing.cc));
      setChannel(String(existing.channel));
    } else if (open) {
      setCcValue('');
      setChannel('-1');
    }
  }, [open, existing]);

  useEffect(() => {
    if (open) {
      setShaping({
        ccMin: existing?.ccMin ?? 0,
        ccMax: existing?.ccMax ?? 127,
        paramMin: existing?.paramMin,
        paramMax: existing?.paramMax,
        curve: existing?.curve ?? 'linear',
      });
    }
  }, [open, existing]);

  const submit = () => {
    const shapingFields = targetMeta.kind === 'continuous'
      ? {
          ccMin: shaping.ccMin,
          ccMax: shaping.ccMax,
          paramMin: shaping.paramMin,
          paramMax: shaping.paramMax,
          curve: shaping.curve,
        }
      : targetMeta.kind === 'binary'
      ? { threshold }
      : {};

    if (programChange) {
      if (existingIndex !== undefined && existingIndex >= 0)
        requestRemoveMidiMapping(existingIndex);
      requestAddMidiMapping({
        channel: parseInt(channel, 10),
        cc: PROGRAM_CHANGE_CC,
        target,
        blockId,
        targetIndex,
        ...shapingFields,
      });
      onOpenChange(false);
      return;
    }
    const cc = parseInt(ccValue, 10);
    if (isNaN(cc) || cc < 0 || cc > 127) return;
    if (existingIndex !== undefined && existingIndex >= 0) requestRemoveMidiMapping(existingIndex);
    requestAddMidiMapping({
      channel: parseInt(channel, 10),
      cc,
      target,
      blockId,
      targetIndex,
      ...shapingFields,
    });
    onOpenChange(false);
  };

  const clear = () => {
    if (existingIndex !== undefined && existingIndex >= 0) requestRemoveMidiMapping(existingIndex);
    onOpenChange(false);
  };

  return (
    <DialogShell open={open} onOpenChange={onOpenChange} title={title} variant="titlebar">
      {/* MIDI source — CC + Channel */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>MIDI source</div>
        <div className={styles.fieldRow}>
          {/* CC Number with Learn icon button — hidden in PC mode */}
          {!programChange && (
            <div className={styles.fieldGroupFlex}>
              <span className={styles.fieldLabel}>CC Number</span>
              <div className={`${styles.ccInputWrap} ${learning ? styles.learning : ''}`}>
                <IconButton
                  inGroup
                  variant={learning ? 'primary' : 'default'}
                  icon={<TbAdjustmentsHorizontal />}
                  onClick={() => {
                    if (learning) requestCancelMidiLearn();
                    else {
                      const shapingFields = targetMeta.kind === 'continuous'
                        ? {
                            ccMin: shaping.ccMin,
                            ccMax: shaping.ccMax,
                            paramMin: shaping.paramMin,
                            paramMax: shaping.paramMax,
                            curve: shaping.curve,
                          }
                        : targetMeta.kind === 'binary'
                        ? { threshold }
                        : {};
                      requestStartMidiLearn({ target, blockId, targetIndex, ...shapingFields });
                    }
                  }}
                  title={
                    learning
                      ? 'Cancel MIDI learn'
                      : 'Learn — send a CC from your controller to auto-detect'
                  }
                />
                <Input
                  inGroup
                  mono
                  autoFocus
                  placeholder="0-127"
                  value={ccValue}
                  onChange={(e) => setCcValue(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                  }}
                  className={styles.ccInput}
                />
              </div>
            </div>
          )}

          {/* Channel */}
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Channel</span>
            <Select
              value={channel}
              onValueChange={setChannel}
              options={channelOptions}
              ariaLabel="Channel"
              inDialog
            />
          </div>
        </div>
        {programChange && (
          <p className={styles.pcNote}>
            Program Change value maps directly to preset index in the active folder.
          </p>
        )}
      </div>

      {targetMeta.kind === 'continuous' && (
        <>
          <div className={styles.divider} />
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Shaping</div>
            <ContinuousShaping
              meta={targetMeta}
              state={shaping}
              onChange={setShaping}
            />
          </div>
        </>
      )}

      {targetMeta.kind === 'binary' && (
        <>
          <div className={styles.divider} />
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Trigger</div>
            <BinaryShaping
              meta={targetMeta}
              threshold={threshold}
              onChange={setThreshold}
            />
          </div>
        </>
      )}

      {/* Buttons: Clear (left) | Cancel + Save (right) */}
      <div className={styles.buttonRow}>
        <div>
          {existing && (
            <Button variant="danger" onClick={clear}>
              Clear
            </Button>
          )}
        </div>
        <div className={styles.buttonGroup}>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Save
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}
