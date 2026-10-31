/**
 * Configuración personalizable de las tarjetas de Apple Wallet y Google Wallet.
 * Se persiste en `businesses.wallet_config` (JSONB). Los colores viven en las
 * columnas existentes (primary_color, card_text_color, card_accent_color, stamp_background_color).
 * Este módulo es seguro tanto para cliente como para servidor.
 */

export type BarcodeFormat = 'QR' | 'PDF417' | 'AZTEC';

export const ALLOWED_REWARD_TARGETS = [4, 5, 6, 8, 10] as const;
export type AllowedRewardTarget = (typeof ALLOWED_REWARD_TARGETS)[number];

export function isAllowedRewardTarget(value: number): value is AllowedRewardTarget {
  return (ALLOWED_REWARD_TARGETS as readonly number[]).includes(value);
}

export function normalizeRewardTarget(value: unknown, fallback: AllowedRewardTarget = 8): AllowedRewardTarget {
  const num = Number(value);
  if (Number.isInteger(num) && isAllowedRewardTarget(num)) return num;
  return fallback;
}

/**
 * Mapeo estricto de layout (filas × columnas) según la meta de sellos seleccionada:
 * - meta == 4: 2 filas × 2 columnas (2 arriba, 2 abajo)
 * - meta == 5: 1 fila × 5 columnas (5 alineados horizontalmente)
 * - meta == 6: 2 filas × 3 columnas (3 arriba, 3 abajo)
 * - meta == 8: 2 filas × 4 columnas (4 arriba, 4 abajo)
 * - meta == 10: 2 filas × 5 columnas (5 arriba, 5 abajo)
 */
export function getStampGridLayout(target: number): { rows: number; columns: number } {
  const safeTarget = Math.max(1, Math.round(target || 8));
  if (safeTarget === 4) return { rows: 2, columns: 2 };
  if (safeTarget === 5) return { rows: 1, columns: 5 };
  if (safeTarget === 6) return { rows: 2, columns: 3 };
  if (safeTarget === 8) return { rows: 2, columns: 4 };
  if (safeTarget === 10) return { rows: 2, columns: 5 };
  const rows = safeTarget <= 5 ? 1 : 2;
  return { rows, columns: Math.ceil(safeTarget / rows) };
}

export type WalletConfig = {
  /** Apple `logoText` / Google `issuerName`. Vacío = nombre del negocio. */
  issuerName: string;
  /** URL pública https del logo. Vacío = logo principal del negocio. */
  logoUrl: string;
  /** Apple `stripImage` / Google `heroImage`. */
  bannerEnabled: boolean;
  bannerUrl: string;
  /** Color de fondo de la franja de sellos cuando no hay imagen de banner. */
  stampBackgroundColor?: string;
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
  stampBackgroundColor: '#FF1F2D',
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

const hexColor = (value: unknown, fallback?: string): string | undefined => {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim().toUpperCase();
  }
  return fallback;
};

/** Valida y normaliza cualquier valor (p. ej. JSON de la DB o del formulario). */
export function sanitizeWalletConfig(raw: unknown): WalletConfig {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const d = defaultWalletConfig;
  const url = (value: unknown) => { const v = text(value, WALLET_LIMITS.url, ''); return isHttpsUrl(v) ? v : ''; };
  const stampBg = hexColor(source.stampBackgroundColor);
  return {
    issuerName: text(source.issuerName, WALLET_LIMITS.issuerName, d.issuerName),
    logoUrl: url(source.logoUrl),
    bannerEnabled: source.bannerEnabled === true,
    bannerUrl: url(source.bannerUrl),
    ...(stampBg ? { stampBackgroundColor: stampBg } : {}),
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
