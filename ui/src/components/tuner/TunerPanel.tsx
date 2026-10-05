import { useState } from 'react';
import { useStore } from '../../store';
import { requestSetReferencePitch } from '../../bridge';
import { Input } from '../common/Input';
import { InputGroup, InputGroupLabel } from '../common/InputGroup';
import { MidiAssignDialog } from '../common/MidiAssignDialog';
import { MidiBadge } from '../common/MidiBadge';
import { Numeric } from '../common/Numeric';
import { Tablist, Tab } from '../common/Tablist';
import { Tag } from '../common/Tag';
import styles from './TunerPanel.module.css';

const presets = [432, 440, 442, 444];

export function TunerPanel() {
  const referencePitch = useStore((s) => s.referencePitch);
  const tunerMode = useStore((s) => s.tunerMode);
  const setTunerMode = useStore((s) => s.setTunerMode);
  const mappings = useStore((s) => s.midiMappings);
  const [inputValue, setInputValue] = useState<string>(String(referencePitch));
  const [focused, setFocused] = useState(false);
  const [midiDialogOpen, setMidiDialogOpen] = useState(false);

  const tunerMidiIndex = mappings.findIndex((m) => m.target === 'tunerToggle');
  const tunerMidi = tunerMidiIndex >= 0 ? mappings[tunerMidiIndex] : null;

  const displayValue = focused ? inputValue : String(referencePitch);

  const applyValue = (val: string) => {
    const hz = parseFloat(val);
    if (!isNaN(hz) && hz >= 420 && hz <= 460) {
      requestSetReferencePitch(hz);
    }
    setInputValue(String(referencePitch));
  };

  return (
    <div className={styles.panel}>
      <div className={styles.titleRow}>
        <span className={styles.title}>Tuner</span>
        <MidiBadge
          mapping={tunerMidi}
          onClick={() => setMidiDialogOpen(true)}
          title={tunerMidi ? `Tuner MIDI: CC ${tunerMidi.cc}` : 'Assign MIDI CC to Tuner toggle'}
        />
      </div>

      <div className={styles.divider} />

      <div className={styles.content}>
        <span className={styles.sectionTitle}>Mode</span>

        <Tablist
          value={tunerMode}
          onChange={(id) => setTunerMode(id as 'needle' | 'strobe')}
          aria-label="Tuner mode"
          stretch
          accent="secondary"
        >
          <Tab id="needle">Needle</Tab>
          <Tab id="strobe">Strobe</Tab>
        </Tablist>
      </div>

      <div className={styles.divider} />

      <div className={styles.content}>
        <span className={styles.sectionTitle}>Reference Pitch</span>

        <InputGroup>
          <InputGroupLabel>A4</InputGroupLabel>
          <Input
            inGroup
            mono
            type="number"
            value={displayValue}
            min={420}
            max={460}
            step={1}
            onFocus={() => {
              setInputValue(String(referencePitch));
              setFocused(true);
            }}
            onBlur={(e) => {
              setFocused(false);
              applyValue(e.target.value);
            }}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyValue(inputValue);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          <InputGroupLabel>Hz</InputGroupLabel>
        </InputGroup>

        <div className={styles.presets}>
          {presets.map((hz) => (
            <Tag
              key={hz}
              active={referencePitch === hz}
              onClick={() => requestSetReferencePitch(hz)}
              className={styles.presetTag}
            >
              <Numeric>{hz}</Numeric>
            </Tag>
          ))}
        </div>
      </div>
      <MidiAssignDialog
        open={midiDialogOpen}
        onOpenChange={setMidiDialogOpen}
        title="MIDI — Tuner Toggle"
        target="tunerToggle"
        existingIndex={tunerMidiIndex >= 0 ? tunerMidiIndex : undefined}
      />
    </div>
  );
}
