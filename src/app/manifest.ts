import type { MetadataRoute } from "next";

// PWA manifest. Next 16 serves this at /manifest.webmanifest.
//
// Icons resolved from app/icon.tsx (192/512 PNGs via ImageResponse) and
// app/apple-icon.tsx. Display "standalone" so iOS shows it without browser
// chrome once added to Home Screen — a requirement for iOS web push.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rallypot",
    short_name: "Rallypot",
    description: "Per-quarter prediction contests. Closest answer wins the pool.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#16191D",
    theme_color: "#16191D",
    categories: ["sports", "social", "games"],
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
