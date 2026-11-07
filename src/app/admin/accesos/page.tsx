"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Mail,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from "lucide-react";
import {
  getAdminWhitelist,
  grantAdminAccess,
  revokeAdminAccess,
  type AdminWhitelistEntry,
} from "@/app/actions/admin-whitelist";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("es-UY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AdminAccesosPage() {
  const [entries, setEntries] = useState<AdminWhitelistEntry[]>([]);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadWhitelist = useCallback(async () => {
    setIsLoading(true);
    const res = await getAdminWhitelist();
    if (res.error) {
      showToast(res.error, "error");
    } else {
      setEntries(res.entries);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadWhitelist();
  }, [loadWhitelist]);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await grantAdminAccess(email);
      if (!res.ok || !res.entry) {
        showToast(res.error || "No se pudo conceder el acceso.", "error");
      } else {
        setEntries((prev) => [res.entry!, ...prev]);
        setEmail("");
        showToast(`Acceso concedido a ${res.entry.email}.`, "success");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (entry: AdminWhitelistEntry) => {
    if (revokingId) return;
    setRevokingId(entry.id);
    try {
      const res = await revokeAdminAccess(entry.id);
      if (!res.ok) {
        showToast(res.error || "No se pudo revocar el acceso.", "error");
      } else {
        setEntries((prev) => prev.filter((item) => item.id !== entry.id));
        showToast(`Acceso revocado para ${entry.email}.`, "success");
      }
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto font-sans space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 border text-sm font-semibold transition-all bg-zinc-900 text-white ${
            toast.type === "success"
              ? "border-emerald-500/40"
              : "border-red-500/40"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-red-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Encabezado */}
      <div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          Seguridad y Permisos
        </span>
        <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight mt-0.5">
          Accesos del Equipo (Super Admin)
        </h1>
        <p className="text-zinc-400 text-xs sm:text-sm mt-1">
          Gestioná la whitelist de correos autorizados a ingresar al panel de Super Administración con Google.
        </p>
      </div>

      {/* Formulario para conceder acceso */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <ShieldCheck size={17} className="text-zinc-400" />
          <span>Agregar nuevo Super Administrador</span>
        </h2>
        <form onSubmit={handleGrant} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              placeholder="correo@ejemplo.com"
              aria-label="Correo electrónico del nuevo administrador"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-white focus:ring-1 focus:ring-white"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !email.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50 cursor-pointer shrink-0"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Guardando…</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>Conceder Acceso</span>
              </>
            )}
          </button>
        </form>
      </section>

      {/* Tabla de Administradores Actuales */}
      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 bg-zinc-950 px-5 py-3.5 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            Administradores con Acceso ({entries.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="animate-spin text-white mb-2.5" size={24} />
            <p className="text-xs font-medium text-zinc-400">Cargando whitelist de administradores…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-white">No hay correos en la whitelist</p>
            <p className="text-xs text-zinc-400 mt-1">
              Usá el formulario superior para conceder acceso al primer Super Administrador.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs min-w-[540px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 font-medium uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-5 whitespace-nowrap">Correo Electrónico</th>
                  <th className="py-3 px-5 whitespace-nowrap">Fecha de Creación</th>
                  <th className="py-3 px-5 whitespace-nowrap text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {entries.map((entry) => {
                  const isRevoking = revokingId === entry.id;
                  return (
                    <tr key={entry.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white font-semibold text-xs border border-zinc-800">
                            {entry.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-white text-xs sm:text-sm">
                            {entry.email}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-zinc-400 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar size={13} className="text-zinc-500" />
                          {formatDateTime(entry.created_at)}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isRevoking}
                          onClick={() => handleRevoke(entry)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                          title={`Revocar acceso de ${entry.email}`}
                          aria-label={`Revocar acceso de ${entry.email}`}
                        >
                          {isRevoking ? (
                            <Loader2 size={14} className="animate-spin text-red-400" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          <span>Revocar acceso</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
