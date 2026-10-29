import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import sharp from "sharp";

// Coordinates refer to the original 1414 × 2000 artwork supplied by Mimo.
const ART_WIDTH = 1414;
const ART_HEIGHT = 2000;
const LOGO = { x: 511, y: 63, width: 425, height: 265 };
const QR = { x: 406, y: 707, size: 634 };
const CREAM = rgb(254 / 255, 249 / 255, 221 / 255);
export type CounterPosterFormat = "a4" | "a6";

type Box = { x: number; top: number; width: number; height: number };

export function counterRegistrationUrl(business: { id: string; slug?: string | null }) {
  return `https://mimorewards.com/t/${business.slug || business.id}`;
}

export function counterPosterFilename(name: string, format: CounterPosterFormat = "a4") {
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return `cartel-mimo-${slug || "comercio"}-${format}.pdf`;
}

async function drawBusinessLogo(pdf: PDFDocument, page: PDFPage, box: Box, businessName: string, bytes?: Buffer | null) {
  if (bytes) {
    const normalized = await sharp(bytes, { limitInputPixels: 16_000_000 }).rotate()
      .resize(1000, 620, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
    const logo = await pdf.embedPng(normalized);
    const bounds = logo.scaleToFit(box.width, box.height);
    page.drawImage(logo, {
      x: box.x + box.width / 2 - bounds.width / 2,
      y: page.getHeight() - box.top - box.height / 2 - bounds.height / 2,
      ...bounds,
    });
  } else {
    // A business without an uploaded logo still gets an identifiable poster.
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const name = Array.from(businessName).map(char => {
      try { font.encodeText(char); return char; } catch { return ""; }
    }).join("").trim() || "Tu local";
    const size = Math.min(24, box.width / font.widthOfTextAtSize(name, 1));
    page.drawText(name, { font, size, color: rgb(0.2, 0.02, 0.07),
      x: box.x + box.width / 2 - font.widthOfTextAtSize(name, size) / 2,
      y: page.getHeight() - box.top - box.height / 2 - size / 3 });
  }
}

function drawRegistrationQr(page: PDFPage, url: string, x: number, top: number, size: number) {
  // Generate a crisp vector QR with a four-module quiet zone on every side.
  page.drawRectangle({ x: x - 0.5, y: page.getHeight() - top - size - 0.5,
    width: size + 1, height: size + 1, color: rgb(1, 1, 1) });
  const code = QRCode.create(url, { errorCorrectionLevel: "M" });
  const quiet = 4;
  const moduleSize = size / (code.modules.size + quiet * 2);
  const qrBottom = page.getHeight() - top - size;
  for (let row = 0; row < code.modules.size; row++) {
    for (let col = 0; col < code.modules.size; col++) {
      if (!code.modules.get(row, col)) continue;
      page.drawRectangle({ x: x + (col + quiet) * moduleSize,
        y: qrBottom + (code.modules.size - row - 1 + quiet) * moduleSize,
        width: moduleSize, height: moduleSize, color: rgb(0, 0, 0) });
    }
  }
}

export async function createCounterPoster(input: {
  businessName: string;
  registrationUrl: string;
  logo?: Buffer | null;
  format?: CounterPosterFormat;
}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Sumá sellos en ${input.businessName}`);
  pdf.setAuthor("Mimo Rewards");
  const format = input.format || "a4";
  const page = pdf.addPage(format === "a6" ? [297.638, 419.528] : [595.276, 841.89]);
  const template = format === "a6"
    ? await readFile(join(process.cwd(), "src/assets/print/mimo-poster-a6.png"))
    : await readFile(join(process.cwd(), "src/assets/print/mimo-poster-a4.png"));
  const artwork = await pdf.embedPng(template);
  const logo = format === "a6" ? { x: 495, y: 95, width: 424, height: 264 } : LOGO;
  const qr = format === "a6" ? { x: 381, y: 744, size: 715 } : QR;
  const sx = page.getWidth() / ART_WIDTH;
  const sy = page.getHeight() / ART_HEIGHT;
  page.drawImage(artwork, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  page.drawRectangle({ x: (logo.x - 2) * sx, y: page.getHeight() - (logo.y + logo.height + 2) * sy,
    width: (logo.width + 4) * sx, height: (logo.height + 4) * sy, color: CREAM });
  await drawBusinessLogo(pdf, page, { x: (logo.x + 12) * sx, top: (logo.y + 12) * sy,
    width: (logo.width - 24) * sx, height: (logo.height - 24) * sy }, input.businessName, input.logo);
  drawRegistrationQr(page, input.registrationUrl, qr.x * sx, qr.y * sy, qr.size * sx);
  return pdf.save();
}
