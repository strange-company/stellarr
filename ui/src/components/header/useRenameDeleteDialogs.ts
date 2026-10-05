import { useState } from 'react';
import { ensureSafeBasename } from '../../utils/filename';

interface UseRenameDeleteDialogsOptions {
  /** Resolve the display name for a row index. Callers are responsible for
   * bounds-checking (returning `''` for an out-of-range index) — mirrors the
   * guarded `presetFiles[i]` / `scenes[i]` access this hook replaces. */
  getName: (index: number) => string;
  onRename: (index: number, newName: string) => void;
  onDelete: (index: number) => void;
}

/**
 * Shared rename/delete dialog state machine for PresetBrowser's Preset and
 * Scene dropdowns. Both flows are identical apart from how a row's name is
 * resolved and which bridge request fires on submit — this hook owns the
 * open/index/value state plus the handlers, leaving only that pair of
 * callbacks to the caller.
 */
export function useRenameDeleteDialogs({
  getName,
  onRename,
  onDelete,
}: UseRenameDeleteDialogsOptions) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [renamingIndex, setRenamingIndex] = useState(0);
  const [renameValue, setRenameValue] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState(0);

  const startRename = (i: number) => {
    setRenamingIndex(i);
    setRenameValue(getName(i));
    setRenameOpen(true);
  };

  const submitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      onRename(renamingIndex, ensureSafeBasename(trimmed));
    }
    setRenameOpen(false);
  };

  const startDelete = (i: number) => {
    setDeletingIndex(i);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    onDelete(deletingIndex);
    setDeleteOpen(false);
  };

  const deleteName = getName(deletingIndex);

  return {
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
  };
}
