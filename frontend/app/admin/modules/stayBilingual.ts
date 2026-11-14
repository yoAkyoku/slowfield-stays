/** Preserve explicit language boundaries across save/reload, including an empty half. */
export function splitBi(value: string): { zh: string; en: string } {
  const text = value ?? "";
  if (!text.trim()) return { zh: "", en: "" };
  const separator = text.match(/\s*[·｜|]\s*/);
  if (separator?.index !== undefined) {
    return { zh: text.slice(0, separator.index), en: text.slice(separator.index + separator[0].length) };
  }
  // Legacy combined values had no explicit language separator.
  const trimmed = text.trim();
  const cjk = /[㐀-鿿豈-﫿]/g;
  let last = -1;
  let match: RegExpExecArray | null;
  while ((match = cjk.exec(trimmed)) !== null) last = match.index + 1;
  if (last <= 0) return { zh: "", en: trimmed };
  const zh = trimmed.slice(0, last).trim();
  const en = trimmed.slice(last).replace(/^[\s。，、！？：；）】」』.,!?)]+/, "").trim();
  return /[A-Za-z]/.test(en) ? { zh, en } : { zh: trimmed, en: "" };
}

export function joinBi(zh: string, en: string): string {
  const z = (zh ?? "").trim();
  const e = (en ?? "").trim();
  return z && e ? `${z} · ${e}` : z || e;
}

export function setBi(combined: string, locale: "zh" | "en", value: string): string {
  const pair = splitBi(combined);
  pair[locale] = value;
  return `${pair.zh} · ${pair.en}`;
}

export function cleanBi(value: string): string {
  const pair = splitBi(value);
  const zh = pair.zh.trim();
  const en = pair.en.trim();
  if (!zh && !en) return "";
  // Dropping the separator loses which language owned mixed Chinese/Latin
  // text. The legacy fallback would split its Latin suffix on the next load.
  return `${zh} · ${en}`;
}
