"use client";

import { Copy, Printer } from "lucide-react";
import { useState } from "react";
import { Button } from "../../ui";

export default function ReadinessReportActions({
  copyLabel,
  copiedLabel,
  printLabel,
  summary
}: {
  copyLabel: string;
  copiedLabel: string;
  printLabel: string;
  summary: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copySummary() {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <Button icon={<Printer />} onClick={() => window.print()} size="sm">
        {printLabel}
      </Button>
      <Button icon={<Copy />} onClick={copySummary} size="sm">
        {copied ? copiedLabel : copyLabel}
      </Button>
    </>
  );
}
