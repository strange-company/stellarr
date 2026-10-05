import { TbZoomIn, TbZoomOut } from 'react-icons/tb';
import { PiTrafficSignal } from 'react-icons/pi';
import { useStore } from '../../store';
import { useUiPrefsStore } from '../../store/uiPrefs';
import { IconButton } from '../common/IconButton';
import styles from './GridToolbar.module.css';

export function GridToolbar() {
  const developerModeEnabled = useStore((s) => s.developerModeEnabled);
  const cellZoom = useUiPrefsStore((s) => s.cellZoom);
  const cycleCellZoom = useUiPrefsStore((s) => s.cycleCellZoom);
  const midiPanelOpen = useStore((s) => s.midiPanelOpen);
  const toggleMidiPanel = useStore((s) => s.toggleMidiPanel);

  return (
    <div className={styles.toolbar}>
      {developerModeEnabled && (
        <IconButton
          inGroup
          icon={<PiTrafficSignal />}
          title={midiPanelOpen ? 'Close MIDI test panel' : 'Open MIDI test panel'}
          onClick={toggleMidiPanel}
          active={midiPanelOpen}
        />
      )}
      <IconButton
        inGroup
        icon={<TbZoomOut />}
        title="Zoom out (smaller cells)"
        onClick={() => cycleCellZoom(-1)}
        disabled={cellZoom === 'S'}
      />
      <IconButton
        inGroup
        icon={<TbZoomIn />}
        title="Zoom in (larger cells)"
        onClick={() => cycleCellZoom(+1)}
        disabled={cellZoom === 'L'}
      />
    </div>
  );
}
