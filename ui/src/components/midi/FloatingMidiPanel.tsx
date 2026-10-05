import { useCallback, useEffect, useRef } from 'react';
import { useDrag } from '@use-gesture/react';
import { IoCloseSharp } from 'react-icons/io5';
import { useStore } from '../../store';
import { useUiPrefsStore } from '../../store/uiPrefs';
import { IconButton } from '../common/IconButton';
import { MidiMonitorContent } from './MidiMonitor';
import styles from './FloatingMidiPanel.module.css';

const PANEL_EDGE_GUTTER = 16;

export function FloatingMidiPanel() {
  const open = useStore((s) => s.midiPanelOpen);
  const setOpen = useStore((s) => s.setMidiPanelOpen);
  const storedPos = useUiPrefsStore((s) => s.midiPanelPosition);
  const setPos = useUiPrefsStore((s) => s.setMidiPanelPosition);

  const panelRef = useRef<HTMLDivElement | null>(null);

  // Clamp stored position so the panel can never sit outside the
  // visible parent (e.g. when the saved position came from a larger
  // window or a different layout). Reserves PANEL_EDGE_GUTTER on every
  // side. Runs on open AND on subsequent window resizes — without the
  // on-open clamp, a smaller WebView between sessions could leave the
  // panel completely offscreen with no titlebar to drag it back.
  const clampStoredPos = useCallback(() => {
    if (!storedPos) return;
    const parent = panelRef.current?.parentElement;
    const panelEl = panelRef.current;
    if (!parent || !panelEl) return;
    const maxX = parent.clientWidth - panelEl.offsetWidth - PANEL_EDGE_GUTTER;
    const maxY = parent.clientHeight - panelEl.offsetHeight - PANEL_EDGE_GUTTER;
    const nx = Math.max(PANEL_EDGE_GUTTER, Math.min(storedPos.x, Math.max(PANEL_EDGE_GUTTER, maxX)));
    const ny = Math.max(PANEL_EDGE_GUTTER, Math.min(storedPos.y, Math.max(PANEL_EDGE_GUTTER, maxY)));
    if (nx !== storedPos.x || ny !== storedPos.y) setPos({ x: nx, y: ny });
  }, [storedPos, setPos]);

  useEffect(() => {
    if (!open || !storedPos) return undefined;
    // RAF to ensure the panel has rendered + measured itself before we
    // read offsetWidth / offsetHeight on first open.
    const id = requestAnimationFrame(clampStoredPos);
    window.addEventListener('resize', clampStoredPos);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', clampStoredPos);
    };
  }, [open, storedPos, clampStoredPos]);

  const getBounds = useCallback(() => {
    const parent = panelRef.current?.parentElement;
    const panelEl = panelRef.current;
    if (!parent || !panelEl) return { left: 0, top: 0, right: 0, bottom: 0 };
    return {
      left: PANEL_EDGE_GUTTER,
      top: PANEL_EDGE_GUTTER,
      right: Math.max(
        PANEL_EDGE_GUTTER,
        parent.clientWidth - panelEl.offsetWidth - PANEL_EDGE_GUTTER,
      ),
      bottom: Math.max(
        PANEL_EDGE_GUTTER,
        parent.clientHeight - panelEl.offsetHeight - PANEL_EDGE_GUTTER,
      ),
    };
  }, []);

  const bindDrag = useDrag(
    ({ offset: [x, y] }) => {
      setPos({ x, y });
    },
    {
      from: () => {
        const pos = useUiPrefsStore.getState().midiPanelPosition;
        if (pos) return [pos.x, pos.y];
        // Default top-left so it doesn't collide with the right-anchored
        // OptionsPanel default. Stored position wins once the user drags.
        return [PANEL_EDGE_GUTTER, PANEL_EDGE_GUTTER];
      },
      bounds: getBounds,
      filterTaps: true,
      pointer: { capture: false },
    },
  );

  if (!open) return null;

  const inlineStyle: React.CSSProperties = storedPos
    ? { left: `${storedPos.x}px`, top: `${storedPos.y}px` }
    : { left: `${PANEL_EDGE_GUTTER}px`, top: `${PANEL_EDGE_GUTTER}px` };

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
