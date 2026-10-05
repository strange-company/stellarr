import { RenameDialog } from './RenameDialog';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  /** Row kind, e.g. `'Preset'` or `'Scene'` — derives the dialog titles
   * (`Rename ${noun}` / `Delete ${noun}`) so the shared confirm-delete
   * message template lives in one place instead of being copy-pasted per
   * dropdown. */
  noun: string;
  renameOpen: boolean;
  onRenameOpenChange: (open: boolean) => void;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onRenameSubmit: () => void;
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  /** Name of the row pending deletion, interpolated into the confirm message. */
  deleteName: string;
  onDeleteConfirm: () => void;
}

/**
 * Renders the RenameDialog + ConfirmDialog pair shared by PresetDropdown and
 * SceneDropdown in PresetBrowser. Paired with `useRenameDeleteDialogs` for
 * the state/handlers side of the same rename/delete flow.
 */
export function RenameDeleteDialogs({
  noun,
  renameOpen,
  onRenameOpenChange,
  renameValue,
  onRenameValueChange,
  onRenameSubmit,
  deleteOpen,
  onDeleteOpenChange,
  deleteName,
  onDeleteConfirm,
}: Props) {
  return (
    <>
      <RenameDialog
        open={renameOpen}
        onOpenChange={onRenameOpenChange}
        title={`Rename ${noun}`}
        value={renameValue}
        onChange={onRenameValueChange}
        onSubmit={onRenameSubmit}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={onDeleteOpenChange}
        title={`Delete ${noun}`}
        message={`Are you sure you want to delete "${deleteName}"? This cannot be undone.`}
        onConfirm={onDeleteConfirm}
      />
    </>
  );
}
