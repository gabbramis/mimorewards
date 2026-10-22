import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PKPass } from "passkit-generator";
import sharp from "sharp";

import crypto from "node:crypto";
import { appleBarcodeFormat, resolveWalletText, sanitizeWalletConfig, type WalletConfig } from "@/lib/wallet-config";

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
  logoImage?: Buffer | null;
  completedStampImage?: Buffer | null;
  pendingStampImage?: Buffer | null;
  webServiceURL?: string;
  authenticationToken?: string;
  activeCampaignMessage?: string | null;
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
  const secret = process.env.WALLET_AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "mimo-apple-wallet-auth-key";
  return crypto.createHmac("sha256", secret).update(cardId).digest("hex");
}

export function verifyPassAuthToken(cardId: string, token: string): boolean {
  if (!token || !cardId) return false;
  const expected = generatePassAuthToken(cardId);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function certificate(envName: string, fileName: string): Buffer {
  const envVal = process.env[envName] || process.env[`${envName}_BASE64`];
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
    (process.env.APPLE_WWDR_CERT || process.env.APPLE_WALLET_WWDR_CERT_BASE64) &&
    (process.env.APPLE_SIGNER_CERT || process.env.APPLE_WALLET_SIGNER_CERT_BASE64) &&
    (process.env.APPLE_PRIVATE_KEY || process.env.APPLE_WALLET_SIGNER_KEY_BASE64)
  ) {
    return true;
  }

  const requiredFiles = ["signerCert.pem", "mimo-wallet-private-key.pem", "wwdrg4.pem"];
  const hasInCerts = requiredFiles.every((fileName) => existsSync(join(process.cwd(), "certs", fileName)));
  if (hasInCerts) return true;

  return requiredFiles.every((fileName) => existsSync(join(process.cwd(), ".secrets", "apple-wallet", fileName)));
}

async function stripImages(card: AppleCard, banner?: Buffer | null) {
  const canvas = createCanvas(1125, 432);
  const context = canvas.getContext("2d");
  if (banner) {
    try {
      const image = await loadImage(await sharp(banner).resize(1125, 432, { fit: "cover" }).png().toBuffer());
      context.drawImage(image, 0, 0, 1125, 432);
    } catch (error) {
      console.warn("[Apple Wallet] Banner inválido, se omite:", error);
    }
  }
  const target = Math.min(15, Math.max(1, card.targetStamps));
  const progress = Math.min(target, Math.max(0, card.currentStamps));
  const columns = Math.ceil(target / 2);
  const completed = card.completedStampImage ? await loadImage(card.completedStampImage) : null;
  const pending = card.pendingStampImage ? await loadImage(card.pendingStampImage) : null;
  const step = Math.min(180, 1000 / Math.max(1, columns - 1));
  const size = Math.min(116, step * .75);
  const startX = (1125 - (columns - 1) * step) / 2;

  for (let index = 0; index < target; index++) {
    const x = startX + (index % columns) * step;
    const y = 260 + Math.floor(index / columns) * 105;
    const image = index < progress ? completed : pending;
    if (image) {
      const scale = Math.min(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, x - width / 2, y - height / 2, width, height);
    } else {
      context.beginPath();
      context.arc(x, y, size * .34, 0, Math.PI * 2);
      context.lineWidth = 8;
      context.strokeStyle = walletColor(card.textColor || "#FFFFFF");
      context.globalAlpha = index < progress ? .95 : .38;
      if (index < progress) {
        context.fillStyle = walletColor(card.textColor || "#FFFFFF");
        context.fill();
      } else context.stroke();
      context.globalAlpha = 1;
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
  const altText = resolveWalletText(wallet.barcodeAltText, { id: card.customerCode });
  const stampsField = { key: "stamps", label: "SELLOS", value: `${card.currentStamps} / ${card.targetStamps}`, changeMessage: "¡Sumaste un sello! Llevás %@ acumulados." };
  const logoImages = logoSource ? {
    "logo.png": await sharp(logoSource).resize(160, 50, { fit: "contain", background: "#00000000" }).png().toBuffer(),
    "logo@2x.png": await sharp(logoSource).resize(320, 100, { fit: "contain", background: "#00000000" }).png().toBuffer(),
  } : {};
  const baseUrl = (process.env.NEXT_PUBLIC_MIMO_SITE_URL || "https://mimorewards.com").replace(/\/$/, "");
  const webServiceURL = card.webServiceURL || `${baseUrl}/api/apple-wallet`;
  const authenticationToken = card.authenticationToken || generatePassAuthToken(card.id);

  const pass = new PKPass(
    {
      "icon.png": icon(29),
      "icon@2x.png": icon(58),
      ...logoImages,
      ...await stripImages(card, bannerImage),
      "pass.json": Buffer.from(JSON.stringify({
        formatVersion: 1,
        passTypeIdentifier: PASS_TYPE_ID,
        teamIdentifier: TEAM_ID,
        serialNumber: card.id,
        webServiceURL,
        authenticationToken,
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
              key: "latest_notification",
              label: "Novedades",
              value: card.activeCampaignMessage || "Programa de beneficios activo",
              changeMessage: "%@",
            },
            {
              key: "about",
              label: "Acerca de esta tarjeta",
              value: `Tarjeta de beneficios de ${card.businessName}, emitida por Mimo Rewards.`,
            },
          ],
        },
        barcodes: [{
          format: appleBarcodeFormat(wallet.barcodeFormat),
          message: card.customerCode,
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
