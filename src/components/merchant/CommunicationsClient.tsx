'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MapPin, Plus, Save, RefreshCw, Trash2, Megaphone } from 'lucide-react';
import { type WalletLocation, validateWalletLocations } from '@/lib/wallet/locations';

const tabs = [
  ['resumen', 'Resumen'], ['campanas', 'Campañas'], ['automatizaciones', 'Automatizaciones'],
  ['geolocalizacion', 'Geolocalización'], ['historial', 'Historial'], ['configuracion', 'Configuración'],
] as const;

type Config = {
  business: { name: string; slug: string; active: boolean; wallet_locations_enabled: boolean; wallet_location_revision: number };
  superadmin: boolean;
  locations: WalletLocation[];
  summary: { counts: Record<string, number>; errors: { channel: string; error_code: string; attempts: number; status: string }[] };
  configured: { apple: boolean; google: boolean };
};
type LocationDraft = Omit<WalletLocation, 'latitude' | 'longitude'> & { latitude: string; longitude: string };
const field = 'mt-1 w-full rounded-xl border border-[#D5CFC4] bg-white px-3 py-2.5 text-sm font-normal text-[#1F1F1F] disabled:opacity-60';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5CFC4] bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50';

async function fetchConfiguration(endpoint: string, signal?: AbortSignal): Promise<Config> {
  const response = await fetch(endpoint, { cache: 'no-store', signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo cargar la configuración.');
  return data;
}

export default function CommunicationsClient({ businessId, section, basePath }: { businessId: string; section: string; basePath: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [locations, setLocations] = useState<LocationDraft[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const endpoint = `/api/comercio/${businessId}/wallet-locations`;

  async function load(reset = true, signal?: AbortSignal) {
    const data = await fetchConfiguration(endpoint, signal);
    setConfig(data);
    if (reset) {
      setEnabled(data.business.wallet_locations_enabled);
      setLocations(data.locations.map((location: WalletLocation) => ({ ...location, latitude: String(location.latitude), longitude: String(location.longitude) })));
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchConfiguration(endpoint, controller.signal).then((data) => {
      setConfig(data);
      setEnabled(data.business.wallet_locations_enabled);
      setLocations(data.locations.map((location) => ({ ...location, latitude: String(location.latitude), longitude: String(location.longitude) })));
    }).catch((err) => { if (err.name !== 'AbortError') setError(err.message); });
    return () => controller.abort();
  }, [endpoint]);

  const draft = () => validateWalletLocations(locations.map((location) => {
    if (!location.latitude.trim() || !location.longitude.trim()) throw new Error('Completá las coordenadas de cada ubicación.');
    return { ...location, latitude: Number(location.latitude), longitude: Number(location.longitude) };
  }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!config || busy) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      const response = await fetch(endpoint, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations: draft(), enabled, revision: config.business.wallet_location_revision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar.');
      // Update the revision even if refreshing the page state subsequently fails.
      setConfig({ ...config, business: { ...config.business, wallet_location_revision: data.revision, wallet_locations_enabled: enabled } });
      setMessage(data.message);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }

  async function processBatch() {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(endpoint, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo procesar el lote.');
      setMessage(data.processed ? `Lote procesado: ${data.processed}. Solicitudes aceptadas: ${data.accepted}.` : 'No hay trabajos disponibles ahora. Los reintentos respetan un tiempo de espera.');
      await load(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo procesar el lote.'); }
    finally { setBusy(false); }
  }

  function addLocation(pilot = false) {
    setLocations([...locations, {
      id: crypto.randomUUID(), name: pilot ? 'Coffe Dreams' : '', address: pilot ? 'Ubicación GPS: -34.9056557, -56.1706692' : '',
      latitude: pilot ? '-34.9056557' : '', longitude: pilot ? '-56.1706692' : '',
      enabled: false, appleRelevantText: 'Local cercano',
    }]);
  }

  const counts = config?.summary.counts ?? {};
  return <div className="space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-[#FF1F2D]">mimo / comunicaciones</p>
      <h1 className="mt-2 text-3xl font-bold text-[#1F1F1F]">Comunicaciones</h1>
      <p className="mt-2 text-sm text-[#737373]">{config?.business.name || 'Configuración del negocio'} · Piloto de cercanía en Wallet</p>
    </header>
    <nav className="flex gap-2 overflow-x-auto pb-2" aria-label="Secciones de Comunicaciones">
      {tabs.map(([key, label]) => <Link key={key} href={`${basePath}/${key}`} aria-current={key === section ? 'page' : undefined}
        className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold ${key === section ? 'bg-[#FF1F2D] text-white' : 'border border-[#D5CFC4] bg-white text-[#737373]'}`}>{label}</Link>)}
    </nav>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    {!config && !error && <p role="status">Cargando configuración…</p>}

    {config && section === 'resumen' && <section className="rounded-2xl border border-[#D5CFC4] bg-white p-6 space-y-4">
      <MapPin className="text-[#FF1F2D]" size={28} />
      <h2 className="text-xl font-bold">Empezamos por la cercanía</h2>
      <p className="text-sm text-[#737373]">Configurá las ubicaciones del negocio para que las tarjetas puedan aparecer cuando sean relevantes. Apple y Google deciden cuándo mostrarlas.</p>
      <p className="text-sm">Piloto: <strong>{config.business.wallet_locations_enabled ? 'habilitado' : 'desactivado'}</strong> · Ubicaciones activas: <strong>{config.locations.filter((location) => location.enabled).length}</strong></p>
      <Link className={button} href={`${basePath}/geolocalizacion`}>Configurar geolocalización</Link>
    </section>}

    {config && section === 'geolocalizacion' && <form onSubmit={save} className="space-y-5">
      <section className="rounded-2xl border border-[#D5CFC4] bg-white p-6 space-y-3">
        <h2 className="text-xl font-bold">Ubicaciones de las sucursales</h2>
        <p className="text-sm text-[#737373]">Hasta 10 ubicaciones, compartidas por todas las tarjetas del negocio. Cada ubicación se activa por separado.</p>
        <p className="text-sm text-[#737373]">No se configura un radio. En Google, el texto y el momento del aviso dependen de Wallet y de los permisos del cliente.</p>
        {config.superadmin && <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={enabled} disabled={busy} onChange={(event) => setEnabled(event.target.checked)} className="accent-[#FF1F2D]" />Habilitar el piloto para este negocio</label>}
        {!enabled && <p className="rounded-xl bg-[#FFF9F5] p-3 text-sm">Podés preparar las ubicaciones. No se incluirán en las tarjetas mientras el piloto esté desactivado.</p>}
      </section>
      {locations.map((location, index) => <fieldset key={location.id} disabled={busy} className="rounded-2xl border border-[#D5CFC4] bg-white p-6">
        <legend className="px-2 text-sm font-bold">Ubicación {index + 1}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Nombre<input required maxLength={120} value={location.name} className={field} onChange={(event) => setLocations(locations.map((row) => row.id === location.id ? { ...row, name: event.target.value } : row))} /></label>
          <label className="text-sm font-semibold">Dirección<input required maxLength={250} value={location.address} className={field} placeholder="Calle y número" onChange={(event) => setLocations(locations.map((row) => row.id === location.id ? { ...row, address: event.target.value } : row))} /></label>
          <label className="text-sm font-semibold">Latitud<input type="number" required step="any" min={-90} max={90} value={location.latitude} className={field} onChange={(event) => setLocations(locations.map((row) => row.id === location.id ? { ...row, latitude: event.target.value } : row))} /></label>
          <label className="text-sm font-semibold">Longitud<input type="number" required step="any" min={-180} max={180} value={location.longitude} className={field} onChange={(event) => setLocations(locations.map((row) => row.id === location.id ? { ...row, longitude: event.target.value } : row))} /></label>
          <label className="text-sm font-semibold sm:col-span-2">Texto de cercanía para Apple Wallet<input maxLength={120} value={location.appleRelevantText} className={field} placeholder="Local cercano en esta zona" onChange={(event) => setLocations(locations.map((row) => row.id === location.id ? { ...row, appleRelevantText: event.target.value } : row))} /><span className="mt-1 block text-xs font-normal text-[#737373]">Describí la ubicación. Evitá promociones e instrucciones de compra.</span></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={location.enabled} className="accent-[#FF1F2D]" onChange={(event) => setLocations(locations.map((row) => row.id === location.id ? { ...row, enabled: event.target.checked } : row))} />Usar esta ubicación para cercanía</label>
          <button type="button" className={button} onClick={() => setLocations(locations.filter((row) => row.id !== location.id))}><Trash2 size={15} />Quitar ubicación</button>
        </div>
        <div className="mt-4 rounded-xl bg-[#FFF9F5] p-4 text-sm">
          <p className="text-xs font-semibold uppercase text-[#737373]">Vista previa orientativa · Apple Wallet</p>
          <p className="mt-2 font-bold">{config.business.name}</p><p>{location.appleRelevantText || 'Local cercano'}</p>
          <p className="mt-2 text-xs text-[#737373]">{location.name || 'Nombre de la sucursal'} · {location.address || 'Dirección pendiente'} · {enabled && location.enabled ? 'Se incluirá al guardar' : 'Desactivada'}</p>
        </div>
      </fieldset>)}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy || locations.length >= 10} onClick={() => addLocation()} className={button}><Plus size={16} />Agregar ubicación</button>
        {config.business.slug === 'coffe-dreams' && locations.length === 0 && <button type="button" disabled={busy} onClick={() => addLocation(true)} className={button}>Usar coordenadas del piloto</button>}
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#FF1F2D] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={16} />{busy ? 'Guardando…' : 'Guardar configuración'}</button>
      </div>
    </form>}

    {config && section === 'historial' && <section className="rounded-2xl border border-[#D5CFC4] bg-white p-6 space-y-4">
      <h2 className="text-xl font-bold">Sincronización de ubicaciones</h2>
      <p className="text-sm text-[#737373]">Estado de la última configuración guardada. Aceptado significa que el proveedor recibió la solicitud; no confirma entrega ni visualización.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{[['pending', 'Pendientes'], ['processing', 'Procesando'], ['accepted', 'Aceptadas'], ['failed', 'Fallidas'], ['skipped', 'Omitidas']].map(([key, label]) => <div key={key} className="rounded-xl bg-[#FFF9F5] p-4"><p className="text-2xl font-bold">{counts[key] || 0}</p><p className="text-xs text-[#737373]">{label}</p></div>)}</div>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className={button} onClick={async () => { setBusy(true); setError(''); try { await load(false); } catch { setError('No se pudo actualizar el estado.'); } finally { setBusy(false); } }}><RefreshCw size={15} />Actualizar estado</button><button type="button" disabled={busy} className={button} onClick={processBatch}>Procesar próximo lote</button></div>
      <p className="text-xs text-[#737373]">Los reintentos se procesan por lotes. Si se agotan, guardá nuevamente la configuración después de resolver el problema. El procesamiento continuo requiere que Mimo conecte el servicio programado.</p>
      {config.summary.errors.length > 0 && <ul className="space-y-2 text-sm">{config.summary.errors.map((item, index) => <li key={index} className="rounded-xl bg-[#FFF9F5] p-3">{item.channel === 'apple' ? 'Apple Wallet' : 'Google Wallet'} · {errorDescription(item.error_code)} · Intentos: {item.attempts}</li>)}</ul>}
    </section>}

    {config && section === 'configuracion' && <section className="rounded-2xl border border-[#D5CFC4] bg-white p-6 space-y-3">
      <h2 className="text-xl font-bold">Disponibilidad de Wallet</h2>
      <p className="text-sm">Apple Wallet: <strong>{config.configured.apple ? 'Material de firma disponible' : 'Configuración pendiente'}</strong></p>
      <p className="text-sm">Google Wallet: <strong>{config.configured.google ? 'Configuración disponible' : 'Configuración pendiente'}</strong></p>
      <p className="text-sm text-[#737373]">La configuración disponible no confirma que una tarjeta esté instalada o se actualice en un teléfono. El piloto requiere una prueba real en iPhone y Android.</p>
      <p className="text-sm text-[#737373]">El negocio gestiona sus ubicaciones. Solo el superadmin habilita el piloto. Los usuarios de caja no pueden gestionar Comunicaciones en esta etapa.</p>
    </section>}

    {config && ['campanas', 'automatizaciones'].includes(section) && <section className="rounded-2xl border border-[#D5CFC4] bg-white p-8 space-y-3 text-center">
      <Megaphone size={32} className="mx-auto text-[#FF1F2D]" /><h2 className="text-xl font-bold">{section === 'campanas' ? 'Campañas' : 'Automatizaciones'} · Próxima etapa</h2>
      <p className="mx-auto max-w-xl text-sm text-[#737373]">Primero vamos a validar las tarjetas y la cercanía con el negocio piloto. Los envíos promocionales estarán disponibles cuando estén listos el consentimiento, los límites y el registro de resultados por canal.</p>
    </section>}
  </div>;
}

function errorDescription(code: string) {
  if (code === 'superseded') return 'Reemplazada por una configuración más reciente';
  if (code === 'business_inactive') return 'Negocio inactivo';
  if (code === 'apns_410') return 'Tarjeta desregistrada';
  if (code === 'pass_type_mismatch') return 'Tipo de pase incompatible';
  if (code === 'google_update_failed') return 'Google no aceptó la actualización; revisá la configuración';
  if (code === 'worker_timeout') return 'El procesamiento se interrumpió';
  return 'No se pudo completar la actualización con el proveedor';
}
