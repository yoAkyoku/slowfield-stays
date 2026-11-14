"use client";

/**
 * Shared primitives for the block config editors.
 *
 * The homepage editor and the site page editor each grew their own identical
 * copies of these, which is how their block forms drifted apart: a field added
 * to one never reached the other. They live here now so both import the same
 * ones, and so the block forms themselves can be shared next.
 */

// getVal/setVal live in a plain .ts module so their legacy-migration rule can be
// unit tested; every importer still reaches them through here.
export { getVal, setVal, legacyValueLocale, type FieldLocale } from "./localizedValue";

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--muted)",
};

export function FieldLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return <span id={id} style={labelStyle}>{children}</span>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  );
}

/**
 * A heading field that can actually hold a line break.
 *
 * Headings were authored in `<input type="text">`, which cannot contain a
 * newline at all — pressing Enter submits the form instead of breaking the
 * line. So "the block heading will not wrap where I want it to" was only half a
 * styling problem: the render side needed `white-space: pre-line`, but the
 * editor side offered no way to type the break in the first place. Making these
 * textareas is the half that was missing.
 *
 * It stays visually an input — one row until a second line exists, then it
 * grows rather than turning into a scrolling box, so a two-line heading is
 * fully readable while editing. Capped at four rows so a body of text pasted in
 * by mistake cannot push the rest of the panel off screen.
 */
export function HeadingInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const rows = Math.min(4, Math.max(1, value.split("\n").length));
  return (
    <textarea
      className="admin-heading-input"
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
