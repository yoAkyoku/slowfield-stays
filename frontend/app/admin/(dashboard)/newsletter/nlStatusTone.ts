import type { Tone } from "../../ui";

/** Badge tone for a campaign or subscriber status. */
export function nlStatusTone(status: string): Tone {
  switch (status) {
    case "sent":
    case "subscribed":
      return "success";
    case "queued":
      return "info";
    case "scheduled":
      return "brand";
    case "sending":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}
