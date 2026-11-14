import { siteDateKey } from "../../modules/datetime";

export function inquiryStageCounts(rows: ReadonlyArray<{ status?: string }>) {
  return {
    newCount: rows.filter(row => row.status === "new" || row.status === "pending").length,
    activeCount: rows.filter(row => row.status === "contacted" || row.status === "quoted").length,
    closedCount: rows.filter(row => row.status === "closed").length,
  };
}

export function inquiryCreatedDate(value?: string): string {
  return value ? siteDateKey(value) : "";
}

const sourceNames: Record<string, [string, string]> = {
  website: ["一般諮詢", "General inquiry"], phone: ["電話諮詢", "Phone inquiry"],
  email: ["Email 諮詢", "Email inquiry"], line: ["LINE 諮詢", "LINE inquiry"],
  "walk-in": ["現場來訪", "Walk-in"], booking: ["住宿詢問", "Stay inquiry"],
  franchise: ["民宿加盟", "Franchise"], pr: ["媒體公關", "Media / PR"],
  partnership: ["企劃合作", "Partnership"], career: ["人才招募", "Careers"],
  other: ["其他", "Other"],
};
export function inquirySourceLabel(source: string | undefined, locale: string, fallback: string) {
  const value = source?.trim();
  if (!value) return fallback;
  return sourceNames[value]?.[locale === "zh" ? 0 : 1] ?? value;
}
export function hasStayRequest(row: { kind?: string; source?: string; stay?: string; stay_id?: number | null; check_in?: string; check_out?: string }) {
  return row.kind === "booking" || row.source === "booking" || Boolean(row.stay?.trim() || row.stay_id || row.check_in || row.check_out);
}
