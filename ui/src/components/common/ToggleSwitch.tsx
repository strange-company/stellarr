import styles from './ToggleSwitch.module.css';

interface Props {
  enabled: boolean;
  onToggle: () => void;
  title?: string;
  /** Sharp-edged variant — matches the floating Options panel's sharp theme. */
  sharp?: boolean;
}

export function ToggleSwitch({ enabled, onToggle, title, sharp }: Props) {
  const cls = [styles.toggle, enabled && styles.enabled, sharp && styles.sharp]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      onClick={onToggle}
      title={title}
      aria-label={title}
      role="switch"
      aria-checked={enabled}
      className={cls}
    >
      <div className={styles.thumb} />
    </button>
  );
}
