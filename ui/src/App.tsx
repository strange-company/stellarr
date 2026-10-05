import { useEffect } from 'react';
import { useStore, isTabId } from './store';
import { useSyncTheme } from './hooks/useSyncTheme';
import { useSyncUpdateBadge } from './hooks/useSyncUpdateBadge';
import { Grid } from './components/grid/Grid';
import { GridOverlay } from './components/grid/GridOverlay';
import { GridResizer } from './components/grid/GridResizer';
import { OptionsPanel } from './components/options/OptionsPanel';
import { Settings } from './components/settings/Settings';
import { Tuner } from './components/tuner/Tuner';
import { TunerPanel } from './components/tuner/TunerPanel';
import { MidiPage } from './components/midi/MidiPage';
import { MidiMonitor } from './components/midi/MidiMonitor';
import { FloatingMidiPanel } from './components/midi/FloatingMidiPanel';
import { LoadingScreen } from './components/header/LoadingScreen';
import { PresetBrowser } from './components/header/PresetBrowser';
import { Logo } from './components/header/Logo';
import { Footer } from './components/footer/Footer';
import { Tooltip } from './components/common/Tooltip';
import { IconButton } from './components/common/IconButton';
import { Tablist, Tab } from './components/common/Tablist';
import { TabBadge } from './components/common/TabBadge';
import { TbLayoutGrid, TbWaveSine, TbPlug, TbSunHigh, TbMoon, TbSettings } from 'react-icons/tb';
import { useThemeStore, resolveTheme } from './store/theme';
import {
  requestSetTunerEnabled,
  requestSaveSessionQuiet,
  requestSetMidiMonitorEnabled,
} from './bridge';
import styles from './App.module.css';

function App() {
  useSyncTheme();
  useSyncUpdateBadge();
  const loading = useStore((s) => s.loading);
  const selectBlock = useStore((s) => s.selectBlock);
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const settingsBadge = useStore((s) => s.badges.settings);
  const developerModeEnabled = useStore((s) => s.developerModeEnabled);
  const midiPanelOpen = useStore((s) => s.midiPanelOpen);
  const setMidiPanelOpen = useStore((s) => s.setMidiPanelOpen);
  const setMidiMonitorEnabled = useStore((s) => s.setMidiMonitorEnabled);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        requestSaveSessionQuiet();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // MIDI monitor enable coordinator — engine-side monitor runs only when
  // a UI surface is actively viewing it: the MIDI tab side-rail OR the
  // floating test panel while the Grid tab is visible. The floating
  // panel is mounted inside the Grid tab body, so it's not rendered
  // when the user has switched to Tuner / Settings — gate accordingly.
  useEffect(() => {
    const wantMonitor =
      activeTab === 'midi' || (activeTab === 'grid' && midiPanelOpen);
    requestSetMidiMonitorEnabled(wantMonitor);
    setMidiMonitorEnabled(wantMonitor);
  }, [activeTab, midiPanelOpen, setMidiMonitorEnabled]);

  // Auto-close the floating MIDI panel when developer mode flips off.
  // The button that opens it is dev-mode-gated, so leaving the panel open
  // would orphan it.
  useEffect(() => {
    if (!developerModeEnabled && midiPanelOpen) setMidiPanelOpen(false);
  }, [developerModeEnabled, midiPanelOpen, setMidiPanelOpen]);


  if (loading) return <LoadingScreen />;

  const handleTabChange = (tab: string) => {
    // Tablist is generic (also drives non-tab-id switches elsewhere), so its
    // onChange still hands back a bare string. The tabs rendered below are
    // always one of the known TabId literals, but guard anyway so a typo'd
    // id fails closed instead of defeating the TabId union at the store.
    if (!isTabId(tab)) return;
    setActiveTab(tab);
    requestSetTunerEnabled(tab === 'tuner');
  };

  const panelClass = (id: string) =>
    `${styles.tabContent} ${activeTab === id ? styles.tabContentVisible : ''}`;

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.brand}>
            <Logo size={22} className={styles.brandLogo} />
            <span className={styles.brandName}>Stellarr</span>
          </div>

          <Tablist
            value={activeTab}
            onChange={handleTabChange}
            aria-label="Main navigation"
            className={styles.headerTablist}
            iconOnly
          >
            <Tooltip content="Grid" side="bottom">
              <Tab id="grid" title="Grid">
                <TbLayoutGrid size={20} />
              </Tab>
            </Tooltip>
            <Tooltip content="Tuner" side="bottom">
              <Tab id="tuner" title="Tuner">
                <TbWaveSine size={20} />
              </Tab>
            </Tooltip>
            <Tooltip content="MIDI" side="bottom">
              <Tab id="midi" title="MIDI">
                <TbPlug size={20} />
              </Tab>
            </Tooltip>
            <Tooltip content="System" side="bottom">
              <Tab id="settings" title="System">
                <TbSettings size={20} />
                <TabBadge badge={settingsBadge} />
              </Tab>
            </Tooltip>
          </Tablist>
        </div>

        {/* Centre: preset browser */}
        <div className={styles.headerCenter}>
          <PresetBrowser />
        </div>

        {/* Right: theme toggle */}
        <ThemeToggle />
      </div>

      {/* Main area — all panels stay mounted; visibility toggled by activeTab */}
      <div className={styles.main}>
        <div
          role="tabpanel"
          hidden={activeTab !== 'grid'}
          className={`${panelClass('grid')} ${styles.gridPanel}`}
        >
          <GridOverlay />
          <div
            onClick={(e) => {
              // Bail when the click did not originate inside this div's DOM
              // subtree. React events bubble through the component tree, so
              // clicks inside Radix-portalled content (dialogs, dropdowns,
              // popovers) reach this handler even though the target lives in
              // <body>. Without this check the deselect would unmount the
              // options panel mid-interaction. Stays inside React's event
              // system so descendant `e.stopPropagation()` calls (e.g. on
              // grid connections) still suppress the deselect.
              const t = e.target as HTMLElement;
              if (!e.currentTarget.contains(t)) return;
              if (t.closest('[data-grid-block]') || t.closest('[data-floating-panel]')) return;
              selectBlock(null);
            }}
            className={styles.gridBody}
          >
            <div className={styles.gridArea}>
              <GridResizer>
                <Grid />
              </GridResizer>
            </div>
            <OptionsPanel />
            <FloatingMidiPanel />
          </div>
        </div>

        <div role="tabpanel" hidden={activeTab !== 'tuner'} className={panelClass('tuner')}>
          <Tuner />
          <TunerPanel />
        </div>

        <div role="tabpanel" hidden={activeTab !== 'midi'} className={panelClass('midi')}>
          <MidiPage />
          <MidiMonitor />
        </div>

        <div role="tabpanel" hidden={activeTab !== 'settings'} className={panelClass('settings')}>
          <Settings />
        </div>
      </div>

      {/* Footer: CPU / IN / OUT meters */}
      <Footer />
    </div>
  );
}

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const resolved = resolveTheme(theme);

  const flip = () => setTheme(resolved === 'dark' ? 'light' : 'dark');

  const icon = resolved === 'dark' ? <TbMoon size={18} /> : <TbSunHigh size={18} />;
  const label = resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <Tooltip content={label} side="bottom">
      <span>
        <IconButton icon={icon} onClick={flip} title={label} />
      </span>
    </Tooltip>
  );
}

export default App;
