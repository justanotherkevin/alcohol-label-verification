import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['tesseract.js'],
  // tesseract.js spawns its OCR work in a worker_threads worker, loaded from
  // an absolute path computed at runtime (src/worker/node/defaultOptions.js).
  // Next's build-time file tracer can't follow that dynamic path, so on
  // Vercel the worker script's own dependencies (worker-script/index.js,
  // getCore.js, gunzip.js, cache.js) are silently missing from the deployed
  // function, causing `Cannot find module '..'` at runtime. Force-include them.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/tesseract.js/src/**/*",
      "./node_modules/bmp-js/**/*",
      "./node_modules/node-fetch/**/*",
      "./node_modules/zlibjs/**/*",
      "./node_modules/wasm-feature-detect/**/*",
      "./node_modules/tesseract.js-core/**/*",
    ],
  },
};

export default nextConfig;
