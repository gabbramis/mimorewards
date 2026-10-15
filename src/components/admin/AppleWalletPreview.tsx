"use client";

import QRCode from "react-qr-code";

type Props = {
  businessName: string;
  logoUrl: string | null;
  completedUrl: string | null;
  pendingUrl: string | null;
  primaryColor: string;
  textColor: string;
  accentColor: string;
  currentStamps: number;
  targetStamps: number;
  rewardDescription: string;
  artworkVisible: boolean;
};

export default function AppleWalletPreview({ businessName, logoUrl, completedUrl, pendingUrl, primaryColor, textColor, accentColor, currentStamps, targetStamps, rewardDescription, artworkVisible }: Props) {
  const target = Math.max(1, targetStamps);
  const progress = Math.min(Math.max(0, currentStamps), target);
  const columns = Math.ceil(target / 2);

  return <div className="mx-auto w-full max-w-[390px] rounded-[46px] border-[7px] border-[#26282d] bg-[#26282d] p-[4px] shadow-[0_25px_70px_rgba(15,23,42,.22)]">
    <div className="relative min-h-[690px] overflow-hidden rounded-[35px] bg-[#f1f2f6] px-4 pb-8 pt-5">
      <div className="mx-auto mb-4 h-6 w-24 rounded-full bg-[#26282d]" aria-hidden="true" />
      <div className="mb-5 flex items-center justify-between px-2 text-[11px] font-bold text-gray-800"><span>9:41</span><span aria-hidden="true">●●● ▰</span></div>
      <div className="mb-4 flex items-center justify-between px-1"><div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-gray-500">Apple Wallet</p><h3 className="text-[22px] font-bold tracking-tight text-gray-950">Tus tarjetas</h3></div><span className="grid h-9 w-9 place-items-center rounded-full bg-white text-xl font-light text-gray-700 shadow-sm" aria-hidden="true">+</span></div>
      <article className="overflow-hidden rounded-[21px] shadow-[0_18px_35px_rgba(20,20,30,.2)]" style={{ backgroundColor: primaryColor, color: textColor }} aria-label={`Vista previa de la tarjeta de ${businessName || 'Tu negocio'} con ${progress} de ${target} sellos`}>
        <div className="px-5 pb-5 pt-5">
          <div className="flex min-h-10 items-center gap-2.5">
            {logoUrl && <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/15 p-1"><img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" /></span>}
            <span className="min-w-0 truncate text-base font-bold tracking-tight">{businessName || 'Tu negocio'}</span>
          </div>
          <div className="mt-7 flex items-end justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[.17em]" style={{ color: accentColor }}>SELLOS</p><p className="mt-0.5 text-[36px] font-semibold leading-none tracking-[-.07em]">{progress}<span className="mx-1.5 text-[23px] font-normal opacity-65">/</span>{target}</p></div>
            {progress === target && <span className="rounded-full border border-current/25 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide">Premio listo</span>}
          </div>
          {artworkVisible && <div className="mt-5 grid gap-x-1 gap-y-2 rounded-xl border border-white/15 bg-black/5 px-2.5 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-hidden="true">
            {Array.from({ length: target }, (_, index) => {
              const filled = index < progress;
              const url = filled ? completedUrl : pendingUrl;
              return <span key={index} className="flex aspect-square min-w-0 items-center justify-center">
                {url ? <img src={url} alt="" className="h-full max-h-12 w-full object-contain" style={!filled && pendingUrl === completedUrl ? { opacity: 0.25 } : undefined} /> : <span className="block h-5 w-5 rounded-full border-2" style={{ borderColor: textColor, backgroundColor: filled ? textColor : 'transparent', opacity: filled ? .95 : .35 }} />}
              </span>;
            })}
          </div>}
          <div className="mt-5 grid grid-cols-[1.4fr_.8fr] gap-3"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: accentColor }}>RECOMPENSA</p><p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-4">{rewardDescription || 'Tu recompensa'}</p></div><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: accentColor }}>CLIENTE</p><p className="mt-1 truncate text-[13px] font-semibold">Sofía López</p></div></div>
        </div>
        <div className="flex flex-col items-center px-5 pb-4 pt-4 text-[#171717]" style={{ backgroundColor: '#FFFFFF' }}><QRCode value="CLI-12345" size={96} /><span className="mt-2 font-mono text-[10px] tracking-[.16em]">CLI-12345</span></div>
      </article>
      <p className="mx-auto mt-5 max-w-[280px] text-center text-[11px] leading-4 text-gray-500">Vista orientativa. Wallet puede ajustar tamaños y ocultar imágenes según el iPhone o Apple Watch.</p>
    </div>
  </div>;
}
