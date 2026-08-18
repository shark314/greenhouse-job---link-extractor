import JSZip from "jszip";
import { EXTENSION_FILES } from "./scriptGenerators";

/**
 * Creates a downloadable .zip package containing all Chrome Extension files (Manifest V3)
 * with icons, manifest, content script, and documentation.
 */
export async function downloadExtensionZip() {
  const zip = new JSZip();

  // Add primary extension code files
  zip.file("manifest.json", EXTENSION_FILES.manifest);
  zip.file("content.js", EXTENSION_FILES.contentScript);
  zip.file("styles.css", EXTENSION_FILES.stylesCss);
  zip.file("popup.html", EXTENSION_FILES.popupHtml);
  zip.file("popup.js", EXTENSION_FILES.popupJs);

  // Add README with clear 30-second install guide
  zip.file(
    "README.md",
    `# Greenhouse Job & Link Auto-Extractor Extension (Manifest V3)
Zero Sidebar Conflicts • Automatic URL Parsing • Direct API & Wayback Fallback

## 🚀 How to Install in 30 Seconds (Google Chrome, Edge, Brave):

1. Unzip/Extract this folder onto your computer (e.g. into a folder called \`greenhouse-extension\`).
2. Open Google Chrome (or Edge / Brave) and go to:
   \`chrome://extensions\`
3. In the top-right corner, turn ON **"Developer mode"**.
4. In the top-left corner, click **"Load unpacked"**.
5. Select the unzipped \`greenhouse-extension\` folder.

## ✨ How it works:
- **Zero Input Required**: Open any Greenhouse job link (e.g. \`job-boards.greenhouse.io/synack/jobs/8023991\`). The extension reads the company board and job ID directly from the URL automatically.
- **NO Extension Sidebar**: Does NOT use or clash with your existing sidebar extensions. Displays as a sleek in-page floating banner / center overlay directly inside the webpage.
- **Auto-Recovery**: If a job was unlisted or expired (causing Greenhouse to redirect or 404), the extension automatically queries the Wayback Machine archive and pulls the description & application links!
`
  );

  // Generate PNG icons using offscreen canvas
  try {
    const icon16 = generateIconDataUrl(16);
    const icon48 = generateIconDataUrl(48);
    const icon128 = generateIconDataUrl(128);

    const base64ToBinary = (dataUrl: string) => {
      const base64 = dataUrl.split(",")[1];
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    };

    if (icon16) zip.file("icon16.png", base64ToBinary(icon16));
    if (icon48) zip.file("icon48.png", base64ToBinary(icon48));
    if (icon128) zip.file("icon128.png", base64ToBinary(icon128));
  } catch (err) {
    console.warn("Could not generate canvas icon, continuing without binary icons", err);
  }

  // Generate and trigger download
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "greenhouse-auto-extractor-extension.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateIconDataUrl(size: number): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background rounded circle/square
  ctx.fillStyle = "#2563EB"; // Blue 600
  ctx.beginPath();
  const radius = size * 0.25;
  ctx.roundRect(0, 0, size, size, radius);
  ctx.fill();

  // Draw bolt / link symbol
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${Math.floor(size * 0.6)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⚡", size / 2, size / 2 + size * 0.04);

  return canvas.toDataURL("image/png");
}
