import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PKPass } from "passkit-generator";
import sharp from "sharp";

import crypto from "node:crypto";
import { appleBarcodeFormat, formatClientNumericId, getStampGridLayout, resolveWalletText, sanitizeWalletConfig, type WalletConfig } from "@/lib/wallet-config";
import { certificateEnvironment } from './apple-certificates';
import { applePassLocations, type WalletLocation } from './locations';
import { resolveAppleWebServiceURL } from './apple-web-service';

export const PASS_TYPE_ID = process.env.APPLE_PASS_TYPE_IDENTIFIER || "pass.com.mimorewards.loyalty";
export const TEAM_ID = process.env.APPLE_TEAM_IDENTIFIER || "K4TTF9N96K";

export type AppleCard = {
  id: string;
  customerName: string;
  customerCode: string;
  businessName: string;
  currentStamps: number;
  targetStamps: number;
  rewardDescription: string;
  primaryColor?: string | null;
  textColor?: string | null;
  accentColor?: string | null;
  stampBackgroundColor?: string | null;
  logoImage?: Buffer | null;
  completedStampImage?: Buffer | null;
  pendingStampImage?: Buffer | null;
  webServiceURL?: string;
  authenticationToken?: string;
  activeCampaignMessage?: string | null;
  locations?: WalletLocation[];
  changeMessage?: string;
  /** Configuración JSONB de `businesses.wallet_config` (se valida internamente). */
  wallet?: unknown;
};

/** Descarga una imagen pública https (máx. 2 MB). Devuelve null ante cualquier fallo. */
export async function fetchPublicImage(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/i.test(parsed.hostname)) return null;
    const response = await fetch(parsed, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length > 0 ? buffer : null;
  } catch {
    return null;
  }
}

export function generatePassAuthToken(cardId: string): string {
  const secret = process.env.WALLET_AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Falta el secreto de autenticación de Wallet.');
  return crypto.createHmac("sha256", secret).update(cardId).digest("hex");
}

export function verifyPassAuthToken(cardId: string, token: string): boolean {
  if (!token || !cardId) return false;
  const expected = generatePassAuthToken(cardId);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function certificate(envName: string, fileName: string): Buffer {
  const envVal = certificateEnvironment(envName);
  if (envVal) {
    let cleaned = envVal.trim().replace(/\\n/g, "\n");
    if (!cleaned.includes("-----BEGIN") && /^[A-Za-z0-9+/=\s]+$/.test(cleaned)) {
      return Buffer.from(cleaned, "base64");
    }
    return Buffer.from(cleaned, "utf-8");
  }

  const certsPath = join(process.cwd(), "certs", fileName);
  if (existsSync(certsPath)) return readFileSync(certsPath);

  const legacyPath = join(process.cwd(), ".secrets", "apple-wallet", fileName);
  if (existsSync(legacyPath)) return readFileSync(legacyPath);

  throw new Error(`Certificado "${fileName}" no encontrado en variables ni en certs/`);
}

export async function storedImage(supabase: any, url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const prefix = `${base}/storage/v1/object/public/logos/`;
  if (!base || !url.startsWith(prefix)) return null;
  const path = decodeURIComponent(url.slice(prefix.length));
  if (!path || path.split("/").some((part) => !part || part === ".." || part === ".")) return null;
  const { data, error } = await supabase.storage.from("logos").download(path);
  if (error || !data || data.size > 2 * 1024 * 1024) return null;
  return Buffer.from(await data.arrayBuffer());
}

function walletColor(value?: string | null) {
  const hex = /^#([\da-f]{6})$/i.test(value || "") ? value! : "#FF1F2D";
  const [red, green, blue] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return `rgb(${red}, ${green}, ${blue})`;
}

function icon(size: number) {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  const scale = size / 58;

  context.fillStyle = "#FF1F2D";
  context.fillRect(0, 0, size, size);
  context.save();
  context.scale(scale, scale);
  context.fillStyle = "#FFFFFF";
  context.beginPath();
  context.moveTo(29, 45);
  context.bezierCurveTo(23, 40, 10, 30, 10, 20);
  context.bezierCurveTo(10, 11, 21, 8, 29, 17);
  context.bezierCurveTo(37, 8, 48, 11, 48, 20);
  context.bezierCurveTo(48, 30, 35, 40, 29, 45);
  context.fill();
  context.restore();

  return canvas.toBuffer("image/png");
}

export function appleWalletConfigured() {
  if (
    certificateEnvironment('APPLE_WWDR_CERT') &&
    certificateEnvironment('APPLE_SIGNER_CERT') &&
    certificateEnvironment('APPLE_PRIVATE_KEY')
  ) {
    return true;
  }

  const requiredFiles = ["signerCert.pem", "mimo-wallet-private-key.pem", "wwdrg4.pem"];
  const hasInCerts = requiredFiles.every((fileName) => existsSync(join(process.cwd(), "certs", fileName)));
  if (hasInCerts) return true;

  return requiredFiles.every((fileName) => existsSync(join(process.cwd(), ".secrets", "apple-wallet", fileName)));
}

async function stripImages(card: AppleCard, wallet: WalletConfig, banner?: Buffer | null) {
  const canvasWidth = 1125;
  const canvasHeight = 432;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const context = canvas.getContext("2d");

  // 1. Si el comercio NO subió una imagen de banner personalizada (o falla la carga),
  // rellenar el canvas primero con el color sólido elegido (stamp_background_color, opacidad 100%).
  const stripBgColor = card.stampBackgroundColor || wallet.stampBackgroundColor || card.primaryColor || "#FF1F2D";
  context.globalAlpha = 1;
  context.fillStyle = walletColor(stripBgColor);
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  if (banner) {
    try {
      const image = await loadImage(await sharp(banner).resize(canvasWidth, canvasHeight, { fit: "cover" }).png().toBuffer());
      context.drawImage(image, 0, 0, canvasWidth, canvasHeight);
    } catch (error) {
      console.warn("[Apple Wallet] Banner inválido, se mantiene el color sólido de fondo de sellos:", error);
    }
  }

  const target = Math.min(15, Math.max(1, card.targetStamps));
  const progress = Math.min(target, Math.max(0, card.currentStamps));

  // 2. Mapeo estricto de filas y columnas idéntico al Frontend (4 -> 2x2, 5 -> 1x5, 6 -> 2x3, 8 -> 2x4, 10 -> 2x5)
  const { rows, columns } = getStampGridLayout(target);

  const completed = card.completedStampImage ? await loadImage(card.completedStampImage) : null;
  const pending = card.pendingStampImage ? await loadImage(card.pendingStampImage) : null;

  const padX = 40;
  const usableWidth = canvasWidth - padX * 2;
  const maxAvailableWidth = usableWidth / columns;
  const maxAvailableHeight = (canvasHeight - 48) / (rows === 1 ? 1 : 2.15);
  const size = Math.floor(Math.min(rows === 1 ? 148 : 136, maxAvailableWidth * 0.82, maxAvailableHeight));

  // Distribución vertical con space-evenly
  const rowGap = (canvasHeight - rows * size) / (rows + 1);

  for (let row = 0; row < rows; row++) {
    const startIdx = row * columns;
    const itemsInRow = Math.max(0, Math.min(columns, target - startIdx));
    if (itemsInRow <= 0) continue;

    // Distribución horizontal con space-evenly para cada fila
    const colGap = (usableWidth - itemsInRow * size) / (itemsInRow + 1);
    const y = rowGap + size / 2 + row * (size + rowGap);

    for (let col = 0; col < itemsInRow; col++) {
      const index = startIdx + col;
      const x = padX + colGap + size / 2 + col * (size + colGap);

      const image = index < progress ? completed : pending;
      if (image) {
        const scale = Math.min(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, x - width / 2, y - height / 2, width, height);
      } else {
        context.beginPath();
        context.arc(x, y, size * 0.38, 0, Math.PI * 2);
        context.lineWidth = 8;
        context.strokeStyle = walletColor(card.textColor || "#FFFFFF");
        context.globalAlpha = index < progress ? 0.95 : 0.38;
        if (index < progress) {
          context.fillStyle = walletColor(card.textColor || "#FFFFFF");
          context.fill();
        } else {
          context.stroke();
        }
        context.globalAlpha = 1;
      }
    }
  }

  const full = canvas.toBuffer("image/png");
  return {
    "strip.png": await sharp(full).resize(375, 144).png().toBuffer(),
    "strip@2x.png": await sharp(full).resize(750, 288).png().toBuffer(),
    "strip@3x.png": full,
  };
}

export async function createAppleWalletPass(card: AppleCard) {
  const wallet: WalletConfig = sanitizeWalletConfig(card.wallet);
  const [remoteLogo, bannerImage] = await Promise.all([
    fetchPublicImage(wallet.logoUrl),
    wallet.bannerEnabled ? fetchPublicImage(wallet.bannerUrl) : Promise.resolve(null),
  ]);
  const logoSource = remoteLogo || card.logoImage;
  const issuerName = wallet.issuerName || card.businessName;
  const firstName = card.customerName.split(" ")[0] || card.customerName;
  const headline = resolveWalletText(wallet.headline, { nombre: firstName, proximo_premio: card.rewardDescription }) || `¡Hola, ${firstName}!`;
  const rewardValue = resolveWalletText(wallet.rewardText || "{proximo_premio}", { nombre: card.customerName, proximo_premio: card.rewardDescription }) || card.rewardDescription;
  const cleanCustomerCode = formatClientNumericId(card.customerCode) || String(card.customerCode || "");
  const altText = formatClientNumericId(resolveWalletText(wallet.barcodeAltText, { id: cleanCustomerCode })) || cleanCustomerCode;
  const stampsField = {
    key: "stamps",
    label: "SELLOS",
    value: `${card.currentStamps} / ${card.targetStamps}`,
    textAlignment: "PKTextAlignmentRight",
    changeMessage: card.changeMessage || "¡Sumaste un sello! Tenés %@ sellos.",
  };

  let trimmedLogo = logoSource;
  if (logoSource) {
    try {
      trimmedLogo = await sharp(logoSource).trim().png().toBuffer();
    } catch {
      trimmedLogo = logoSource;
    }
  }

  const logoImages = trimmedLogo ? {
    "logo.png": await sharp(trimmedLogo)
      .resize(160, 160, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
    "logo@2x.png": await sharp(trimmedLogo)
      .resize(320, 320, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
  } : {};
  const webServiceURL = resolveAppleWebServiceURL(undefined, card.webServiceURL || process.env.APPLE_WALLET_WEB_SERVICE_URL);
  const authenticationToken = card.authenticationToken || generatePassAuthToken(card.id);

  const pass = new PKPass(
    {
      "icon.png": icon(29),
      "icon@2x.png": icon(58),
      ...logoImages,
      ...await stripImages(card, wallet, bannerImage),
      "pass.json": Buffer.from(JSON.stringify({
        formatVersion: 1,
        passTypeIdentifier: PASS_TYPE_ID,
        teamIdentifier: TEAM_ID,
        serialNumber: card.id,
        webServiceURL,
        authenticationToken,
        locations: applePassLocations(card.locations ?? []),
        organizationName: "Mimo Rewards",
        description: `Tarjeta de beneficios de ${card.businessName}`,
        logoText: issuerName,
        backgroundColor: walletColor(card.primaryColor),
        foregroundColor: walletColor(card.textColor || '#FFFFFF'),
        labelColor: walletColor(card.accentColor || '#FFF0F0'),
        storeCard: {
          headerFields: [stampsField],
          primaryFields: [],
          secondaryFields: [{ key: "customer", label: "CLIENTE", value: headline }],
          auxiliaryFields: [{ key: "reward", label: "RECOMPENSA", value: rewardValue }],
          backFields: [
            {
              key: "about",
              label: "Acerca de esta tarjeta",
              value: `Tarjeta de beneficios de ${card.businessName}, emitida por Mimo Rewards.`,
            },
          ],
        },
        barcodes: [{
          format: appleBarcodeFormat(wallet.barcodeFormat),
          message: cleanCustomerCode,
          messageEncoding: "iso-8859-1",
          ...(altText ? { altText } : {}),
        }],
      })),
    },
    {
      wwdr: certificate("APPLE_WWDR_CERT", "wwdrg4.pem"),
      signerCert: certificate("APPLE_SIGNER_CERT", "signerCert.pem"),
      signerKey: certificate("APPLE_PRIVATE_KEY", "mimo-wallet-private-key.pem"),
    },
  );

  return pass.getAsBuffer();
}
