"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Loader2, QrCode, RefreshCw, Save } from 'lucide-react';
import { BusinessDesign, emptyDesign, type DesignValue } from '@/components/admin/BusinessDesign';
import { BusinessMembersManager } from '@/components/admin/BusinessMembersManager';
import { validateEffect } from '@/lib/stamp-image';
import { isHttpsUrl, sanitizeWalletConfig, type WalletConfig } from '@/lib/wallet-config';

type Business = {
  id: string; name: string; logo_url: string | null; active: boolean; reward_target: number; reward_description: string | null;
  primary_color: string | null; card_text_color: string | null; card_accent_color: string | null;
  stamp_source: DesignValue['source']; stamp_catalog_id: string | null; stamp_completed_url: string | null;
  stamp_pending_url: string | null; stamp_pending_effect: unknown; wallet_config: unknown; plan_type?: string | null;
  registro_subtitulo?: string | null; registro_titulo?: string | null;
};

export default function EditBusinessForm({ business }: { business: Business }) {
  const router = useRouter();
  const initial = useMemo(() => ({
    name: business.name, active: business.active, rewardTarget: business.reward_target || 10,
    rewardDescription: business.reward_description || '', logoUrl: business.logo_url,
    design: { ...emptyDesign, primaryColor: business.primary_color || emptyDesign.primaryColor, textColor: business.card_text_color || '#FFFFFF', accentColor: business.card_accent_color || '#FFFFFF', source: business.stamp_source, catalogId: business.stamp_catalog_id, completedUrl: business.stamp_completed_url, pendingUrl: business.stamp_pending_url, effect: validateEffect(business.stamp_pending_effect), registroSubtitulo: business.registro_subtitulo || emptyDesign.registroSubtitulo, registroTitulo: business.registro_titulo || emptyDesign.registroTitulo } as DesignValue,
    wallet: sanitizeWalletConfig(business.wallet_config),
  }), [business]);
  const [name, setName] = useState(initial.name);
  const [active, setActive] = useState(initial.active);
  const [rewardTarget, setRewardTarget] = useState(initial.rewardTarget);
  const [rewardDescription, setRewardDescription] = useState(initial.rewardDescription);
  const [design, setDesign] = useState(initial.design);
  const [wallet, setWallet] = useState<WalletConfig>(initial.wallet);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl);
  const logoObjectUrl = useRef<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [syncInfo, setSyncInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncingWallet, setSyncingWallet] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const snapshot = JSON.stringify({ name, active, rewardTarget, rewardDescription, design: { ...design, customFile: design.customFile?.name || null }, wallet, logoFile: logoFile?.name || null });
  const originalSnapshot = JSON.stringify({ name: initial.name, active: initial.active, rewardTarget: initial.rewardTarget, rewardDescription: initial.rewardDescription, design: { ...initial.design, customFile: null }, wallet: initial.wallet, logoFile: null });
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
    if ((wallet.logoUrl && !isHttpsUrl(wallet.logoUrl)) || (wallet.bannerEnabled && wallet.bannerUrl && !isHttpsUrl(wallet.bannerUrl))) {
      setError('Las URLs del logo y del banner de Wallet deben ser públicas y empezar con https://.'); return;
    }
    setSaving(true); setError(''); setSuccess(''); setSyncInfo(null);
    const data = new FormData();
    data.set('name', name.trim()); data.set('active', String(active)); data.set('rewardTarget', String(rewardTarget)); data.set('rewardDescription', rewardDescription.trim());
    data.set('primaryColor', design.primaryColor); data.set('cardTextColor', design.textColor); data.set('cardAccentColor', design.accentColor);
    data.set('registroSubtitulo', design.registroSubtitulo); data.set('registroTitulo', design.registroTitulo);
    data.set('stampSource', design.source || ''); data.set('stampCatalogId', design.catalogId || ''); data.set('stampEffect', JSON.stringify(design.effect));
    data.set('walletConfig', JSON.stringify(wallet));
    if (logoFile) data.set('logo', logoFile);
    if (design.customFile) data.set('stampFile', design.customFile);
    try {
      const response = await fetch(`/api/admin/businesses/${business.id}`, { method: 'PUT', body: data });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error || 'No se pudieron guardar los cambios.'); return; }
      setSuccess('Cambios guardados. Se inició la propagación automática del nuevo diseño a las tarjetas de Google Wallet y Apple Wallet.');
      setSavedSnapshot(snapshot);
      router.refresh();
    } catch { setError('No se pudieron guardar los cambios. Revisá la conexión e intentá de nuevo.'); }
    finally { setSaving(false); }
  }

  async function syncWalletNow() {
    if (syncingWallet || saving) return;
    setSyncingWallet(true);
    setError('');
    setSyncInfo(null);
    try {
      const response = await fetch(`/api/admin/businesses/${business.id}/sync-wallet`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'No se pudieron sincronizar las tarjetas.');
        return;
      }
      const parts: string[] = [];
      if (payload.google?.success) {
        parts.push('Google Wallet actualizado');
      } else if (payload.google?.error) {
        parts.push(`Google Wallet: ${payload.google.error}`);
      }
      if (payload.apple?.configured) {
        parts.push(`Apple Wallet: ${payload.apple.sent} solicitudes aceptadas, ${payload.apple.failed} fallidas`);
      } else {
        parts.push(`Apple Wallet: ${payload.apple?.devicesFound || 0} dispositivos registrados (certificados APNs pendientes)`);
      }
      setSyncInfo(`Resultado de sincronización: ${parts.join(' · ')}. La aceptación no confirma entrega ni visualización.`);
    } catch {
      setError('Error de conexión al sincronizar tarjetas.');
    } finally {
      setSyncingWallet(false);
    }
  }

  return <form onSubmit={save} className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Link href="/admin/negocios" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#FF1F2D] transition-colors">
          <ArrowLeft size={16} /> Negocios
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">Editar {business.name}</h1>
        <Link href={`/admin/negocios/${business.id}/comunicaciones/geolocalizacion`} className="mt-2 inline-block text-sm font-semibold text-[#FF1F2D]">Comunicaciones y geolocalización →</Link>
        <p className="mt-1 text-sm text-gray-500">Los cambios se aplican únicamente al guardar.</p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 sm:pt-6">
        <a
          href={`/t/${business.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          title="Ver cómo ve el cliente su tarjeta y programa"
        >
          <ExternalLink size={16} className="text-gray-400" />
          <span>Portal clientes</span>
        </a>
        <a
          href={`/admin/negocios/${business.id}/caja`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          title="Abrir la terminal de caja y escaneo de este comercio"
        >
          <QrCode size={16} className="text-gray-400" />
          <span>Abrir Caja</span>
        </a>
      </div>
    </div>
    {/* Tarjeta superior (Ancho completo): Datos del negocio y Programa de fidelización */}
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Columna Izquierda: Datos del negocio */}
        <div>
          <h2 className="font-bold text-gray-900 text-base mb-4">Datos del negocio</h2>
          <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
            <div>
              <span className="text-sm font-semibold text-gray-700">Logo principal</span>
              <div className="mt-2 flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo actual" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xs text-gray-400">Sin logo</span>
                )}
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={e => chooseLogo(e.target.files?.[0])}
                disabled={saving}
                aria-label="Cambiar logo principal"
                className="mt-2 block w-full text-xs"
              />
              <p className="mt-1 text-xs text-gray-400">PNG, JPG o WebP · máx 800 KB</p>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">
                Nombre del negocio
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={saving}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 pt-1">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={e => setActive(e.target.checked)}
                  disabled={saving}
                  className="accent-[#FF1F2D] h-4 w-4 rounded"
                />
                Negocio activo
              </label>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Programa de fidelización */}
        <div className="lg:border-l lg:border-gray-200 lg:pl-8">
          <h2 className="font-bold text-gray-900 text-base mb-1">Programa de fidelización</h2>
          <p className="text-xs text-gray-500 mb-4">
            La meta de sellos y el premio definen cuándo el cliente desbloquea su beneficio.
          </p>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">
              Sellos necesarios para el premio
              <input
                type="number"
                min={4}
                max={15}
                required
                value={rewardTarget}
                onChange={e => setRewardTarget(Number(e.target.value))}
                disabled={saving}
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Descripción del premio o recompensa
              <input
                value={rewardDescription}
                onChange={e => setRewardDescription(e.target.value)}
                disabled={saving}
                placeholder="Ej. Café gratis, 20% de descuento..."
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Sección: Accesos del comercio */}
      <div className="mt-8 border-t border-gray-200 pt-8">
        <BusinessMembersManager businessId={business.id} />
      </div>
    </section>

    {/* Bloque inferior: Editor de diseño y previsualización en 2 columnas */}
    <BusinessDesign
      value={design}
      onChange={setDesign}
      logoPreview={logoPreview}
      businessName={name}
      rewardTarget={rewardTarget}
      rewardDescription={rewardDescription}
      wallet={wallet}
      onWalletChange={setWallet}
      walletUploadUrl={`/api/admin/businesses/${business.id}/wallet-image`}
      disabled={saving}
      planType={business.plan_type || 'inicial'}
    />
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-700">{success}</p>}
    {syncInfo && <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-800">{syncInfo}</p>}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <button
          type="button"
          onClick={syncWalletNow}
          disabled={saving || syncingWallet || dirty}
          title={dirty ? 'Guardá los cambios antes de sincronizar' : 'Propagar diseño a todas las tarjetas Wallet ya emitidas'}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40"
        >
          {syncingWallet ? <Loader2 size={15} className="animate-spin text-[#FF1F2D]" /> : <RefreshCw size={15} />}
          {syncingWallet ? 'Sincronizando tarjetas…' : 'Sincronizar tarjetas Wallet ahora'}
        </button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={cancel} disabled={saving || syncingWallet} className="rounded-xl border border-gray-200 px-6 py-3 font-semibold text-gray-700">Cancelar</button>
        <button type="submit" disabled={saving || syncingWallet || !dirty} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF1F2D] px-6 py-3 font-bold text-white disabled:opacity-50">{saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </div>
  </form>;
}
