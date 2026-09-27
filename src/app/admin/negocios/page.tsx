"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Edit2, ExternalLink, Loader2, Plus, Power, QrCode, Save, Trash2, X } from "lucide-react";

type Business = {
  id: string;
  name: string;
  logo_url?: string | null;
  reward_target: number;
  reward_description: string;
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

  function openCreate() {
    setEditing(null);
    setError("");
    setForm(emptyForm);
    setShowModal(true);
  }

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
    if (!window.confirm(`¿Eliminar ${business.name}? También se eliminarán sus clientes y registros.`)) return;
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

  return (
    <div className="p-6 sm:p-10 max-w-6xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Negocios</h1>
          <p className="text-gray-500 text-sm mt-1.5 font-medium">Creá comercios y administrá el acceso NFC de cada uno.</p>
        </div>
        <button onClick={openCreate} disabled={isSaving} className="bg-black text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-gray-800 disabled:opacity-50 transition shadow-sm">
          <Plus size={18} /> Nuevo negocio
        </button>
      </div>

      {error && <div className="mb-5 rounded-xl bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm font-semibold">{error}</div>}

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[780px]">
              <thead><tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider"><th className="px-6 py-4 font-bold">Negocio</th><th className="px-6 py-4 font-bold">Programa</th><th className="px-6 py-4 font-bold">Link NFC / QR</th><th className="px-6 py-4 font-bold">Estado</th><th className="px-6 py-4 font-bold text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {businesses.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-500">No hay negocios registrados.</td></tr> : businesses.map((business) => (
                  <tr key={business.id} className="hover:bg-gray-50/80 transition">
                    <td className="px-6 py-5"><div className="font-semibold text-gray-900">{business.name}</div><div className="text-xs text-gray-400 mt-1">{business.id.slice(0, 8)}…</div></td>
                    <td className="px-6 py-5"><div className="text-sm font-semibold text-gray-700">{business.reward_target} sellos</div><div className="text-xs text-gray-500 mt-1 max-w-[180px] truncate">{business.reward_description}</div></td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <code className="rounded-lg bg-gray-50 border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-700">/api/tap?tag={business.nfcId || "pendiente"}</code>
                        {business.nfcUrl && <button onClick={() => copyLink(business.id, business.nfcUrl!)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" title={copiedId === business.id ? "Link copiado" : "Copiar link"}>{copiedId === business.id ? <><Check size={15} /><span className="sr-only">Copiado</span></> : <Copy size={15} />}</button>}
                        {business.nfcUrl && <button onClick={() => setQrBusiness(business)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" title="Ver QR"><QrCode size={15} /></button>}
                      </div>
                      <a href={business.nfcUrl || "#"} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800"><ExternalLink size={12} /> Probar link</a>
                    </td>
                    <td className="px-6 py-5"><button onClick={() => toggleBusiness(business)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${business.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}><span className={`h-2 w-2 rounded-full ${business.active ? "bg-green-500" : "bg-gray-400"}`} />{business.active ? "Activo" : "Inactivo"}</button></td>
                    <td className="px-6 py-5 text-right"><div className="flex justify-end gap-1"><button onClick={() => toggleBusiness(business)} className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600" title={business.active ? "Desactivar" : "Activar"}><Power size={16} /></button><button onClick={() => openEdit(business)} className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600" title="Editar"><Edit2 size={16} /></button><button onClick={() => deleteBusiness(business)} className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600" title="Eliminar"><Trash2 size={16} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <button onClick={saveBusiness} disabled={isSaving} className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-60 transition shadow-sm mt-2 flex items-center justify-center gap-2">{isSaving ? <><Loader2 size={18} className="animate-spin" /> Guardando…</> : <><Save size={18} /> Guardar y cerrar</>}</button>
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
