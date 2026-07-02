import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Il venv Python (usato da /api/pdf via spawn) contiene symlink che
  // rompono il file tracing di Turbopack: va escluso dalla build.
  outputFileTracingExcludes: {
    "/*": [".venv/**/*"],
  },
};

export default nextConfig;
