import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import styles from './DialogShell.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  /**
   * `plain` — title rendered as plain uppercase text inline in the padded
   * content column (ConfirmDialog / RenameDialog shape).
   * `titlebar` — title rendered in the canonical floating-panel titlebar bar
   * (background + bottom border), body scrolls independently below it
   * (MidiAssignDialog shape). See CLAUDE.md "Floating panel titlebar".
   */
  variant: 'plain' | 'titlebar';
  /** Forwarded to Radix Dialog.Content — used by RenameDialog to place the
   * caret at the end of the input instead of Radix's default focus/select-all. */
  onOpenAutoFocus?: (event: Event) => void;
}

/**
 * Shared modal shell (overlay + centred content box + title) for the app's
 * Radix-based dialogs (ConfirmDialog, RenameDialog, MidiAssignDialog).
 * Owns only the scaffolding; callers render their own body content.
 */
export function DialogShell({
  open,
  onOpenChange,
  title,
  children,
  variant,
  onOpenAutoFocus,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={variant === 'titlebar' ? styles.contentTitlebar : styles.contentPlain}
          onOpenAutoFocus={onOpenAutoFocus}
        >
          {variant === 'titlebar' ? (
            <>
              <div className={styles.titlebar}>
                <Dialog.Title className={styles.titlebarText}>{title}</Dialog.Title>
              </div>
              <div className={styles.body}>{children}</div>
            </>
          ) : (
            <>
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
              {children}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
