"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { AlertTriangle, Check, Copy, Edit2, ExternalLink, Loader2, Plus, Power, QrCode, Save, Search, Store, Trash2, X } from "lucide-react";

type Business = {
  id: string;
  name: string;
  logo_url?: string | null;
  reward_target: number;
  reward_description: string;
  primary_color?: string | null;
  active: boolean;
  nfcId?: string | null;
  nfcUrl?: string | null;
};

type BusinessForm = {
  name: string;
  logo_url: string;
  reward_target: number;
  reward_description: string;
  active: boolean;
};

const emptyForm: BusinessForm = { name: "", logo_url: "", reward_target: 10, reward_description: "", active: true };

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "?";
}

export default function NegociosPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Business | null>(null);
  const [form, setForm] = useState<BusinessForm>(emptyForm);
  const [copiedId, setCopiedId] = useState("");
  const [qrBusiness, setQrBusiness] = useState<Business | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: "toggle" | "delete"; business: Business } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const filteredBusinesses = useMemo(() => {
    const query = normalize(search);
    if (!query) return businesses;
    return businesses.filter((business) => normalize(business.name).includes(query));
  }, [businesses, search]);

  const loadBusinesses = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/businesses", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) setBusinesses(payload.businesses || []);
      else setError(payload.error || "No se pudieron cargar los negocios.");
    } catch {
      setError("No se pudieron cargar los negocios.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBusinesses();
  }, [loadBusinesses]);

  useEffect(() => {
    let cancelled = false;
    if (!qrBusiness?.nfcUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQrDataUrl("");
      return;
    }

    QRCode.toDataURL(qrBusiness.nfcUrl, {
      width: 720,
      margin: 3,
      errorCorrectionLevel: "H",
      color: { dark: "#1F1F1F", light: "#FFFFFF" },
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    }).catch(() => {
      if (!cancelled) setQrDataUrl("");
    });

    return () => { cancelled = true; };
  }, [qrBusiness]);

  function openEdit(business: Business) {
    setEditing(business);
    setError("");
    setForm({ name: business.name, logo_url: business.logo_url || "", reward_target: business.reward_target || 10, reward_description: business.reward_description || "", active: business.active !== false });
    setShowModal(true);
  }

  async function saveBusiness() {
    if (isSaving) return;
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/businesses", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { ...form, id: editing.id } : form),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "No se pudo guardar el negocio.");
        return;
      }
      await loadBusinesses();
      setShowModal(false);
    } catch {
      setError("No se pudo guardar el negocio. Probá nuevamente.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleBusiness(business: Business) {
    const response = await fetch("/api/admin/businesses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...business, active: !business.active }),
    });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error || "No se pudo cambiar el estado.");
      return;
    }
    await loadBusinesses();
  }

  async function deleteBusiness(business: Business) {
    const response = await fetch("/api/admin/businesses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: business.id }),
    });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error || "No se pudo eliminar el negocio.");
      return;
    }
    await loadBusinesses();
  }

  // Solo se ejecuta la acción real (PUT/DELETE) cuando el usuario confirma en el modal.
  async function runConfirmedAction() {
    if (!confirmAction || isConfirming) return;
    setIsConfirming(true);
    try {
      if (confirmAction.type === "delete") await deleteBusiness(confirmAction.business);
      else await toggleBusiness(confirmAction.business);
    } finally {
      setIsConfirming(false);
      setConfirmAction(null);
    }
  }

  async function copyLink(id: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(""), 1800);
  }

  function downloadQr() {
    if (!qrDataUrl || !qrBusiness) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `qr-${qrBusiness.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    link.click();
  }

  const iconButton = "p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-[#FF1F2D] transition-colors";

  return (
    <div className="p-6 sm:p-10 max-w-6xl mx-auto font-sans">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestión de Negocios</h1>
          <p className="text-gray-500 text-sm mt-1.5 font-medium">
            {isLoading ? "Cargando comercios…" : `${businesses.length} ${businesses.length === 1 ? "comercio registrado" : "comercios registrados"}`}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre…"
              aria-label="Buscar negocio por nombre"
              className="w-full sm:w-64 rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[#FF1F2D] focus:ring-2 focus:ring-red-100"
            />
          </div>
          <Link href="/admin/crear-comercio" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF1F2D] px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-[#e01826]">
            <Plus size={18} /> Nuevo Negocio
          </Link>
        </div>
      </div>

      {error && !showModal && <div className="mb-5 rounded-xl bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm font-semibold">{error}</div>}

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
      ) : businesses.length === 0 ? (
        /* Empty state: no hay comercios */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-20 text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-[#FF1F2D]"><Store size={40} strokeWidth={1.6} /></div>
          <h2 className="text-xl font-bold text-gray-900">Todavía no hay comercios</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500">Creá el primer comercio para generar su cuenta, su link NFC y empezar a sumar clientes.</p>
          <Link href="/admin/crear-comercio" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#FF1F2D] px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-[#e01826]">
            <Plus size={18} /> Crear el primer negocio
          </Link>
        </div>
      ) : filteredBusinesses.length === 0 ? (
        /* Sin resultados de búsqueda */
        <div className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
          <Search size={32} className="mb-3 text-gray-300" />
          <p className="font-semibold text-gray-900">Sin resultados para &ldquo;{search}&rdquo;</p>
          <button onClick={() => setSearch("")} className="mt-3 text-sm font-semibold text-[#FF1F2D] hover:underline">Limpiar búsqueda</button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_130px_150px] gap-4 border-b border-gray-100 bg-gray-50 px-6 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">
            <span>Negocio</span><span>Link NFC</span><span>Estado</span><span className="text-right">Acciones</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {filteredBusinesses.map((business) => (
              <li key={business.id} className="grid grid-cols-1 gap-3 px-6 py-4 transition hover:bg-gray-50/70 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_130px_150px] md:items-center md:gap-4">
                {/* Negocio */}
                <div className="flex min-w-0 items-center gap-3">
                  {business.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={business.logo_url} alt={`Logo de ${business.name}`} className="h-11 w-11 shrink-0 rounded-xl border border-gray-200 object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-sm font-bold text-[#FF1F2D]">{initials(business.name)}</div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-gray-900">{business.name}</div>
                    <div className="truncate text-xs text-gray-500">{business.reward_target} sellos · {business.reward_description}</div>
                  </div>
                </div>

                {/* Link NFC */}
                <div className="flex min-w-0 items-center gap-1.5">
                  {business.nfcUrl ? (
                    <>
                      <code className="min-w-0 truncate rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-bold text-gray-700">{business.nfcId}</code>
                      <button onClick={() => copyLink(business.id, business.nfcUrl!)} className={iconButton} title={copiedId === business.id ? "Link copiado" : "Copiar enlace"} aria-label="Copiar enlace NFC">
                        {copiedId === business.id ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                      </button>
                      <button onClick={() => setQrBusiness(business)} className={iconButton} title="Ver QR" aria-label="Ver QR"><QrCode size={15} /></button>
                      <a href={business.nfcUrl} target="_blank" rel="noreferrer" className={iconButton} title="Probar link" aria-label="Probar link"><ExternalLink size={15} /></a>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">Sin tag NFC · se genera al editar y guardar</span>
                  )}
                </div>

                {/* Estado */}
                <div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${business.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    <span className={`h-2 w-2 rounded-full ${business.active ? "bg-green-500" : "bg-gray-400"}`} />{business.active ? "Activo" : "Inactivo"}
                  </span>
                </div>

                {/* Acciones */}
                <div className="flex gap-1 md:justify-end">
                  <button onClick={() => openEdit(business)} className={iconButton} title="Editar" aria-label="Editar"><Edit2 size={16} /></button>
                  <button onClick={() => setConfirmAction({ type: "toggle", business })} className={iconButton} title={business.active ? "Desactivar" : "Activar"} aria-label={business.active ? "Desactivar" : "Activar"}><Power size={16} /></button>
                  <button onClick={() => setConfirmAction({ type: "delete", business })} className={iconButton} title="Eliminar" aria-label="Eliminar"><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold text-gray-900">{editing ? "Editar negocio" : "Nuevo negocio"}</h2><button onClick={() => setShowModal(false)} disabled={isSaving} className="text-gray-400 hover:text-gray-600 disabled:opacity-40 p-1.5 rounded-lg hover:bg-gray-100"><X size={20} /></button></div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">Nombre del negocio<input disabled={isSaving} type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1.5 w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 disabled:opacity-60" placeholder="Ej: El Gran Café" /></label>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">URL del logo<input disabled={isSaving} type="text" value={form.logo_url || ""} onChange={e => setForm({ ...form, logo_url: e.target.value })} className="mt-1.5 w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 disabled:opacity-60" placeholder="Opcional" /></label>
            <div className="grid grid-cols-2 gap-4"><label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">Sello objetivo<input disabled={isSaving} type="number" min={1} value={form.reward_target} onChange={e => setForm({ ...form, reward_target: Number(e.target.value) })} className="mt-1.5 w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 disabled:opacity-60" /></label><label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">Recompensa<input disabled={isSaving} type="text" value={form.reward_description} onChange={e => setForm({ ...form, reward_description: e.target.value })} className="mt-1.5 w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 disabled:opacity-60" placeholder="Ej: Un café gratis" /></label></div>
            {editing && <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input disabled={isSaving} type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Comercio activo</label>}
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <button onClick={saveBusiness} disabled={isSaving} className="w-full bg-[#FF1F2D] text-white py-3 rounded-xl font-bold hover:bg-[#e01826] disabled:opacity-60 transition shadow-sm mt-2 flex items-center justify-center gap-2">{isSaving ? <><Loader2 size={18} className="animate-spin" /> Guardando…</> : <><Save size={18} /> Guardar y cerrar</>}</button>
          </div>
        </div>
      )}

      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onClick={() => { if (!isConfirming) setConfirmAction(null); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${confirmAction.type === "delete" ? "bg-red-50 text-[#FF1F2D]" : "bg-amber-50 text-amber-600"}`}>
                {confirmAction.type === "delete" ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div>
                <h2 id="confirm-title" className="text-lg font-bold text-gray-900">
                  {confirmAction.type === "delete" ? "Eliminar comercio" : "Cambiar estado"}
                </h2>
                <p className="mt-1.5 text-sm text-gray-600">
                  {confirmAction.type === "delete"
                    ? <>¿Estás seguro de que querés eliminar el comercio <strong className="text-gray-900">{confirmAction.business.name}</strong>? Esta acción borrará todos sus datos y no se puede deshacer.</>
                    : <>¿Estás seguro de que querés cambiar el estado de <strong className="text-gray-900">{confirmAction.business.name}</strong>?</>}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmAction(null)} disabled={isConfirming} className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50">
                Cancelar
              </button>
              <button
                type="button"
                onClick={runConfirmedAction}
                disabled={isConfirming}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:opacity-60 ${confirmAction.type === "delete" ? "bg-[#FF1F2D] hover:bg-[#e01826]" : "bg-gray-900 hover:bg-gray-800"}`}
              >
                {isConfirming && <Loader2 size={16} className="animate-spin" />}
                {confirmAction.type === "delete" ? "Eliminar" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {qrBusiness && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center">
            <div className="flex justify-between items-center text-left"><div><h2 className="text-xl font-bold text-gray-900">QR de {qrBusiness.name}</h2><p className="text-sm text-gray-500 mt-1">Mismo destino que el link NFC.</p></div><button onClick={() => setQrBusiness(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100" aria-label="Cerrar QR"><X size={20} /></button></div>
            <div className="my-6 min-h-[280px] flex items-center justify-center rounded-2xl bg-gray-50 border border-gray-100 p-5">{qrDataUrl ? <img src={qrDataUrl} alt={`QR de ${qrBusiness.name}`} className="w-64 h-64" /> : <Loader2 size={28} className="animate-spin text-gray-400" />}</div>
            <code className="block text-left break-all rounded-xl bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">{qrBusiness.nfcUrl}</code>
            <div className="flex gap-3 mt-5"><button type="button" onClick={downloadQr} disabled={!qrDataUrl} className="flex-1 rounded-xl bg-gray-900 text-white py-3 font-bold hover:bg-gray-800 disabled:opacity-50">Descargar QR</button><button type="button" onClick={() => setQrBusiness(null)} className="rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50">Cerrar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
