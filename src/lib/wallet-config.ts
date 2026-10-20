/**
 * Configuración personalizable de las tarjetas de Apple Wallet y Google Wallet.
 * Se persiste en `businesses.wallet_config` (JSONB). Los colores viven en las
 * columnas existentes (primary_color, card_text_color, card_accent_color).
 * Este módulo es seguro tanto para cliente como para servidor.
 */

export type BarcodeFormat = 'QR' | 'PDF417' | 'AZTEC';

export type WalletConfig = {
  /** Apple `logoText` / Google `issuerName`. Vacío = nombre del negocio. */
  issuerName: string;
  /** URL pública https del logo. Vacío = logo principal del negocio. */
  logoUrl: string;
  /** Apple `stripImage` / Google `heroImage`. */
  bannerEnabled: boolean;
  bannerUrl: string;
  /** Campo principal. Admite {nombre}. */
  headline: string;
  /** Texto de recompensa. Admite {proximo_premio}. */
  rewardText: string;
  barcodeFormat: BarcodeFormat;
  /** Texto bajo el código. Admite {id}. */
  barcodeAltText: string;
};

export const defaultWalletConfig: WalletConfig = {
  issuerName: '',
  logoUrl: '',
  bannerEnabled: false,
  bannerUrl: '',
  headline: '¡Hola, {nombre}!',
  rewardText: '{proximo_premio}',
  barcodeFormat: 'QR',
  barcodeAltText: '{id}',
};

export const BARCODE_FORMATS: BarcodeFormat[] = ['QR', 'PDF417', 'AZTEC'];

export const WALLET_LIMITS = { issuerName: 60, headline: 60, rewardText: 80, barcodeAltText: 40, url: 500 } as const;

/** Resoluciones recomendadas para el banner. */
export const BANNER_SIZES = { apple: '1125 × 432 px', google: '1032 × 336 px' } as const;

export function isHttpsUrl(value: string): boolean {
  if (!value || value.length > WALLET_LIMITS.url) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

const text = (value: unknown, max: number, fallback: string) =>
  typeof value === 'string' ? value.trim().slice(0, max) : fallback;

/** Valida y normaliza cualquier valor (p. ej. JSON de la DB o del formulario). */
export function sanitizeWalletConfig(raw: unknown): WalletConfig {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const d = defaultWalletConfig;
  const url = (value: unknown) => { const v = text(value, WALLET_LIMITS.url, ''); return isHttpsUrl(v) ? v : ''; };
  return {
    issuerName: text(source.issuerName, WALLET_LIMITS.issuerName, d.issuerName),
    logoUrl: url(source.logoUrl),
    bannerEnabled: source.bannerEnabled === true,
    bannerUrl: url(source.bannerUrl),
    headline: 'headline' in source ? text(source.headline, WALLET_LIMITS.headline, d.headline) : d.headline,
    rewardText: 'rewardText' in source ? text(source.rewardText, WALLET_LIMITS.rewardText, d.rewardText) : d.rewardText,
    barcodeFormat: BARCODE_FORMATS.includes(source.barcodeFormat as BarcodeFormat) ? source.barcodeFormat as BarcodeFormat : d.barcodeFormat,
    barcodeAltText: 'barcodeAltText' in source ? text(source.barcodeAltText, WALLET_LIMITS.barcodeAltText, d.barcodeAltText) : d.barcodeAltText,
  };
}

/** Reemplaza {nombre}, {proximo_premio}, {id}. Variables desconocidas se dejan intactas. */
export function resolveWalletText(template: string, vars: { nombre?: string; proximo_premio?: string; id?: string }): string {
  return template.replace(/\{(nombre|proximo_premio|id)\}/g, (_, key: 'nombre' | 'proximo_premio' | 'id') => vars[key] ?? '');
}

export const appleBarcodeFormat = (format: BarcodeFormat) =>
  ({ QR: 'PKBarcodeFormatQR', PDF417: 'PKBarcodeFormatPDF417', AZTEC: 'PKBarcodeFormatAztec' } as const)[format];

export const googleBarcodeType = (format: BarcodeFormat) =>
  ({ QR: 'QR_CODE', PDF417: 'PDF_417', AZTEC: 'AZTEC' } as const)[format];
