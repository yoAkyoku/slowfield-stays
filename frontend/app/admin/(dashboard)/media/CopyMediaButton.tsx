"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "../../ui";

export default function CopyMediaButton({
  url,
  labels
}: {
  url: string;
  labels: { copy: string; copied: string };
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <Button icon={copied ? <Check /> : <Copy />} onClick={copy} size="sm" variant="ghost">
      {copied ? labels.copied : labels.copy}
    </Button>
  );
}
