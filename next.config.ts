import type { NextConfig } from "next";
import fs from "node:fs";

// Veri sürümü: istemci JSON isteklerinde önbellek anahtarı olarak kullanılır.
function dataVersion(): string {
  try {
    const a = JSON.parse(fs.readFileSync("public/data/atlas.json", "utf8"));
    return `${(a.source?.commit ?? "yerel").slice(0, 12)}-${Date.parse(a.generatedAt).toString(36)}`;
  } catch {
    return "dev";
  }
}

const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_DATA_VERSION: dataVersion() },
};

export default config;
