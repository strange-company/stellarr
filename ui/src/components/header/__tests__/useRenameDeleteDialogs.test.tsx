import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRenameDeleteDialogs } from '../useRenameDeleteDialogs';

const names = ['Acme Lead Tone', 'Clean Combo'];
const getName = (i: number) => (i >= 0 && i < names.length ? names[i] : '');

function setup() {
  const onRename = vi.fn();
  const onDelete = vi.fn();
  const { result } = renderHook(() => useRenameDeleteDialogs({ getName, onRename, onDelete }));
  return { result, onRename, onDelete };
}

describe('useRenameDeleteDialogs', () => {
  it('starts closed', () => {
    const { result } = setup();
    expect(result.current.renameOpen).toBe(false);
    expect(result.current.deleteOpen).toBe(false);
  });

  it('startRename opens the rename dialog prefilled with the current name', () => {
    const { result } = setup();
    act(() => result.current.startRename(1));
    expect(result.current.renameOpen).toBe(true);
    expect(result.current.renameValue).toBe('Clean Combo');
  });

  it('submitRename commits the trimmed value and closes the dialog', () => {
    const { result, onRename } = setup();
    act(() => result.current.startRename(0));
    act(() => result.current.setRenameValue('  New Name  '));
    act(() => result.current.submitRename());
    expect(onRename).toHaveBeenCalledWith(0, 'New Name');
    expect(result.current.renameOpen).toBe(false);
  });

  it('submitRename is a no-op when the trimmed value is empty', () => {
    const { result, onRename } = setup();
    act(() => result.current.startRename(0));
    act(() => result.current.setRenameValue('   '));
    act(() => result.current.submitRename());
    expect(onRename).not.toHaveBeenCalled();
    // Still closes — matches the prior copy-pasted behaviour in PresetBrowser.
    expect(result.current.renameOpen).toBe(false);
  });

  it('startDelete opens the delete dialog and resolves deleteName from the index', () => {
    const { result } = setup();
    act(() => result.current.startDelete(1));
    expect(result.current.deleteOpen).toBe(true);
    expect(result.current.deleteName).toBe('Clean Combo');
  });

  it('confirmDelete invokes onDelete with the deleting index and closes the dialog', () => {
    const { result, onDelete } = setup();
    act(() => result.current.startDelete(1));
    act(() => result.current.confirmDelete());
    expect(onDelete).toHaveBeenCalledWith(1);
    expect(result.current.deleteOpen).toBe(false);
  });

  it('deleteName is empty for an out-of-range index, per the caller-provided bounds check', () => {
    const { result } = setup();
    act(() => result.current.startDelete(99));
    expect(result.current.deleteName).toBe('');
  });
});
