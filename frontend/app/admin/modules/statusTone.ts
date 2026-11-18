import type { Tone } from "../ui";

/**
 * The badge colour for a record's status, everywhere in the admin.
 *
 * Inquiries and CMS entries had one table (StatusBadge) and newsletter
 * campaigns and subscribers another (nlStatusTone), each drawn with its own
 * badge markup. One table now, drawn with the kit Badge.
 */
const TONES: Record<string, Tone> = {
  // records
  new: "warning",
  review: "warning",
  contacted: "info",
  quoted: "success",
  published: "success",
  draft: "neutral",
  archived: "neutral",
  closed: "neutral",
  deleted: "neutral",
  // newsletter
  sent: "success",
  subscribed: "success",
  queued: "info",
  scheduled: "brand",
  sending: "warning",
  failed: "danger",
};

export function statusTone(status: string): Tone {
  return TONES[status] ?? "neutral";
}
