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
            "radial-gradient(circle at 50% 35%, #E4B13C 0%, #C8941F 38%, #16191D 78%)",
          color: "#FAFAFA",
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
