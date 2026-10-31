"use client";

import WalletBarcode from "@/components/admin/WalletBarcode";
import { defaultWalletConfig, getStampGridLayout, resolveWalletText, type WalletConfig } from "@/lib/wallet-config";

type Props = {
  businessName: string;
  logoUrl: string | null;
  completedUrl: string | null;
  pendingUrl: string | null;
  primaryColor: string;
  textColor: string;
  accentColor: string;
  stampBackgroundColor?: string;
  currentStamps: number;
  targetStamps: number;
  rewardDescription: string;
  artworkVisible: boolean;
  wallet?: WalletConfig;
};

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';

/** Réplica de un pase storeCard de Apple Wallet (iOS PassKit). */
export default function AppleWalletPreview({
  businessName,
  logoUrl,
  completedUrl,
  pendingUrl,
  primaryColor,
  textColor,
  accentColor,
  stampBackgroundColor,
  currentStamps,
  targetStamps,
  rewardDescription,
  artworkVisible,
  wallet = defaultWalletConfig,
}: Props) {
  const target = Math.max(1, targetStamps);
  const progress = Math.min(Math.max(0, currentStamps), target);
  const { rows, columns } = getStampGridLayout(target);
  const customerName = "Sofía López";
  const code = "CLI-12345";
  const issuer = wallet.issuerName || businessName || 'Tu negocio';
  const logo = wallet.logoUrl || logoUrl;
  const headline = resolveWalletText(wallet.headline, { nombre: customerName.split(' ')[0], proximo_premio: rewardDescription });
  const reward = resolveWalletText(wallet.rewardText || '{proximo_premio}', { nombre: customerName, proximo_premio: rewardDescription || 'Tu recompensa' });
  const altText = resolveWalletText(wallet.barcodeAltText, { id: code });
  const banner = wallet.bannerEnabled && wallet.bannerUrl ? wallet.bannerUrl : null;
  const showStrip = !!banner || artworkVisible;
  const stripBgColor = stampBackgroundColor || wallet.stampBackgroundColor || primaryColor;

  return <div className="mx-auto w-full max-w-[390px] rounded-[46px] border-[7px] border-[#26282d] bg-[#26282d] p-[4px] shadow-[0_25px_70px_rgba(15,23,42,.22)]">
    <div className="relative min-h-[690px] overflow-hidden rounded-[35px] bg-[#f1f2f6] px-4 pb-8 pt-5" style={{ fontFamily: FONT }}>
      <div className="mx-auto mb-4 h-6 w-24 rounded-full bg-[#26282d]" aria-hidden="true" />
      <div className="mb-5 flex items-center justify-between px-2 text-[11px] font-bold text-gray-800"><span>9:41</span><span aria-hidden="true">●●● ▰</span></div>
      <div className="mb-4 flex items-center justify-between px-1"><div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-gray-500">Apple Wallet</p><h3 className="text-[22px] font-bold tracking-tight text-gray-950">Tus tarjetas</h3></div><span className="grid h-9 w-9 place-items-center rounded-full bg-white text-xl font-light text-gray-700 shadow-sm" aria-hidden="true">+</span></div>

      <article className="relative overflow-hidden rounded-[18px] shadow-[0_10px_30px_rgba(20,20,30,.25)]" style={{ backgroundColor: primaryColor, color: textColor }} aria-label={`Vista previa de la tarjeta de ${issuer} con ${progress} de ${target} sellos`}>
        {/* Muesca semicircular superior */}
        <span className="absolute left-1/2 top-0 z-10 h-[10px] w-[22px] -translate-x-1/2 rounded-b-full bg-[#f1f2f6]" aria-hidden="true" />

        {/* Cabecera: logo + logoText | campo de cabecera */}
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-5">
          <div className="flex min-w-0 items-center gap-2">
            {logo && <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full"><img src={logo} alt="" className="h-full w-full object-cover" /></span>}
            <span className="min-w-0 truncate text-[15px] font-bold leading-none">{issuer}</span>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-semibold uppercase leading-3 tracking-[.04em]" style={{ color: accentColor }}>SELLOS</p>
            <p className="text-[17px] font-normal leading-5">{progress} / {target}</p>
          </div>
        </div>

        {/* Strip image: banner de lado a lado con los sellos encima */}
        {showStrip && <div className="relative w-full overflow-hidden" style={{ aspectRatio: '1125 / 432', backgroundColor: banner ? undefined : stripBgColor }}>
          {banner && <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          {artworkVisible && (
            <div className="absolute inset-0 flex flex-col justify-evenly px-4 py-2" aria-hidden="true">
              {Array.from({ length: rows }, (_, rowIndex) => {
                const startIdx = rowIndex * columns;
                const rowStampsCount = Math.max(0, Math.min(columns, target - startIdx));
                return (
                  <div key={rowIndex} className="flex w-full items-center justify-evenly">
                    {Array.from({ length: rowStampsCount }, (_, colIndex) => {
                      const index = startIdx + colIndex;
                      const filled = index < progress;
                      const url = filled ? completedUrl : pendingUrl;
                      return (
                        <span key={index} className={`flex shrink-0 items-center justify-center ${rows === 1 ? 'h-12 w-12' : 'h-11 w-11'}`}>
                          {url ? (
                            <img src={url} alt="" className="h-full max-h-9 w-full object-contain" style={!filled && pendingUrl === completedUrl ? { opacity: 0.25 } : undefined} />
                          ) : (
                            <span
                              className="block h-[72%] w-[72%] rounded-full border-2"
                              style={{ borderColor: textColor, backgroundColor: filled ? textColor : 'transparent', opacity: filled ? .95 : .4 }}
                            />
                          )}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>}

        {/* Campos: titular a la izquierda, recompensa a la derecha */}
        <div className="flex items-start justify-between gap-4 px-4 pb-4 pt-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase leading-3 tracking-[.04em]" style={{ color: accentColor }}>CLIENTE</p>
            <p className="line-clamp-2 text-[15px] font-normal leading-5">{headline || customerName}</p>
          </div>
          <div className="min-w-0 max-w-[50%] text-right">
            <p className="text-[9px] font-semibold uppercase leading-3 tracking-[.04em]" style={{ color: accentColor }}>RECOMPENSA</p>
            <p className="line-clamp-2 text-[15px] font-normal leading-5">{reward}</p>
          </div>
        </div>

        {/* Pie: QR sobre contenedor blanco */}
        <div className="px-4 pb-4">
          <div className="flex flex-col items-center rounded-2xl bg-white p-3 text-[#111]">
            <div className="w-52 h-52 mx-auto flex items-center justify-center">
              <WalletBarcode format={wallet.barcodeFormat} value={code} size={200} />
            </div>
            {altText && <span className="mt-2 text-xs font-mono font-bold tracking-wider text-center">{altText}</span>}
          </div>
        </div>
      </article>
      <p className="mx-auto mt-5 max-w-[280px] text-center text-[11px] leading-4 text-gray-500">Vista orientativa. Wallet puede ajustar tamaños y ocultar imágenes según el iPhone o Apple Watch.</p>
    </div>
  </div>;
}
