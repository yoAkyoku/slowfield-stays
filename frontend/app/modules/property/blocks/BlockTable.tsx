import type { Locale } from "../../i18n";
import { cfgT, pickT } from "../../tr";

export default function BlockTable({ locale, config }: { locale: Locale; config: Record<string, unknown> }) {
  const zh = locale === "zh";
  const title = cfgT(config, "title", locale, zh ? "收費須知" : "Pricing");
  const intro = cfgT(config, "intro", locale);
  const notes = cfgT(config, "notes", locale);

  // Resolve a cell that may be a plain string or a bilingual { zh, en } object.
  // Numbers are kept: a price column may hold 3200 rather than "3200".
  const cellText = (cell: unknown): string => (typeof cell === "number" ? String(cell) : pickT(cell, locale));

  let columns: Record<string, unknown>[] = Array.isArray(config.columns)
    ? (config.columns as Record<string, unknown>[])
    : [];
  let rows: unknown[][] = Array.isArray(config.rows) ? (config.rows as unknown[][]) : [];

  // Backward compat: old pricing_table format with items[]
  if (columns.length === 0 && Array.isArray(config.items)) {
    const rawItems = config.items as Array<Record<string, unknown>>;
    columns = [
      { label: { zh: "房型", en: "Room" } },
      { label: { zh: "價格", en: "Price" } },
      { label: { zh: "容量", en: "Capacity" } },
      { label: { zh: "說明", en: "Details" } },
    ];
    rows = rawItems.map((item) => [
      cfgT(item, "name", locale),
      String(item.price ?? ""),
      String(item.capacity ?? ""),
      cfgT(item, "description", locale),
    ]);
  }

  if (columns.length === 0 && rows.length === 0) return null;

  return (
    <section className="property-pricing section">
      <h2>{title}</h2>
      {intro && <p className="property-pricing-intro">{intro}</p>}
      {(columns.length > 0 || rows.length > 0) && (
        <div className="property-pricing-table">
          <table>
            {columns.length > 0 && (
              <thead>
                <tr>
                  {columns.map((col, i) => (
                    <th key={i}>{cfgT(col, "label", locale)}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{ci === 0 ? <strong>{cellText(cell)}</strong> : cellText(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {notes && (
        <div className="property-pricing-notes">
          {notes.split("\n").map((line, i) =>
            line.trim() ? <p key={i}>{line}</p> : null
          )}
        </div>
      )}
    </section>
  );
}
