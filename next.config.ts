import type { NextConfig } from "next";
import { readLegalConfig } from "./lib/legal/legalEnv";

// Fail `next build` / `next dev` early if any legal page value is missing.
// The legal pages render per request (the root layout reads the session),
// so without this check a missing var would only surface at runtime.
readLegalConfig(process.env);

const LEGAL_CONTENT_GLOB = "./content/legal/**/*";

const nextConfig: NextConfig = {
  // The legal pages read their markdown with fs at request time, so make sure
  // the files are bundled into the serverless function on Netlify.
  outputFileTracingIncludes: {
    "/legal/*": [LEGAL_CONTENT_GLOB],
    "/security": [LEGAL_CONTENT_GLOB],
  },
};

export default nextConfig;
