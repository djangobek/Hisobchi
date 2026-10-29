import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hisobchi — shaxsiy moliya",
    short_name: "Hisobchi",
    description: "Daromad, xarajat va qarzlaringizni bir joyda boshqaring.",
    start_url: "/",
    scope: "/",
    // Android Chrome: avval "fullscreen", bo'lmasa "standalone" (brauzer paneli yo'q)
    display: "standalone",
    display_override: ["fullscreen", "standalone"],
    orientation: "portrait",
    background_color: "#050816",
    theme_color: "#050816",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
