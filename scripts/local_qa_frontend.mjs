// Separate dev output prevents the volume-fixture server from corrupting the
// ongoing interactive QA server's .next files. Loopback only, no deployment.
import next from "../frontend/node_modules/next/dist/server/next.js";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import config from "../frontend/next.config.mjs";

const internalApiUrl = process.env.INTERNAL_API_URL;
if (!internalApiUrl) {
  throw new Error("Set INTERNAL_API_URL to the isolated loopback QA API before starting this frontend.");
}
const parsedApiUrl = new URL(internalApiUrl);
if (
  parsedApiUrl.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(parsedApiUrl.hostname) ||
  parsedApiUrl.pathname.replace(/\/+$/, "") !== "/api/v1" ||
  parsedApiUrl.username ||
  parsedApiUrl.password ||
  parsedApiUrl.search ||
  parsedApiUrl.hash
) {
  throw new Error("The local QA frontend accepts only an http://localhost or http://127.0.0.1 /api/v1 endpoint.");
}
process.env.INTERNAL_API_URL = `${parsedApiUrl.origin}${parsedApiUrl.pathname.replace(/\/+$/, "")}`;
// Browser requests stay same-origin and are proxied by Next to the isolated API.
// This keeps QA independent of host port-forwarding and never falls back to production.
process.env.NEXT_PUBLIC_API_URL = "/api/v1";

const port = Number(process.env.LOCAL_QA_FRONTEND_PORT || 3324);
const app = next({
  hostname: "127.0.0.1",
  port,
  dev: true,
  dir: fileURLToPath(new URL("../frontend", import.meta.url)),
  conf: { ...config, distDir: process.env.LOCAL_QA_DIST_DIR || ".next-qa-variants" },
});
await app.prepare();
createServer(app.getRequestHandler()).listen(port, "127.0.0.1");
