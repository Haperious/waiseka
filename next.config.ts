import type { NextConfig } from "next";
import { readLegalConfig } from "./lib/legal/legalEnv";

// Fail `next build` / `next dev` early if any legal page value is missing.
// The legal pages render per request (the root layout reads the session),
// so without this check a missing var would only surface at runtime.
readLegalConfig(process.env);

const LEGAL_CONTENT_GLOB = "./content/legal/**/*";

// Sent on every response. The CSP only sets directives that can't break the app's own
// scripts or styles (framing, <base>, form targets, plugins); a script-src policy needs
// per-request nonces from proxy.ts and is a separate change.
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No `preload`: the production domain isn't final yet, and preload is hard to undo
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Voice entry (hooks/useSpeechToText.ts) needs the microphone; nothing uses the rest
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // The legal pages read their markdown with fs at request time, so make sure
  // the files are bundled into the serverless function on Netlify.
  outputFileTracingIncludes: {
    "/legal/*": [LEGAL_CONTENT_GLOB],
    "/security": [LEGAL_CONTENT_GLOB],
  },
};

export default nextConfig;
