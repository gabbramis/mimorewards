"use client";

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ImagePlus, Palette, Search, Smartphone, Stamp } from 'lucide-react';
import { stampCatalog } from '@/lib/stamp-catalog';
import { alphaBounds, defaultPendingEffect, pendingPixels, STAMP_SIZE, type PendingEffect } from '@/lib/stamp-image';
import CustomerExperience, { type CustomerStage, type CustomerView } from '@/components/customer/CustomerExperience';
import AppleWalletPreview from '@/components/admin/AppleWalletPreview';
import type { NfcContext } from '@/lib/mimo-nfc';

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

function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  if (!/^#[0-9a-f]{6}$/i.test(foreground) || !/^#[0-9a-f]{6}$/i.test(background)) return 1;
  const first = luminance(foreground), second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <label className="block text-sm font-semibold text-gray-700">
      {label}
      <span className="mt-2 flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value.toUpperCase())}
          disabled={disabled}
          className="h-11 w-14 cursor-pointer rounded-xl border border-gray-200 bg-white p-1"
        />
        <span className="font-mono text-xs text-gray-600">{value}</span>
      </span>
    </label>
  );
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

export function BusinessDesign({ value, onChange, logoPreview, businessName, rewardTarget, rewardDescription, disabled }: {
  value: DesignValue; onChange: (next: DesignValue) => void; logoPreview: string | null; businessName: string;
  rewardTarget: number; rewardDescription: string; disabled: boolean;
}) {
  const [activeSection, setActiveSection] = useState<'identidad' | 'sellos' | 'preview'>('identidad');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [simulated, setSimulated] = useState(0);
  const [previewStage, setPreviewStage] = useState<CustomerStage>('register');
  const [previewSurface, setPreviewSurface] = useState<'web' | 'apple'>('web');
  const [walletArtworkVisible, setWalletArtworkVisible] = useState(true);
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
  const previewContext: NfcContext = useMemo(() => ({
    nfcId: 'PREVIEW', businessId: 'preview', businessName: businessName || 'Tu negocio', businessLogo: logoPreview || '', active: true,
    rewardTarget: target, rewardDescription: rewardDescription || 'Tu recompensa', primaryColor: value.primaryColor,
    textColor: value.textColor, accentColor: value.accentColor, stampCompletedUrl: completed || '', stampPendingUrl: pending || '',
  }), [businessName, logoPreview, target, rewardDescription, value.primaryColor, value.textColor, value.accentColor, completed, pending]);
  const previewCustomer: CustomerView = useMemo(() => ({
    id: 'preview', firstName: 'Sofía', lastName: 'López', phone: '', birthdate: '', uniqueCode: 'CLI-12345',
    currentStamps: previewStage === 'reward' ? target : previewStage === 'stamp' ? Math.max(1, progress) : progress,
    targetStamps: target, businessName: previewContext.businessName, businessLogo: previewContext.businessLogo,
    rewardDescription: previewContext.rewardDescription,
  }), [previewStage, progress, target, previewContext.businessName, previewContext.businessLogo, previewContext.rewardDescription]);

  const isIdentidad = activeSection === 'identidad';
  const isSellos = activeSection === 'sellos';
  const isPreview = activeSection === 'preview';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Columna Izquierda: Bloques seleccionables */}
      <div className="lg:col-span-7 space-y-4">

        {/* 01 Identidad visual */}
        <section
          onClick={() => setActiveSection('identidad')}
          className={`rounded-2xl transition-all duration-200 overflow-hidden ${
            isIdentidad
              ? 'border-2 border-[#FF1F2D] bg-white p-6 shadow-md ring-4 ring-red-500/5'
              : 'border border-gray-200 bg-white p-5 shadow-xs hover:border-gray-300 hover:shadow-sm cursor-pointer'
          }`}
          aria-labelledby="identidad-visual"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition ${
                isIdentidad ? 'bg-[#FF1F2D] text-white shadow-xs' : 'bg-gray-100 text-gray-700'
              }`}>
                01
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="identidad-visual" className="font-bold text-gray-900 text-base">Identidad visual</h2>
                  <Palette size={16} className={isIdentidad ? 'text-[#FF1F2D]' : 'text-gray-400'} />
                </div>
                <p className="text-xs text-gray-500">Colores de fondo, textos y acentos de la tarjeta.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isIdentidad ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-[#FF1F2D]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FF1F2D]" />
                  Editando
                </span>
              ) : (
                <div className="flex items-center gap-1.5" title="Colores actuales">
                  <span className="h-4 w-4 rounded-full border border-gray-300 shadow-2xs" style={{ backgroundColor: value.primaryColor }} />
                  <span className="h-4 w-4 rounded-full border border-gray-300 shadow-2xs" style={{ backgroundColor: value.textColor }} />
                  <span className="h-4 w-4 rounded-full border border-gray-300 shadow-2xs" style={{ backgroundColor: value.accentColor }} />
                  <ChevronDown size={18} className="text-gray-400 ml-1" />
                </div>
              )}
            </div>
          </div>

          {/* Contenido expandido */}
          {isIdentidad && (
            <div className="mt-6 pt-5 border-t border-gray-100 space-y-5 animate-in fade-in duration-200">
              <div className="grid gap-4 sm:grid-cols-3">
                <ColorField label="Fondo de la tarjeta" value={value.primaryColor} onChange={primaryColor => update({ primaryColor })} disabled={disabled} />
                <ColorField label="Textos" value={value.textColor} onChange={textColor => update({ textColor })} disabled={disabled} />
                <ColorField label="Acentos" value={value.accentColor} onChange={accentColor => update({ accentColor })} disabled={disabled} />
              </div>

              {contrastRatio(value.textColor, value.primaryColor) < 4.5 && (
                <p className="rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800">
                  El texto de la tarjeta se lee con dificultad sobre este fondo. Elegí un color de texto más claro u oscuro.
                </p>
              )}

              <p className="text-xs leading-relaxed text-gray-500">
                Apple Wallet admite fondo, texto y color de etiquetas. Google Wallet usa el fondo y el logo principal; sus textos y acentos se muestran aquí de forma orientativa.
              </p>
            </div>
          )}
        </section>

        {/* 02 Diseño de los sellos */}
        <section
          onClick={() => setActiveSection('sellos')}
          className={`rounded-2xl transition-all duration-200 overflow-hidden ${
            isSellos
              ? 'border-2 border-[#FF1F2D] bg-white p-6 shadow-md ring-4 ring-red-500/5'
              : 'border border-gray-200 bg-white p-5 shadow-xs hover:border-gray-300 hover:shadow-sm cursor-pointer'
          }`}
          aria-labelledby="diseno-sellos"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition ${
                isSellos ? 'bg-[#FF1F2D] text-white shadow-xs' : 'bg-gray-100 text-gray-700'
              }`}>
                02
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="diseno-sellos" className="font-bold text-gray-900 text-base">Diseño de los sellos</h2>
                  <Stamp size={16} className={isSellos ? 'text-[#FF1F2D]' : 'text-gray-400'} />
                </div>
                <p className="text-xs text-gray-500">Elegí el motivo e ícono para completar la tarjeta.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSellos ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-[#FF1F2D]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FF1F2D]" />
                  Editando
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                    {value.source === 'collection' ? 'Colección' : value.source === 'custom' ? 'Personalizado' : value.source === 'logo' ? 'Logo' : 'Sin motivo'}
                  </span>
                  {completed && <img src={completed} alt="" className="h-6 w-6 object-contain rounded" />}
                  <ChevronDown size={18} className="text-gray-400" />
                </div>
              )}
            </div>
          </div>

          {/* Contenido expandido */}
          {isSellos && (
            <div className="mt-6 pt-5 border-t border-gray-100 space-y-5 animate-in fade-in duration-200">
              <div className="grid gap-3 sm:grid-cols-3">
                {([['collection', 'Colección mimo'], ['custom', 'Sello personalizado'], ['logo', 'Usar el logo como sello']] as const).map(([source, label]) => (
                  <button
                    key={source}
                    type="button"
                    disabled={disabled}
                    aria-pressed={value.source === source}
                    onClick={(e) => { e.stopPropagation(); update({ source, effect: source === 'logo' ? defaultPendingEffect : value.effect }); }}
                    className={`rounded-xl border p-3 text-left text-sm font-semibold transition ${
                      value.source === source
                        ? 'border-[#FF1F2D] bg-red-50 text-[#FF1F2D] ring-2 ring-red-100'
                        : 'border-gray-200 text-gray-700 hover:border-red-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {value.source === 'collection' && (
                <div className="mt-4">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <label className="relative flex-1">
                      <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar un motivo"
                        className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm"
                      />
                    </label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      aria-label="Categoría de sellos"
                      className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    >
                      {categories.map(x => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                  <div className="mt-4 grid max-h-72 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                    {filtered.map(item => {
                      const available = !!item.completed && !!item.pending;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={!available || disabled}
                          onClick={(e) => { e.stopPropagation(); update({ catalogId: item.id, completedUrl: item.completed, pendingUrl: item.pending }); }}
                          className={`relative flex min-h-28 flex-col items-center justify-center rounded-xl border p-3 text-center ${
                            value.catalogId === item.id ? 'border-[#FF1F2D] bg-red-50' : 'border-gray-200 bg-gray-50'
                          } disabled:cursor-not-allowed`}
                        >
                          <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-[10px] text-gray-400">
                            {available ? <img src={item.completed!} alt="" className="h-10 w-10 object-contain" /> : 'Arte pendiente'}
                          </span>
                          <span className="mt-2 text-xs font-semibold text-gray-800">{item.name}</span>
                          {value.catalogId === item.id && <Check size={15} className="absolute right-2 top-2 text-[#FF1F2D]" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-amber-700">
                    La colección está preparada, pero las 23 ilustraciones completadas y pendientes aún no fueron entregadas. Se habilitarán al incorporar sus archivos finales.
                  </p>
                </div>
              )}

              {value.source === 'custom' && (
                <div className="mt-4 space-y-4">
                  <label className="block text-sm font-semibold text-gray-700">
                    PNG con transparencia · 64–2048 px · máximo 2 MB
                    <input
                      type="file"
                      accept="image/png"
                      disabled={disabled}
                      onChange={e => { const file = e.target.files?.[0] || null; update({ customFile: file }); setPreview(null); }}
                      className="mt-2 block w-full rounded-xl border border-gray-200 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-2 file:font-semibold file:text-[#FF1F2D]"
                    />
                  </label>
                  {(preview?.warning || error) && (
                    <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800">
                      {error || preview?.warning}
                    </p>
                  )}
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-gray-700">Efecto del sello pendiente</legend>
                    <div className="flex flex-wrap gap-2">
                      {([['light', 'Clarito'], ['silhouette', 'Silueta'], ['outline', 'Contorno exterior']] as const).map(([mode, label]) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={disabled}
                          aria-pressed={value.effect.mode === mode}
                          onClick={(e) => { e.stopPropagation(); update({ effect: { ...value.effect, mode } }); }}
                          className={`rounded-xl border px-3 py-2 text-sm ${
                            value.effect.mode === mode ? 'border-[#FF1F2D] bg-red-50 font-semibold text-[#FF1F2D]' : 'border-gray-200 text-gray-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  {value.effect.mode === 'light' ? (
                    <label className="block text-sm text-gray-700">
                      Opacidad: {Math.round(value.effect.opacity * 100)}%
                      <input
                        type="range"
                        min="10"
                        max="80"
                        value={Math.round(value.effect.opacity * 100)}
                        disabled={disabled}
                        onChange={e => update({ effect: { ...value.effect, opacity: Number(e.target.value) / 100 } })}
                        className="mt-2 block w-full accent-[#FF1F2D]"
                      />
                    </label>
                  ) : (
                    <ColorField label="Color del sello pendiente" value={value.effect.color} onChange={color => update({ effect: { ...value.effect, color } })} disabled={disabled} />
                  )}
                  {value.effect.mode === 'outline' && (
                    <>
                      <label className="block text-sm text-gray-700">
                        Grosor: {value.effect.thickness} px
                        <input
                          type="range"
                          min="1"
                          max="8"
                          value={value.effect.thickness}
                          disabled={disabled}
                          onChange={e => update({ effect: { ...value.effect, thickness: Number(e.target.value) } })}
                          className="mt-2 block w-full accent-[#FF1F2D]"
                        />
                      </label>
                      <p className="text-xs text-gray-500">El contorno sigue la silueta exterior; no reconstruye líneas internas del dibujo.</p>
                    </>
                  )}
                </div>
              )}

              {value.source === 'logo' && (
                <p className="mt-4 text-xs text-gray-600">
                  El logo principal se usa también como sello. Debe ser un PNG transparente para generar su versión pendiente. El logo y el diseño del sello se guardan por separado.
                </p>
              )}

              <div className="mt-6 grid grid-cols-2 gap-3">
                <StampTile label="Completado" url={completed || null} />
                <StampTile label="Pendiente" url={pending || null} light={value.source === 'logo'} />
              </div>
            </div>
          )}
        </section>

        {/* 03 Vista previa del cliente */}
        <section
          onClick={() => setActiveSection('preview')}
          className={`rounded-2xl transition-all duration-200 overflow-hidden ${
            isPreview
              ? 'border-2 border-[#FF1F2D] bg-white p-6 shadow-md ring-4 ring-red-500/5'
              : 'border border-gray-200 bg-white p-5 shadow-xs hover:border-gray-300 hover:shadow-sm cursor-pointer'
          }`}
          aria-labelledby="vista-previa"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition ${
                isPreview ? 'bg-[#FF1F2D] text-white shadow-xs' : 'bg-gray-100 text-gray-700'
              }`}>
                03
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="vista-previa" className="font-bold text-gray-900 text-base">Vista previa del cliente</h2>
                  <Smartphone size={16} className={isPreview ? 'text-[#FF1F2D]' : 'text-gray-400'} />
                </div>
                <p className="text-xs text-gray-500">Configuración de cómo interactúa el cliente final.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isPreview ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-[#FF1F2D]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FF1F2D]" />
                  Editando
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                    {previewSurface === 'web' ? 'Web' : 'Apple Wallet'}
                  </span>
                  <ChevronDown size={18} className="text-gray-400" />
                </div>
              )}
            </div>
          </div>

          {/* Contenido expandido */}
          {isPreview && (
            <div className="mt-6 pt-5 border-t border-gray-100 space-y-5 animate-in fade-in duration-200">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Superficie</span>
                <div className="mt-2 inline-flex w-full rounded-xl bg-gray-100 p-1" role="group" aria-label="Elegir vista previa">
                  {([['web', 'Formulario y tarjeta web'], ['apple', 'Apple Wallet']] as const).map(([surface, label]) => (
                    <button
                      key={surface}
                      type="button"
                      aria-pressed={previewSurface === surface}
                      onClick={(e) => { e.stopPropagation(); setPreviewSurface(surface); }}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition ${
                        previewSurface === surface ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {previewSurface === 'web' ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Etapa del cliente</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {([['register', 'Registro'], ['card', 'Tarjeta'], ['stamp', 'Nuevo sello'], ['cooldown', 'Espera'], ['reward', 'Premio']] as const).map(([stage, label]) => (
                        <button
                          key={stage}
                          type="button"
                          aria-pressed={previewStage === stage}
                          onClick={(e) => { e.stopPropagation(); setPreviewStage(stage); }}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            previewStage === stage ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {previewStage !== 'register' && (
                    <label className="block text-sm font-semibold text-gray-700">
                      Simular progreso: {progress} de {target} sellos
                      <input
                        type="range"
                        min="0"
                        max={target}
                        value={progress}
                        onChange={e => setSimulated(Number(e.target.value))}
                        className="mt-2 block w-full accent-[#FF1F2D]"
                      />
                    </label>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado rápido</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {([['empty', 'Sin sellos', 0], ['half', 'En progreso', Math.max(1, Math.floor(target / 2))], ['complete', 'Premio listo', target]] as const).map(([state, label, amount]) => (
                        <button
                          key={state}
                          type="button"
                          aria-pressed={progress === amount}
                          onClick={(e) => { e.stopPropagation(); setSimulated(amount); }}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            progress === amount ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="block text-sm font-semibold text-gray-700">
                    Simular progreso: {progress} de {target} sellos
                    <input
                      type="range"
                      min="0"
                      max={target}
                      value={progress}
                      onChange={e => setSimulated(Number(e.target.value))}
                      className="mt-2 block w-full accent-[#FF1F2D]"
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="mr-1 font-semibold text-gray-500">Ilustración de Wallet:</span>
                    <button
                      type="button"
                      aria-pressed={walletArtworkVisible}
                      onClick={(e) => { e.stopPropagation(); setWalletArtworkVisible(true); }}
                      className={`rounded-lg border px-2.5 py-1.5 font-semibold ${
                        walletArtworkVisible ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      Visible
                    </button>
                    <button
                      type="button"
                      aria-pressed={!walletArtworkVisible}
                      onClick={(e) => { e.stopPropagation(); setWalletArtworkVisible(false); }}
                      className={`rounded-lg border px-2.5 py-1.5 font-semibold ${
                        !walletArtworkVisible ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      Oculta por Wallet
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

      </div>

      {/* Columna Derecha: Previsualización en vivo fija (Sticky) */}
      <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {/* Header de la previsualización */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF1F2D] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF1F2D]"></span>
              </span>
              <h3 className="text-sm font-bold text-gray-900">Previsualización en vivo</h3>
            </div>
            <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
              {isIdentidad && 'Identidad visual'}
              {isSellos && 'Diseño de sellos'}
              {isPreview && (previewSurface === 'web' ? 'Pantalla web' : 'Apple Wallet')}
            </span>
          </div>

          {/* Si está en Identidad o Sellos: Tarjeta Apple Wallet en vivo */}
          {(isIdentidad || isSellos) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-700">Simular sellos: {progress}/{target}</span>
                <div className="flex items-center gap-1.5">
                  {([
                    ['0', 0],
                    ['Mitad', Math.max(1, Math.floor(target / 2))],
                    ['Lleno', target],
                  ] as const).map(([label, val]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSimulated(val)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition ${
                        progress === val
                          ? 'bg-gray-900 text-white'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-center overflow-x-auto py-1">
                <AppleWalletPreview
                  businessName={businessName}
                  logoUrl={logoPreview}
                  completedUrl={completed || null}
                  pendingUrl={pending || null}
                  primaryColor={value.primaryColor}
                  textColor={value.textColor}
                  accentColor={value.accentColor}
                  currentStamps={progress}
                  targetStamps={target}
                  rewardDescription={rewardDescription}
                  artworkVisible={walletArtworkVisible}
                />
              </div>

              <p className="text-center text-[11px] text-gray-400">
                {isIdentidad
                  ? 'Los colores de fondo, texto y acento se actualizan en tiempo real.'
                  : 'El motivo del sello y su versión pendiente se actualizan en tiempo real.'}
              </p>
            </div>
          )}

          {/* Si está en Vista previa del cliente: Pantalla Web o Apple Wallet según selector */}
          {isPreview && (
            <div className="space-y-4">
              {previewSurface === 'web' ? (
                <div className="mx-auto max-w-[390px] overflow-hidden rounded-2xl border border-gray-100 shadow-xs">
                  <CustomerExperience
                    key={JSON.stringify({ previewContext, previewCustomer, previewStage })}
                    initialContext={previewContext}
                    initialCustomer={previewCustomer}
                    previewStage={previewStage}
                    appleWalletReady
                  />
                </div>
              ) : (
                <div className="flex justify-center overflow-x-auto py-1">
                  <AppleWalletPreview
                    businessName={businessName}
                    logoUrl={logoPreview}
                    completedUrl={completed || null}
                    pendingUrl={pending || null}
                    primaryColor={value.primaryColor}
                    textColor={value.textColor}
                    accentColor={value.accentColor}
                    currentStamps={progress}
                    targetStamps={target}
                    rewardDescription={rewardDescription}
                    artworkVisible={walletArtworkVisible}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StampTile({ label, url, light = false }: { label: string; url: string | null; light?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center">
      <span className="text-xs font-semibold text-gray-600">{label}</span>
      <div className="mx-auto mt-2 flex h-24 w-24 items-center justify-center rounded-xl bg-white [background-image:linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f4f6_75%),linear-gradient(-45deg,transparent_75%,#f3f4f6_75%)] [background-size:16px_16px]">
        {url ? (
          <img src={url} alt={`${label} del sello`} className="h-20 w-20 object-contain" style={{ opacity: light ? 0.25 : 1 }} />
        ) : (
          <span className="text-[10px] text-gray-400">Sin diseño</span>
        )}
      </div>
    </div>
  );
}
