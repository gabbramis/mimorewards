"use client";

import { useEffect, useMemo, useState } from 'react';
import { Check, ImagePlus, Search, Stamp } from 'lucide-react';
import { stampCatalog } from '@/lib/stamp-catalog';
import { alphaBounds, defaultPendingEffect, pendingPixels, STAMP_SIZE, type PendingEffect } from '@/lib/stamp-image';

export type DesignValue = {
  primaryColor: string; textColor: string; accentColor: string;
  source: 'collection' | 'custom' | 'logo' | null;
  catalogId: string | null; completedUrl: string | null; pendingUrl: string | null;
  effect: PendingEffect; customFile: File | null;
};

export const emptyDesign: DesignValue = {
  primaryColor: '#FF1F2D', textColor: '#FFFFFF', accentColor: '#FFFFFF',
  source: null, catalogId: null, completedUrl: null, pendingUrl: null,
  effect: defaultPendingEffect, customFile: null,
};

const sectionClass = 'rounded-2xl border border-gray-200 bg-white p-6 shadow-sm';

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <label className="block text-sm font-semibold text-gray-700">{label}<span className="mt-2 flex items-center gap-3"><input type="color" value={value} onChange={e => onChange(e.target.value.toUpperCase())} disabled={disabled} className="h-11 w-14 cursor-pointer rounded-xl border border-gray-200 bg-white p-1" /><span className="font-mono text-xs text-gray-600">{value}</span></span></label>;
}

async function previewFile(file: File, effect: PendingEffect): Promise<{ complete: string; pending: string; warning: string }> {
  if (file.type !== 'image/png' || file.size > 2 * 1024 * 1024 || file.size === 0) throw new Error('Elegí un PNG de hasta 2 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 64 || bitmap.height < 64 || bitmap.width > 2048 || bitmap.height > 2048) throw new Error('La imagen debe medir entre 64 y 2048 píxeles por lado.');
    const source = document.createElement('canvas'); source.width = bitmap.width; source.height = bitmap.height;
    const context = source.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(bitmap, 0, 0);
    const bounds = alphaBounds(context.getImageData(0, 0, bitmap.width, bitmap.height).data, bitmap.width, bitmap.height);
    if (bounds.empty) throw new Error('La imagen del sello está vacía.');
    const complete = document.createElement('canvas'); complete.width = complete.height = STAMP_SIZE;
    const ctx = complete.getContext('2d', { willReadFrequently: true })!;
    const contentWidth = bounds.right - bounds.left + 1, contentHeight = bounds.bottom - bounds.top + 1;
    const scale = Math.min(144 / contentWidth, 144 / contentHeight);
    const width = contentWidth * scale, height = contentHeight * scale;
    ctx.drawImage(source, bounds.left, bounds.top, contentWidth, contentHeight, (STAMP_SIZE - width) / 2, (STAMP_SIZE - height) / 2, width, height);
    const pending = document.createElement('canvas'); pending.width = pending.height = STAMP_SIZE;
    const pendingContext = pending.getContext('2d')!;
    const imageData = pendingContext.createImageData(STAMP_SIZE, STAMP_SIZE);
    imageData.data.set(pendingPixels(ctx.getImageData(0, 0, STAMP_SIZE, STAMP_SIZE).data, effect));
    pendingContext.putImageData(imageData, 0, 0);
    return { complete: complete.toDataURL('image/png'), pending: pending.toDataURL('image/png'), warning: bounds.transparent ? '' : 'Esta imagen no tiene transparencia. Necesitás un PNG sin fondo para generar una silueta o contorno correcto; no se elimina el fondo automáticamente.' };
  } finally { bitmap.close(); }
}

export function BusinessDesign({ value, onChange, logoPreview, rewardTarget, rewardDescription, disabled }: {
  value: DesignValue; onChange: (next: DesignValue) => void; logoPreview: string | null;
  rewardTarget: number; rewardDescription: string; disabled: boolean;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [simulated, setSimulated] = useState(0);
  const [preview, setPreview] = useState<{ complete: string; pending: string; warning: string } | null>(null);
  const [error, setError] = useState('');
  const categories = useMemo(() => ['Todos', ...new Set(stampCatalog.map(x => x.category))], []);
  const filtered = stampCatalog.filter(x => (category === 'Todos' || x.category === category) && x.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  const target = Math.min(15, Math.max(4, rewardTarget || 10));
  const progress = Math.min(simulated, target);

  useEffect(() => {
    if (value.source !== 'custom' || (!value.customFile && !value.completedUrl)) return;
    let active = true;
    (async () => {
      const file = value.customFile || new File([await (await fetch(value.completedUrl!)).blob()], 'sello-actual.png', { type: 'image/png' });
      return previewFile(file, value.effect);
    })().then(result => { if (active) { setPreview(result); setError(''); } }).catch(e => { if (active) { setError(e instanceof Error ? e.message : 'No se pudo procesar la imagen.'); setPreview(null); } });
    return () => { active = false; };
  }, [value.source, value.customFile, value.completedUrl, value.effect]);

  const completed = value.source === 'custom' ? (preview?.complete || value.completedUrl) : value.source === 'logo' ? logoPreview : value.source === 'collection' ? stampCatalog.find(x => x.id === value.catalogId)?.completed : null;
  const pending = value.source === 'custom' ? (preview?.pending || value.pendingUrl) : value.source === 'logo' ? logoPreview : value.source === 'collection' ? stampCatalog.find(x => x.id === value.catalogId)?.pending : null;
  const update = (part: Partial<DesignValue>) => onChange({ ...value, ...part });

  return <>
    <section className={sectionClass} aria-labelledby="identidad-visual">
      <div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#FF1F2D]"><ImagePlus size={20} /></span><div><h2 id="identidad-visual" className="font-bold text-gray-900">Identidad visual</h2><p className="text-xs text-gray-500">El logo principal se configura en Datos del negocio.</p></div></div>
      <div className="grid gap-5 sm:grid-cols-3">
        <ColorField label="Fondo de la tarjeta" value={value.primaryColor} onChange={primaryColor => update({ primaryColor })} disabled={disabled} />
        <ColorField label="Textos" value={value.textColor} onChange={textColor => update({ textColor })} disabled={disabled} />
        <ColorField label="Acentos" value={value.accentColor} onChange={accentColor => update({ accentColor })} disabled={disabled} />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-gray-500">Apple Wallet admite fondo, texto y color de etiquetas. Google Wallet usa el fondo y el logo principal; sus textos y acentos se muestran aquí de forma orientativa.</p>
    </section>

    <section className={sectionClass} aria-labelledby="diseno-sellos">
      <div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#FF1F2D]"><Stamp size={20} /></span><div><h2 id="diseno-sellos" className="font-bold text-gray-900">Diseño de los sellos</h2><p className="text-xs text-gray-500">Elegí un motivo para completar la tarjeta.</p></div></div>
      <div className="grid gap-3 sm:grid-cols-3">
        {([['collection', 'Colección mimo'], ['custom', 'Sello personalizado'], ['logo', 'Usar el logo como sello']] as const).map(([source, label]) => <button key={source} type="button" disabled={disabled} aria-pressed={value.source === source} onClick={() => update({ source, effect: source === 'logo' ? defaultPendingEffect : value.effect })} className={`rounded-xl border p-3 text-left text-sm font-semibold transition ${value.source === source ? 'border-[#FF1F2D] bg-red-50 text-[#FF1F2D] ring-2 ring-red-100' : 'border-gray-200 text-gray-700 hover:border-red-200'}`}>{label}</button>)}
      </div>
      {value.source === 'collection' && <div className="mt-5">
        <div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar un motivo" className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm" /></label><select value={category} onChange={e => setCategory(e.target.value)} aria-label="Categoría de sellos" className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm">{categories.map(x => <option key={x}>{x}</option>)}</select></div>
        <div className="mt-4 grid max-h-72 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">{filtered.map(item => { const available = !!item.completed && !!item.pending; return <button key={item.id} type="button" disabled={!available || disabled} onClick={() => update({ catalogId: item.id, completedUrl: item.completed, pendingUrl: item.pending })} className={`relative flex min-h-28 flex-col items-center justify-center rounded-xl border p-3 text-center ${value.catalogId === item.id ? 'border-[#FF1F2D] bg-red-50' : 'border-gray-200 bg-gray-50'} disabled:cursor-not-allowed`}><span className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-[10px] text-gray-400">{available ? <img src={item.completed!} alt="" className="h-10 w-10 object-contain" /> : 'Arte pendiente'}</span><span className="mt-2 text-xs font-semibold text-gray-800">{item.name}</span>{value.catalogId === item.id && <Check size={15} className="absolute right-2 top-2 text-[#FF1F2D]" />}</button>; })}</div>
        <p className="mt-3 text-xs text-amber-700">La colección está preparada, pero las 23 ilustraciones completadas y pendientes aún no fueron entregadas. Se habilitarán al incorporar sus archivos finales.</p>
      </div>}
      {value.source === 'custom' && <div className="mt-5 space-y-4">
        <label className="block text-sm font-semibold text-gray-700">PNG con transparencia · 64–2048 px · máximo 2 MB<input type="file" accept="image/png" disabled={disabled} onChange={e => { const file = e.target.files?.[0] || null; update({ customFile: file }); setPreview(null); }} className="mt-2 block w-full rounded-xl border border-gray-200 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-2 file:font-semibold file:text-[#FF1F2D]" /></label>
        {(preview?.warning || error) && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800">{error || preview?.warning}</p>}
        <fieldset><legend className="mb-2 text-sm font-semibold text-gray-700">Efecto del sello pendiente</legend><div className="flex flex-wrap gap-2">{([['light', 'Clarito'], ['silhouette', 'Silueta'], ['outline', 'Contorno exterior']] as const).map(([mode, label]) => <button key={mode} type="button" disabled={disabled} aria-pressed={value.effect.mode === mode} onClick={() => update({ effect: { ...value.effect, mode } })} className={`rounded-xl border px-3 py-2 text-sm ${value.effect.mode === mode ? 'border-[#FF1F2D] bg-red-50 font-semibold text-[#FF1F2D]' : 'border-gray-200 text-gray-700'}`}>{label}</button>)}</div></fieldset>
        {value.effect.mode === 'light' ? <label className="block text-sm text-gray-700">Opacidad: {Math.round(value.effect.opacity * 100)}%<input type="range" min="10" max="80" value={Math.round(value.effect.opacity * 100)} disabled={disabled} onChange={e => update({ effect: { ...value.effect, opacity: Number(e.target.value) / 100 } })} className="mt-2 block w-full accent-[#FF1F2D]" /></label> : <ColorField label="Color del sello pendiente" value={value.effect.color} onChange={color => update({ effect: { ...value.effect, color } })} disabled={disabled} />}
        {value.effect.mode === 'outline' && <><label className="block text-sm text-gray-700">Grosor: {value.effect.thickness} px<input type="range" min="1" max="8" value={value.effect.thickness} disabled={disabled} onChange={e => update({ effect: { ...value.effect, thickness: Number(e.target.value) } })} className="mt-2 block w-full accent-[#FF1F2D]" /></label><p className="text-xs text-gray-500">El contorno sigue la silueta exterior; no reconstruye líneas internas del dibujo.</p></>}
      </div>}
      {value.source === 'logo' && <p className="mt-4 text-xs text-gray-600">El logo principal se usa también como sello. Debe ser un PNG transparente para generar su versión pendiente. El logo y el diseño del sello se guardan por separado.</p>}
      <div className="mt-6 grid grid-cols-2 gap-3"><StampTile label="Completado" url={completed || null} /><StampTile label="Pendiente" url={pending || null} light={value.source === 'logo'} /></div>
    </section>

    <section className={sectionClass} aria-labelledby="vista-previa"><h2 id="vista-previa" className="font-bold text-gray-900">Vista previa en vivo</h2><p className="mt-1 text-xs text-gray-500">Diseño orientativo de mimo; Apple Wallet y Google Wallet tienen distribuciones distintas. Este control nunca cambia los sellos de un cliente.</p>
      <div className="mt-5 overflow-hidden rounded-2xl p-5 shadow-md" style={{ backgroundColor: value.primaryColor, color: value.textColor }}><div className="flex items-center justify-between gap-3"><strong className="truncate text-lg">Tu tarjeta mimo</strong>{logoPreview ? <img src={logoPreview} alt="Logo principal" className="h-12 w-12 rounded-lg object-contain" /> : <span className="text-xs opacity-70">Sin logo</span>}</div><p className="mt-2 text-xs" style={{ color: value.accentColor }}>{progress} de {target} sellos</p><div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(5, target)}, minmax(0, 1fr))` }}>{Array.from({ length: target }, (_, index) => <span key={index} className="flex aspect-square items-center justify-center rounded-lg border border-current/20 bg-white/10 p-1">{(index < progress ? completed : pending) ? <img src={(index < progress ? completed : pending)!} alt="" className="h-full w-full object-contain" style={{ opacity: value.source === 'logo' && index >= progress ? 0.25 : 1 }} /> : <span className="h-5 w-5 rounded-full border border-current/50 opacity-50" />}</span>)}</div><p className="mt-4 text-sm font-semibold" style={{ color: value.accentColor }}>{rewardDescription || 'Un beneficio gratis'}</p></div>
      <label className="mt-5 block text-sm font-semibold text-gray-700">Simular progreso: {progress} de {target}<input type="range" min="0" max={target} value={progress} onChange={e => setSimulated(Number(e.target.value))} className="mt-2 block w-full accent-[#FF1F2D]" /></label>
    </section>
  </>;
}

function StampTile({ label, url, light = false }: { label: string; url: string | null; light?: boolean }) {
  return <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center"><span className="text-xs font-semibold text-gray-600">{label}</span><div className="mx-auto mt-2 flex h-24 w-24 items-center justify-center rounded-xl bg-white [background-image:linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f4f6_75%),linear-gradient(-45deg,transparent_75%,#f3f4f6_75%)] [background-size:16px_16px]">{url ? <img src={url} alt={`${label} del sello`} className="h-20 w-20 object-contain" style={{ opacity: light ? 0.25 : 1 }} /> : <span className="text-[10px] text-gray-400">Sin diseño</span>}</div></div>;
}
