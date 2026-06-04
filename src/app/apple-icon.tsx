import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon. Apple ignores transparency, so render the canvas
// color edge-to-edge. Apple also applies its own rounded-corner mask on the
// home screen — no need to pre-round.
export default function AppleIcon() {
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
          fontSize: 116,
          fontWeight: 800,
          letterSpacing: -6,
        }}
      >
        R
      </div>
    ),
    { ...size },
  );
}
