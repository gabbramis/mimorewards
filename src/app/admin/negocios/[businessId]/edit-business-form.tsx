"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { BusinessDesign, emptyDesign, type DesignValue } from '@/components/admin/BusinessDesign';
import { validateEffect } from '@/lib/stamp-image';

type Business = {
  id: string; name: string; logo_url: string | null; active: boolean; reward_target: number; reward_description: string | null;
  primary_color: string | null; card_text_color: string | null; card_accent_color: string | null;
  stamp_source: DesignValue['source']; stamp_catalog_id: string | null; stamp_completed_url: string | null;
  stamp_pending_url: string | null; stamp_pending_effect: unknown;
};

export default function EditBusinessForm({ business }: { business: Business }) {
  const router = useRouter();
  const initial = useMemo(() => ({
    name: business.name, active: business.active, rewardTarget: business.reward_target || 10,
    rewardDescription: business.reward_description || '', logoUrl: business.logo_url,
    design: { ...emptyDesign, primaryColor: business.primary_color || emptyDesign.primaryColor, textColor: business.card_text_color || '#FFFFFF', accentColor: business.card_accent_color || '#FFFFFF', source: business.stamp_source, catalogId: business.stamp_catalog_id, completedUrl: business.stamp_completed_url, pendingUrl: business.stamp_pending_url, effect: validateEffect(business.stamp_pending_effect) } as DesignValue,
  }), [business]);
  const [name, setName] = useState(initial.name);
  const [active, setActive] = useState(initial.active);
  const [rewardTarget, setRewardTarget] = useState(initial.rewardTarget);
  const [rewardDescription, setRewardDescription] = useState(initial.rewardDescription);
  const [design, setDesign] = useState(initial.design);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl);
  const logoObjectUrl = useRef<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const snapshot = JSON.stringify({ name, active, rewardTarget, rewardDescription, design: { ...design, customFile: design.customFile?.name || null }, logoFile: logoFile?.name || null });
  const originalSnapshot = JSON.stringify({ name: initial.name, active: initial.active, rewardTarget: initial.rewardTarget, rewardDescription: initial.rewardDescription, design: { ...initial.design, customFile: null }, logoFile: null });
  const dirty = snapshot !== (savedSnapshot || originalSnapshot);

  useEffect(() => () => { if (logoObjectUrl.current) URL.revokeObjectURL(logoObjectUrl.current); }, []);
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload); }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const confirmNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
      if (!link || link.getAttribute('target') === '_blank' || link.href === window.location.href) return;
      if (!window.confirm('Hay cambios sin guardar. ¿Querés salir igual?')) { event.preventDefault(); event.stopPropagation(); }
    };
    document.addEventListener('click', confirmNavigation, true);
    return () => document.removeEventListener('click', confirmNavigation, true);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    let restoring = false;
    const checkBack = () => {
      if (restoring) { restoring = false; return; }
      if (!window.confirm('Hay cambios sin guardar. ¿Querés salir igual?')) { restoring = true; window.history.forward(); }
    };
    window.addEventListener('popstate', checkBack);
    return () => window.removeEventListener('popstate', checkBack);
  }, [dirty]);

  function cancel() { if (!dirty || window.confirm('Hay cambios sin guardar. ¿Querés salir igual?')) router.push('/admin/negocios'); }
  function chooseLogo(file: File | undefined) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 800 * 1024) { setError('El logo debe ser PNG, JPG o WebP de hasta 800 KB.'); return; }
    if (logoObjectUrl.current) URL.revokeObjectURL(logoObjectUrl.current);
    logoObjectUrl.current = URL.createObjectURL(file);
    setLogoPreview(logoObjectUrl.current);
    setError(''); setLogoFile(file);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(''); setSuccess('');
    const data = new FormData();
    data.set('name', name.trim()); data.set('active', String(active)); data.set('rewardTarget', String(rewardTarget)); data.set('rewardDescription', rewardDescription.trim());
    data.set('primaryColor', design.primaryColor); data.set('cardTextColor', design.textColor); data.set('cardAccentColor', design.accentColor);
    data.set('stampSource', design.source || ''); data.set('stampCatalogId', design.catalogId || ''); data.set('stampEffect', JSON.stringify(design.effect));
    if (logoFile) data.set('logo', logoFile);
    if (design.customFile) data.set('stampFile', design.customFile);
    try {
      const response = await fetch(`/api/admin/businesses/${business.id}`, { method: 'PUT', body: data });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error || 'No se pudieron guardar los cambios.'); return; }
      setSuccess('Cambios guardados en este negocio. Las tarjetas Wallet ya emitidas no se sincronizan automáticamente.');
      setSavedSnapshot(snapshot);
      router.refresh();
    } catch { setError('No se pudieron guardar los cambios. Revisá la conexión e intentá de nuevo.'); }
    finally { setSaving(false); }
  }

  return <form onSubmit={save} className="space-y-6">
    <div><Link href="/admin/negocios" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#FF1F2D]"><ArrowLeft size={16} /> Negocios</Link><h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">Editar {business.name}</h1><p className="mt-1 text-sm text-gray-500">Los cambios se aplican únicamente al guardar.</p></div>
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-gray-900">Datos del negocio</h2><div className="mt-5 grid gap-5 sm:grid-cols-[160px_1fr]"><div><span className="text-sm font-semibold text-gray-700">Logo principal</span><div className="mt-2 flex h-36 w-36 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50">{logoPreview ? <img src={logoPreview} alt="Logo actual" className="h-full w-full object-contain" /> : <span className="text-xs text-gray-400">Sin logo</span>}</div><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => chooseLogo(e.target.files?.[0])} disabled={saving} aria-label="Cambiar logo principal" className="mt-2 block w-full text-xs" /><p className="mt-1 text-xs text-gray-500">PNG, JPG o WebP · máximo 800 KB</p></div><div className="space-y-4"><label className="block text-sm font-semibold text-gray-700">Nombre del negocio<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} disabled={saving} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" /></label><label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} disabled={saving} className="accent-[#FF1F2D]" /> Negocio activo</label></div></div></section>
    <BusinessDesign value={design} onChange={setDesign} logoPreview={logoPreview} rewardTarget={rewardTarget} rewardDescription={rewardDescription} disabled={saving} />
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-gray-900">Programa de fidelización</h2><p className="mt-1 text-xs text-gray-500">Si ya hay clientes, la meta y el premio se mantienen para no reinterpretar su progreso.</p><div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold text-gray-700">Sellos necesarios<input type="number" min={4} max={15} required value={rewardTarget} onChange={e => setRewardTarget(Number(e.target.value))} disabled={saving} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" /></label><label className="text-sm font-semibold text-gray-700">Premio<input value={rewardDescription} onChange={e => setRewardDescription(e.target.value)} disabled={saving} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" /></label></div></section>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-700">{success}</p>}
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={cancel} disabled={saving} className="rounded-xl border border-gray-200 px-6 py-3 font-semibold text-gray-700">Cancelar</button><button type="submit" disabled={saving || !dirty} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF1F2D] px-6 py-3 font-bold text-white disabled:opacity-50">{saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
  </form>;
}
