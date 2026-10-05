import { useEffect, useState } from 'react';
import { DropdownMenu } from 'radix-ui';
import { TbBookmark, TbCheck, TbChevronDown, TbDots, TbLink, TbUpload } from 'react-icons/tb';
import { useStore, sceneRewireRequired } from '../../store';
import { StarLoader } from '../common/StarLoader';
import { IconButton } from '../common/IconButton';
import {
  requestNewSession,
  requestSaveSession,
  requestSaveSessionQuiet,
  requestLoadSession,
  requestLoadPresetByIndex,
  requestRenamePreset,
  requestDeletePreset,
  requestAddScene,
  requestRecallScene,
  requestRenameScene,
  requestDeleteScene,
} from '../../bridge';
import { useRenameDeleteDialogs } from './useRenameDeleteDialogs';
import { RenameDeleteDialogs } from './RenameDeleteDialogs';
import { MidiAssignDialog } from '../common/MidiAssignDialog';
import { formatMidiLabel } from '../common/constants';
import styles from './PresetBrowser.module.css';

// -- Shared trigger content for preset/scene dropdowns ------------------------

function DropdownTriggerContent({
  label,
  value,
  hasValue,
  loading = false,
}: {
  label: string;
  value: string;
  hasValue: boolean;
  loading?: boolean;
}) {
  return (
    <>
      <span className={styles.triggerLabel}>{label}</span>
      <span className={styles.triggerValue}>
        <span
          className={`${styles.triggerValueText} ${hasValue ? styles.hasValue : styles.noValue}`}
        >
          {value}
        </span>
        {loading ? (
          <StarLoader
            size={14}
            data-testid="preset-loading-spinner"
            aria-label="Loading preset"
          />
        ) : (
          <TbChevronDown size={12} className={styles.triggerChevron} />
        )}
      </span>
    </>
  );
}

// -- Menu item wrapper --------------------------------------------------------

function MenuItem({
  onSelect,
  className,
  children,
}: {
  onSelect: (e: Event) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item onSelect={onSelect} className={className ?? styles.menuItem}>
      {children}
    </DropdownMenu.Item>
  );
}

// -- Main component -----------------------------------------------------------

export function PresetBrowser() {
  const presetFiles = useStore((s) => s.presetFiles);
  const currentPresetIndex = useStore((s) => s.currentPresetIndex);
  const justSaved = useStore((s) => s.justSaved);
  const scenes = useStore((s) => s.scenes);
  const activeSceneIndex = useStore((s) => s.activeSceneIndex);
  const blocks = useStore((s) => s.blocks);
  const isLoadingPreset = useStore((s) => s.isLoadingPreset);

  const currentName =
    currentPresetIndex >= 0 && currentPresetIndex < presetFiles.length
      ? presetFiles[currentPresetIndex].replace('.stellarr', '')
      : 'Untitled';

  const currentSceneName =
    activeSceneIndex >= 0 && activeSceneIndex < scenes.length
      ? scenes[activeSceneIndex].name
      : 'No Scene';

  const mappings = useStore((s) => s.midiMappings);

  const [presetMidiOpen, setPresetMidiOpen] = useState(false);
  const presetMidiIndex = mappings.findIndex((m) => m.target === 'presetChange');
  const presetMidi = presetMidiIndex >= 0 ? mappings[presetMidiIndex] : null;

  const [sceneMidiOpen, setSceneMidiOpen] = useState(false);
  const sceneMidiIndex = mappings.findIndex((m) => m.target === 'sceneSwitch');
  const sceneMidi = sceneMidiIndex >= 0 ? mappings[sceneMidiIndex] : null;

  return (
    <div className={styles.container}>
      {/* Open */}
      <IconButton
        icon={<TbUpload />}
        onClick={requestLoadSession}
        title="Open preset"
      />

      {/* Preset dropdown + MIDI assign */}
      <div className={styles.inputGroup}>
        <PresetDropdown
          currentName={currentName}
          presetFiles={presetFiles}
          currentPresetIndex={currentPresetIndex}
          presetMidi={presetMidi}
          isLoadingPreset={isLoadingPreset}
        />
        <IconButton
          inGroup
          icon={<TbLink />}
          onClick={() => setPresetMidiOpen(true)}
          title={presetMidi ? `Preset MIDI: PC` : 'Assign MIDI Program Change to presets'}
          className={presetMidi ? styles.sceneMidiBtnAssigned : undefined}
        />
      </div>
      <span role="status" aria-live="polite" className={styles.srOnly}>
        {isLoadingPreset ? `Loading preset ${currentName}` : ''}
      </span>
      <MidiAssignDialog
        open={presetMidiOpen}
        onOpenChange={setPresetMidiOpen}
        title="MIDI — Preset Change"
        target="presetChange"
        existingIndex={presetMidiIndex >= 0 ? presetMidiIndex : undefined}
        programChange
      />

      {/* Scene dropdown + MIDI assign */}
      <div className={styles.inputGroup}>
        <SceneDropdown
          currentName={currentSceneName}
          scenes={scenes}
          activeSceneIndex={activeSceneIndex}
          sceneMidi={sceneMidi}
          blocks={blocks}
        />
        <IconButton
          inGroup
          icon={<TbLink />}
          onClick={() => setSceneMidiOpen(true)}
          title={sceneMidi ? `Scene MIDI: ${formatMidiLabel(sceneMidi)}` : 'Assign MIDI to scenes'}
          className={sceneMidi ? styles.sceneMidiBtnAssigned : undefined}
        />
      </div>
      <MidiAssignDialog
        open={sceneMidiOpen}
        onOpenChange={setSceneMidiOpen}
        title="MIDI — Scene Switch"
        target="sceneSwitch"
        existingIndex={sceneMidiIndex >= 0 ? sceneMidiIndex : undefined}
      />

      {/* Save split button */}
      <div className={styles.saveSplit}>
        <IconButton
          inGroup
          icon={
            justSaved ? (
              <TbCheck />
            ) : (
              <TbBookmark />
            )
          }
          onClick={requestSaveSessionQuiet}
          title="Save preset"
          className={justSaved ? styles.saveBtnSaved : undefined}
        />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton
              inGroup
              icon={<TbChevronDown />}
              title="Save options"
              className={styles.saveChevron}
            />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={4}
              align="end"
              className={styles.dropdownContentNarrow}
            >
              <MenuItem onSelect={requestSaveSessionQuiet}>Save</MenuItem>
              <MenuItem onSelect={requestSaveSession}>Save As...</MenuItem>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}

// -- Preset dropdown ----------------------------------------------------------

function PresetDropdown({
  currentName,
  presetFiles,
  currentPresetIndex,
  presetMidi,
  isLoadingPreset,
}: {
  currentName: string;
  presetFiles: string[];
  currentPresetIndex: number;
  presetMidi: import('../../store').MidiMapping | null;
  isLoadingPreset: boolean;
}) {
  // Control the dropdown open state so that we can veto opening while a
  // preset is loading. Radix's uncontrolled state toggles from the trigger's
  // own pointer/key handlers and only notifies via onOpenChange, so a return
  // from there alone does not actually prevent the menu from opening.
  const [menuOpen, setMenuOpen] = useState(false);
  // If a preset load is initiated externally (e.g. MIDI Program Change) while
  // the menu is already open, force it shut so the user cannot fire a second
  // load against the in-flight one.
  useEffect(() => {
    if (isLoadingPreset && menuOpen) setMenuOpen(false);
  }, [isLoadingPreset, menuOpen]);
  const {
    renameOpen,
    setRenameOpen,
    renameValue,
    setRenameValue,
    startRename,
    submitRename,
    deleteOpen,
    setDeleteOpen,
    startDelete,
    confirmDelete,
    deleteName,
  } = useRenameDeleteDialogs({
    getName: (i) =>
      i >= 0 && i < presetFiles.length ? presetFiles[i].replace('.stellarr', '') : '',
    onRename: requestRenamePreset,
    onDelete: requestDeletePreset,
  });

  return (
    <>
      <RenameDeleteDialogs
        noun="Preset"
        renameOpen={renameOpen}
        onRenameOpenChange={setRenameOpen}
        renameValue={renameValue}
        onRenameValueChange={setRenameValue}
        onRenameSubmit={submitRename}
        deleteOpen={deleteOpen}
        onDeleteOpenChange={setDeleteOpen}
        deleteName={deleteName}
        onDeleteConfirm={confirmDelete}
      />
      <DropdownMenu.Root
        open={menuOpen}
        onOpenChange={(open) => {
          // Veto open while a preset load is in flight. Pointer / keyboard
          // handlers below also short-circuit, but controlled state is the
          // ultimate gate Radix honours.
          if (isLoadingPreset && open) return;
          setMenuOpen(open);
        }}
      >
        <DropdownMenu.Trigger
          className={styles.dropdownTrigger}
          aria-disabled={isLoadingPreset || undefined}
          aria-busy={isLoadingPreset || undefined}
          data-loading={isLoadingPreset || undefined}
          onPointerDown={(e) => {
            if (isLoadingPreset) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onKeyDown={(e) => {
            if (isLoadingPreset && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onClick={(e) => {
            if (isLoadingPreset) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <DropdownTriggerContent
            label="Preset"
            value={currentName}
            hasValue={currentPresetIndex >= 0}
            loading={isLoadingPreset}
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content sideOffset={4} className={styles.dropdownContentScrollable}>
            {presetFiles.length === 0 ? (
              <div className={styles.emptyState}>No presets</div>
            ) : (
              presetFiles.map((file, i) => (
                <div key={i} className={styles.sceneRow}>
                  <MenuItem
                    onSelect={() => requestLoadPresetByIndex(i)}
                    className={
                      i === currentPresetIndex ? styles.menuItemActiveFlex : styles.menuItemFlex
                    }
                  >
                    {file.replace('.stellarr', '')}
                    {presetMidi && <span className={styles.midiTag}>PC:{i}</span>}
                  </MenuItem>
                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger className={styles.subTrigger}>
                      <TbDots size={14} />
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.SubContent sideOffset={4} className={styles.subContent}>
                        <MenuItem onSelect={() => startRename(i)}>
                          Rename
                        </MenuItem>
                        <MenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            startDelete(i);
                          }}
                          className={styles.menuItemDanger}
                        >
                          Delete
                        </MenuItem>
                      </DropdownMenu.SubContent>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Sub>
                </div>
              ))
            )}
            <DropdownMenu.Separator className={styles.separator} />
            <MenuItem onSelect={requestNewSession} className={styles.menuItemMuted}>
              + New Preset
            </MenuItem>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}

// -- Scene dropdown -----------------------------------------------------------

function SceneDropdown({
  currentName,
  scenes,
  activeSceneIndex,
  sceneMidi,
  blocks,
}: {
  currentName: string;
  scenes: import('../../store').Scene[];
  activeSceneIndex: number;
  sceneMidi: import('../../store').MidiMapping | null;
  blocks: import('../../store').GridBlock[];
}) {
  const activeScene =
    activeSceneIndex >= 0 && activeSceneIndex < scenes.length
      ? scenes[activeSceneIndex]
      : null;
  const {
    renameOpen,
    setRenameOpen,
    renameValue,
    setRenameValue,
    startRename,
    submitRename,
    deleteOpen,
    setDeleteOpen,
    startDelete,
    confirmDelete,
    deleteName,
  } = useRenameDeleteDialogs({
    getName: (i) => (i >= 0 && i < scenes.length ? scenes[i].name : ''),
    onRename: requestRenameScene,
    onDelete: requestDeleteScene,
  });

  return (
    <>
      <RenameDeleteDialogs
        noun="Scene"
        renameOpen={renameOpen}
        onRenameOpenChange={setRenameOpen}
        renameValue={renameValue}
        onRenameValueChange={setRenameValue}
        onRenameSubmit={submitRename}
        deleteOpen={deleteOpen}
        onDeleteOpenChange={setDeleteOpen}
        deleteName={deleteName}
        onDeleteConfirm={confirmDelete}
      />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className={styles.dropdownTrigger}>
          <DropdownTriggerContent
            label="Scene"
            value={currentName}
            hasValue={activeSceneIndex >= 0}
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content sideOffset={4} className={styles.dropdownContent}>
            {scenes.map((scene, i) => {
              const willRewire =
                i !== activeSceneIndex
                && activeScene !== null
                && sceneRewireRequired(activeScene, scene, blocks);

              return (
              <div key={i} className={styles.sceneRow}>
                <MenuItem
                  onSelect={() => requestRecallScene(i)}
                  className={
                    i === activeSceneIndex ? styles.menuItemActiveFlex : styles.menuItemFlex
                  }
                >
                  {scene.name}
                  {willRewire && (
                    <span
                      className={styles.rewireDot}
                      title="Switching to this scene reloads plugin parameters (brief audio dip)"
                    />
                  )}
                  {sceneMidi && (
                    <span className={styles.midiTag}>
                      {formatMidiLabel(sceneMidi)} val:{i}
                    </span>
                  )}
                </MenuItem>
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger className={styles.subTrigger}>
                    <TbDots size={14} />
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent sideOffset={4} className={styles.subContent}>
                      <MenuItem onSelect={() => startRename(i)}>
                        Rename
                      </MenuItem>
                      {scenes.length > 1 && (
                        <MenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            startDelete(i);
                          }}
                          className={styles.menuItemDanger}
                        >
                          Delete
                        </MenuItem>
                      )}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              </div>
              );
            })}

            {scenes.length > 0 && <DropdownMenu.Separator className={styles.separator} />}

            {scenes.length < 16 && (
              <MenuItem onSelect={requestAddScene} className={styles.menuItemMuted}>
                + Add Scene
              </MenuItem>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}
