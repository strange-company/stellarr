import { IoCloseSharp } from 'react-icons/io5';
import { useStore } from '../../store';
import { useUiPrefsStore } from '../../store/uiPrefs';
import { IconButton } from '../common/IconButton';
import { useFloatingPanel } from '../../hooks/useFloatingPanel';
import { MidiMonitorContent } from './MidiMonitor';
import styles from './FloatingMidiPanel.module.css';

export function FloatingMidiPanel() {
  const open = useStore((s) => s.midiPanelOpen);
  const setOpen = useStore((s) => s.setMidiPanelOpen);
  const storedPos = useUiPrefsStore((s) => s.midiPanelPosition);
  const setPos = useUiPrefsStore((s) => s.setMidiPanelPosition);

  // Default top-left so it doesn't collide with the right-anchored
  // OptionsPanel default. Stored position wins once the user drags.
  const {
    panelRef,
    bindDrag,
    style: inlineStyle,
  } = useFloatingPanel({
    pos: storedPos,
    setPos,
    active: open,
    defaultCorner: 'top-left',
  });

  if (!open) return null;

  return (
    <div ref={panelRef} data-floating-panel className={styles.panel} style={inlineStyle}>
      <div className={styles.titlebar}>
        <div {...bindDrag()} className={styles.dragHandle}>
          <span className={styles.titlebarText}>MIDI test</span>
        </div>
        <IconButton
          icon={<IoCloseSharp />}
          size="sm"
          title="Close MIDI test panel"
          onClick={() => setOpen(false)}
          className={styles.closeBtn}
        />
      </div>
      <div className={styles.content}>
        <MidiMonitorContent boundedLog />
      </div>
    </div>
  );
}
