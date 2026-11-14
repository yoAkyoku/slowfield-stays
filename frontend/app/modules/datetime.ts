/**
 * Dates shown in the admin, rendered in the timezone the business runs in.
 *
 * Every timestamp the API returns is a UTC instant (the columns are
 * `DateTime(timezone=True)`), so the instant was never wrong. What was wrong
 * was the display: each screen called `Intl.DateTimeFormat(undefined, …)` with
 * no `timeZone`, which formats in whatever zone the *runtime* is in. These are
 * Server Components, the container sets no `TZ`, and Node then falls back to
 * UTC — so a booking submitted at 21:46 in Taipei was shown to staff as
 * "01:46 PM". Eight hours off, on the one field they use to judge how long a
 * customer has been waiting.
 *
 * Setting `TZ` on the container would have fixed the server renders in one
 * line, but not the client ones (the send log stamps its lines in the browser),
 * and it would have made the displayed time follow the deploy environment. The
 * zone is a property of the business, so it is stated here.
 */

/** Taiwan. The office, the villas and the guests are all in one zone. */
export const SITE_TIME_ZONE = "Asia/Taipei";

export type DateLocale = "zh" | "en";

function intlLocale(locale: DateLocale | undefined) {
  // Undefined would mean "the runtime's locale", which is the same class of
  // bug as the timezone: it changes with the machine, not with the reader.
  return locale === "en" ? "en-US" : "zh-TW";
}

function parse(value: string | undefined | null): Date | null {
  if (!value) return null;
  // API timestamps denote UTC. SQLite fixtures and older serializers can omit
  // the offset; native Date would then interpret them in the viewer's zone.
  // Keep date-only values and explicitly zoned timestamps unchanged.
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)
    ? `${value}Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date and time, e.g. 2026/08/22 21:46. Falls back to the raw date part. */
export function formatDateTime(value?: string | null, locale?: DateLocale): string {
  const date = parse(value);
  if (!date) return value ? value.slice(0, 10) : "-";
  // ICU uses a narrow no-break/thin space between the date and time in some
  // Node builds while Chromium emits an ordinary space for the same locale.
  // These values are rendered by SSR and then hydrated in the browser, so
  // keep the separator deterministic across both runtimes.
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: SITE_TIME_ZONE,
  }).format(date).replace(/[\u2009\u202f\u00a0]/g, " ");
}

/** Date only, e.g. 2026/08/22. */
export function formatDate(value?: string | null, locale?: DateLocale): string {
  const date = parse(value);
  if (!date) return value ? value.slice(0, 10) : "-";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: SITE_TIME_ZONE,
  }).format(date);
}

/** Clock time only, e.g. 21:46:03 — for log lines stamped as they arrive. */
export function formatTime(value?: string | null, locale?: DateLocale): string {
  const date = parse(value) ?? new Date();
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: SITE_TIME_ZONE,
  }).format(date);
}

/**
 * The calendar day an instant falls on, in the business's timezone, as
 * YYYY-MM-DD.
 *
 * Grouping by the raw UTC date would file anything scheduled after 16:00 UTC
 * under the previous day in Taipei — i.e. most evening sends would land on the
 * wrong square of a calendar.
 */
export function siteDateKey(value: string | Date): string {
  const date = typeof value === "string" ? parse(value) : value;
  if (!date || Number.isNaN(date.getTime())) return "";
  // en-CA formats as YYYY-MM-DD, which sorts lexicographically.
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: SITE_TIME_ZONE,
  }).format(date);
}

/** Clock time only, for a calendar cell: 21:46. */
export function siteTimeOfDay(value: string | Date, locale?: DateLocale): string {
  const date = typeof value === "string" ? parse(value) : value;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: SITE_TIME_ZONE,
  }).format(date);
}
