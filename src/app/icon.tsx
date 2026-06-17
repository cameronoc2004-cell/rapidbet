import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Dynamic favicon / Android maskable icon — generated at build time via
// ImageResponse. No PNG asset required. Tight crop on the "R" wordmark on the
// canvas color, with a gold gradient ring for some visual energy.
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
            "radial-gradient(circle at 50% 35%, #E4B13C 0%, #C8941F 38%, #16191D 78%)",
          color: "#FAFAFA",
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
