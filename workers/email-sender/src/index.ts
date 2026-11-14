/**
 * Cloudflare Worker — transactional email sender via Email Routing.
 *
 * Backend calls POST /send with { to, subject, body } + Bearer token.
 * Worker builds a MIME message and sends it through the send_email binding.
 */

export interface Env {
  SEND_EMAIL: SendEmail;
  ALLOWED_FROM: string;
  EMAIL_API_KEY: string; // secret, set via `wrangler secret put EMAIL_API_KEY`
}

import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    // Authenticate
    const auth = request.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ") || auth.slice(7) !== env.EMAIL_API_KEY) {
      return json({ error: "Unauthorized" }, 401);
    }

    let payload: { to: string; subject: string; body: string; from_name?: string };
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const { to, subject, body, from_name } = payload;
    if (!to || !subject || !body) {
      return json({ error: "Missing required fields: to, subject, body" }, 400);
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return json({ error: "Invalid email address" }, 400);
    }

    try {
      const msg = createMimeMessage();
      const fromAddr = env.ALLOWED_FROM || "noreply@slowfield.example";
      msg.setSender({
        name: from_name || "Slowfield Stays",
        addr: fromAddr,
      });
      msg.setRecipient(to);
      msg.setSubject(subject);
      msg.addMessage({ contentType: "text/plain", data: body });

      const message = new EmailMessage(fromAddr, to, msg.asRaw());
      await env.SEND_EMAIL.send(message);

      return json({ ok: true, message: "Email sent" });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Email send failed:", errMsg);
      return json({ error: "Failed to send email", detail: errMsg }, 500);
    }
  },
};

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
