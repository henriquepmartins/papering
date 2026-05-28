import type { NextConfig } from "next";

const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  // Hide the "N" floating badge — Tauri panel is the chrome.
  devIndicators: false,
  // Tauri serves frontendDist via custom protocol; no asset prefix needed.
};

export default config;
