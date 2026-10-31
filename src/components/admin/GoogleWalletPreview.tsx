"use client";

import WalletBarcode from "@/components/admin/WalletBarcode";
import { defaultWalletConfig, resolveWalletText, type WalletConfig } from "@/lib/wallet-config";

type Props = {
  businessName: string;
  logoUrl: string | null;
  primaryColor: string;
  textColor: string;
  accentColor: string;
  stampBackgroundColor?: string;
  currentStamps: number;
  targetStamps: number;
  rewardDescription: string;
  wallet?: WalletConfig;
};

const FONT = '"Google Sans", "Product Sans", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Réplica de una LoyaltyCard de Google Wallet (Android, Material 3). */
export default function GoogleWalletPreview({ businessName, logoUrl, primaryColor, textColor, accentColor, currentStamps, targetStamps, rewardDescription, wallet = defaultWalletConfig }: Props) {
  const target = Math.max(1, targetStamps);
  const progress = Math.min(Math.max(0, currentStamps), target);
  const customerName = "Sofía López";
  const code = "15001";
  const issuer = wallet.issuerName || businessName || 'Tu negocio';
  const logo = wallet.logoUrl || logoUrl;
  const headline = resolveWalletText(wallet.headline, { nombre: customerName.split(' ')[0], proximo_premio: rewardDescription });
  const reward = resolveWalletText(wallet.rewardText || '{proximo_premio}', { nombre: customerName, proximo_premio: rewardDescription || 'Tu recompensa' });
  const altText = resolveWalletText(wallet.barcodeAltText, { id: code });
  const banner = wallet.bannerEnabled && wallet.bannerUrl ? wallet.bannerUrl : null;

  const modules: { label: string; value: string }[] = [
    { label: 'Sellos', value: `${progress} / ${target}` },
    { label: 'Recompensa', value: reward },
    { label: 'Titular', value: customerName },
    { label: 'ID de socio', value: code },
  ];

  return <div className="mx-auto w-full max-w-[390px] rounded-[40px] border-[7px] border-[#1f2125] bg-[#1f2125] p-[3px] shadow-[0_25px_70px_rgba(15,23,42,.22)]">
    <div className="relative min-h-[690px] overflow-hidden rounded-[32px] bg-[#f3f4f8] px-4 pb-8 pt-4" style={{ fontFamily: FONT }}>
      <div className="mx-auto mb-3 h-3.5 w-3.5 rounded-full bg-[#1f2125]" aria-hidden="true" />
      <div className="mb-4 flex items-center justify-between px-2 text-[11px] font-bold text-gray-800"><span>9:41</span><span aria-hidden="true">▾ ▮▮▮</span></div>
      <div className="mb-4 px-1"><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-gray-500">Google Wallet</p><h3 className="text-[22px] font-bold tracking-tight text-gray-950">Pases</h3></div>

      <article className="overflow-hidden rounded-[24px] pb-4 shadow-[0_6px_20px_rgba(20,20,30,.22)]" style={{ backgroundColor: primaryColor, color: textColor }} aria-label={`Vista previa de Google Wallet de ${issuer}`}>
        {/* Cabecera */}
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
            {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <span className="text-base font-medium text-gray-500">{issuer.slice(0, 1).toUpperCase()}</span>}
          </span>
          <span className="min-w-0 truncate text-[16px] font-medium leading-6">{issuer}</span>
        </div>

        {/* Hero image */}
        {banner && <div className="px-4 pb-4">
          <img src={banner} alt="" className="block w-full rounded-[16px] object-cover" style={{ aspectRatio: '1032 / 336' }} />
        </div>}

        {/* Titular + módulos en 2 columnas */}
        <div className="px-5">
          {headline && <p className="line-clamp-2 text-[26px] font-normal leading-8 tracking-[-.01em]">{headline}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5">
            {modules.map(item => <div key={item.label} className="min-w-0">
              <dt className="text-[11px] font-medium leading-4 tracking-[.01em]" style={{ color: accentColor, opacity: .85 }}>{item.label}</dt>
              <dd className="line-clamp-2 text-[14px] font-semibold leading-5">{item.value}</dd>
            </div>)}
          </dl>
        </div>

        {/* Escaneo */}
        <div className="mx-4 mt-5 flex flex-col items-center rounded-2xl bg-white p-3 text-[#1f1f1f]">
          <div className="w-52 h-52 mx-auto flex items-center justify-center">
            <WalletBarcode format={wallet.barcodeFormat} value={code} size={200} />
          </div>
          {altText && <span className="mt-2 text-xs font-mono font-bold tracking-wider text-center">{altText}</span>}
        </div>
      </article>
      <p className="mx-auto mt-5 max-w-[280px] text-center text-[11px] leading-4 text-gray-500">Vista orientativa. Google Wallet usa el fondo, logo y banner; los textos se ajustan según el dispositivo.</p>
    </div>
  </div>;
}
