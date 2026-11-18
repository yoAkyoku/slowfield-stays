import { cx } from "./cx";

/**
 * The on/off toggle of the block editors. The editors each wrote this button
 * out by hand, and five of the ten copies had no aria-checked, so a screen
 * reader heard a nameless button with no state. One element now, always a
 * role="switch" that says whether it is on.
 *
 * `label` is the accessible name; the visible text sits beside the switch in
 * the row that holds it.
 */
export function Switch({ checked, onChange, label, className }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cx("hpb-switch", checked && "is-on", className)}
      onClick={() => onChange(!checked)}
    />
  );
}
