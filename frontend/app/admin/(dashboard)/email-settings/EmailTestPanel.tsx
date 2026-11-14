"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { testEmailSettingsResult } from "../../modules/emailActions";
import { flashMessage } from "../../modules/flashMessage";
import type { AdminResult } from "../../modules/adminRequest";
import { Button, Callout, Card, Input, Stack, Toolbar } from "../../ui";

export default function EmailTestPanel({ title, help, sendLabel, zh }: { title: string; help: string; sendLabel: string; zh: boolean }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AdminResult | null>(null);
  return <Card title={title} description={help}>
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (pending) return;
      const data = new FormData(event.currentTarget);
      setPending(true);
      setResult(null);
      try { setResult(await testEmailSettingsResult(data)); }
      catch { setResult({ ok: false, message: zh ? "連線失敗，請稍後再試。" : "Connection failed. Please try again." }); }
      finally { setPending(false); }
    }}>
      <Stack gap="sm">
        <Toolbar>
          <Input name="to_email" type="email" placeholder="owner@example.com" aria-label={zh ? "測試信收件地址" : "Test recipient"} required disabled={pending} style={{ flex: "1 1 260px", maxWidth: 420 }} />
          <Button disabled={pending} icon={<Send />} type="submit">{pending ? (zh ? "寄送中…" : "Sending…") : sendLabel}</Button>
        </Toolbar>
        {result && (
          <Callout live={result.ok ? "status" : "alert"} tone={result.ok ? "success" : "danger"} title={result.ok ? (zh ? "測試信已寄出" : "Test email sent") : (zh ? "測試信未寄出" : "Test email not sent")}>
            {!result.ok ? flashMessage(result.message, zh) : null}
          </Callout>
        )}
      </Stack>
    </form>
  </Card>;
}
