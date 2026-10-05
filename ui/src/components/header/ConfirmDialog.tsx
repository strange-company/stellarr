import { Button } from '../common/Button';
import { DialogShell } from '../common/DialogShell';
import styles from './ConfirmDialog.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
}: Props) {
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} title={title} variant="plain">
      <p className={styles.message}>{message}</p>
      <div className={styles.buttonRow}>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </DialogShell>
  );
}
