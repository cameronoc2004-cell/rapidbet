import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Dynamic favicon / Android maskable icon — generated at build time via
// ImageResponse. No PNG asset required. Tight crop on the "R" wordmark on the
// canvas color, with a green gradient ring for some visual energy.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 50% 35%, #16C784 0%, #0E9E68 38%, #0A0C0B 78%)",
          color: "#F2F5F3",
          fontFamily: "system-ui, -apple-system, Inter, sans-serif",
          fontSize: 320,
          fontWeight: 800,
          letterSpacing: -16,
        }}
      >
        R
      </div>
    ),
    { ...size },
  );
}
