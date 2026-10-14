import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { PKPass } from "passkit-generator";

const PASS_TYPE_ID = "pass.com.mimorewards.loyalty";
const TEAM_ID = "K4TTF9N96K";

type AppleCard = {
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
};

function certificate(envName: string, fileName: string) {
  const encoded = process.env[envName];
  if (encoded) return Buffer.from(encoded, "base64");

  const certsPath = join(process.cwd(), "certs", fileName);
  if (existsSync(certsPath)) return readFileSync(certsPath);

  const legacyPath = join(process.cwd(), ".secrets", "apple-wallet", fileName);
  if (existsSync(legacyPath)) return readFileSync(legacyPath);

  throw new Error(`Certificado "${fileName}" no encontrado en certs/`);
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
  if (process.env.APPLE_WALLET_SIGNER_CERT_BASE64 && process.env.APPLE_WALLET_SIGNER_KEY_BASE64 && process.env.APPLE_WALLET_WWDR_CERT_BASE64) {
    return true;
  }
  if (process.env.NODE_ENV === "production") return false;

  const requiredFiles = ["signerCert.pem", "mimo-wallet-private-key.pem", "wwdrg4.pem"];
  const hasInCerts = requiredFiles.every((fileName) => existsSync(join(process.cwd(), "certs", fileName)));
  if (hasInCerts) return true;

  return requiredFiles.every((fileName) => existsSync(join(process.cwd(), ".secrets", "apple-wallet", fileName)));
}

export function createAppleWalletPass(card: AppleCard) {
  const pass = new PKPass(
    {
      "icon.png": icon(29),
      "icon@2x.png": icon(58),
      "pass.json": Buffer.from(JSON.stringify({
        formatVersion: 1,
        passTypeIdentifier: PASS_TYPE_ID,
        teamIdentifier: TEAM_ID,
        serialNumber: card.id,
        organizationName: "Mimo Rewards",
        description: `Tarjeta de beneficios de ${card.businessName}`,
        logoText: card.businessName,
        backgroundColor: walletColor(card.primaryColor),
        foregroundColor: walletColor(card.textColor || '#FFFFFF'),
        labelColor: walletColor(card.accentColor || '#FFF0F0'),
        storeCard: {
          headerFields: [],
          primaryFields: [{ key: "stamps", label: "SELLOS", value: `${card.currentStamps} / ${card.targetStamps}` }],
          secondaryFields: [{ key: "reward", label: "RECOMPENSA", value: card.rewardDescription }],
          auxiliaryFields: [{ key: "customer", label: "CLIENTE", value: card.customerName }],
          backFields: [{ key: "about", label: "Acerca de esta tarjeta", value: `Tarjeta de beneficios de ${card.businessName}, emitida por Mimo Rewards.` }],
        },
        barcodes: [{
          format: "PKBarcodeFormatQR",
          message: card.customerCode,
          messageEncoding: "iso-8859-1",
          altText: card.customerCode,
        }],
      })),
    },
    {
      wwdr: certificate("APPLE_WALLET_WWDR_CERT_BASE64", "wwdrg4.pem"),
      signerCert: certificate("APPLE_WALLET_SIGNER_CERT_BASE64", "signerCert.pem"),
      signerKey: certificate("APPLE_WALLET_SIGNER_KEY_BASE64", "mimo-wallet-private-key.pem"),
    },
  );

  return pass.getAsBuffer();
}
