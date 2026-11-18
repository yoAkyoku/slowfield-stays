import type { Tone } from "../../ui";
import { statusTone } from "../../modules/statusTone";

/** Badge tone for a campaign or subscriber status — the admin-wide table. */
export function nlStatusTone(status: string): Tone {
  return statusTone(status);
}
