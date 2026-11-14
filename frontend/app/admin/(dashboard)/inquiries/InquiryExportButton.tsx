"use client";

import { Download } from "lucide-react";
import type { AdminInquiry } from "../../modules/adminApi";
import { Button } from "../../ui";

/** A row of the merged 表單聯絡 list: an enquiry or a booking request. */
type ExportRow = AdminInquiry & { kind?: "inquiry" | "booking"; room_type?: string };

function escapeCsv(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `\t${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export default function InquiryExportButton({
  label,
  rows
}: {
  label: string;
  rows: ExportRow[];
}) {
  function download() {
    /* `kind` first, and not optional: the two inboxes were merged into one
       list, and their ids come from different tables — both starting at 1. A
       CSV without this column silently mixes a booking #7 with an enquiry #7
       and nothing downstream can tell them apart. */
    const headers = [
      "kind",
      "id",
      "name",
      "email",
      "phone",
      "line_id",
      "stay_id",
      "check_in",
      "check_out",
      "guests",
      "status",
      "source",
      "room_type",
      "subject",
      "message",
      "created_at"
    ];
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((key) => escapeCsv(row[key as keyof ExportRow]))
          .join(",")
      )
    ].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `form-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Button icon={<Download />} onClick={download} size="sm" variant="primary">
      {label}
    </Button>
  );
}
