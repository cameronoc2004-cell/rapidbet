import sharp from "sharp";
import { writeFileSync } from "node:fs";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="g" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#16C784"/>
      <stop offset="38%" stop-color="#0E9E68"/>
      <stop offset="78%" stop-color="#0A0C0B"/>
      <stop offset="100%" stop-color="#0A0C0B"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <text x="512" y="690" font-family="-apple-system, Helvetica, Arial, sans-serif"
        font-size="700" font-weight="900" letter-spacing="-30"
        fill="#F2F5F3" text-anchor="middle">R</text>
</svg>`;

// App Store rejects icons with an alpha channel — flatten to opaque RGB.
const png = await sharp(Buffer.from(svg))
  .flatten({ background: "#0A0C0B" })
  .png()
  .toBuffer();
writeFileSync("assets/icon.png", png);
writeFileSync("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", png);
console.log("wrote", png.length, "bytes");
