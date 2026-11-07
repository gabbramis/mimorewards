"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { startImpersonation } from "@/app/actions/impersonation";
import {
  Store,
  Search,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type PlanRank = "FREE" | "PRO" | "PREMIUM";

export const PLAN_LABELS: Record<PlanRank, string> = {
  FREE: "Free",
  PRO: "Pro",
  PREMIUM: "Premium",
};

export type BusinessItem = {
  id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  reward_target: number;
  reward_description: string;
  active: boolean;
  plan?: string | null;
  plan_type?: string | null;
  nfcId?: string | null;
  nfcUrl?: string | null;
  created_at?: string | null;
};

interface BusinessesListProps {
  initialBusinesses?: BusinessItem[];
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "?"
  );
}

function resolvePlanRank(business: BusinessItem): PlanRank {
  const p = (business.plan || "").trim().toUpperCase();
  const pt = (business.plan_type || "").trim().toLowerCase();
  if (p === "PRO" || pt === "pro") return "PRO";
  if (p === "BLACK" || p === "PREMIUM" || pt === "black" || pt === "premium") return "PREMIUM";
  return "FREE";
}

export default function BusinessesList({ initialBusinesses }: BusinessesListProps) {
  const router = useRouter();
  const supabase = createClient();
  const [businesses, setBusinesses] = useState<BusinessItem[]>(initialBusinesses || []);
  const [isLoading, setIsLoading] = useState(!initialBusinesses);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  // Copied link state
  const [copiedId, setCopiedId] = useState("");

  // QR Modal
  const [qrBusiness, setQrBusiness] = useState<BusinessItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  // Delete / Toggle Confirmation Modal
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete";
    business: BusinessItem;
  } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  // Cargar comercios
  const loadBusinesses = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/businesses", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) {
        setBusinesses(payload.businesses || []);
      } else {
        showToast(payload.error || "No se pudieron cargar los negocios.", "error");
      }
    } catch {
      showToast("No se pudieron cargar los negocios.", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialBusinesses) {
      loadBusinesses();
    }
  }, [initialBusinesses, loadBusinesses]);

  // Generar QR para el modal
  useEffect(() => {
    let cancelled = false;
    if (!qrBusiness?.nfcUrl) {
      setQrDataUrl("");
      return;
    }

    QRCode.toDataURL(qrBusiness.nfcUrl, {
      width: 720,
      margin: 3,
      errorCorrectionLevel: "H",
      color: { dark: "#09090b", light: "#FFFFFF" },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [qrBusiness]);

  // Filtrado en memoria
  const filteredBusinesses = useMemo(() => {
    const query = normalize(search);
    if (!query) return businesses;
    return businesses.filter(
      (b) => normalize(b.name).includes(query) || (b.slug && normalize(b.slug).includes(query))
    );
  }, [businesses, search]);

  // Métricas rápidas
  const counts = useMemo(() => {
    let active = 0;
    let free = 0;
    let pro = 0;
    let premium = 0;

    businesses.forEach((b) => {
      if (b.active) active++;
      const p = resolvePlanRank(b);
      if (p === "FREE") free++;
      else if (p === "PRO") pro++;
      else if (p === "PREMIUM") premium++;
    });

    return {
      total: businesses.length,
      active,
      inactive: businesses.length - active,
      free,
      pro,
      premium,
    };
  }, [businesses]);

  // 1. Toggle de Estado (Dispara actualización inmediata en Supabase)
  const handleToggleActive = async (business: BusinessItem) => {
    const newActive = !business.active;
    const prevActive = business.active;

    // Actualización optimista inmediata
    setBusinesses((prev) =>
      prev.map((b) => (b.id === business.id ? { ...b, active: newActive } : b))
    );
    setUpdatingId(business.id);

    try {
      const { error: supaError } = await supabase
        .from("businesses")
        .update({ active: newActive })
        .eq("id", business.id);

      if (supaError) {
        const res = await fetch("/api/admin/businesses", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: business.id, active: newActive }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || supaError.message);
        }
      }

      showToast(
        `Comercio "${business.name}" ${newActive ? "activado" : "desactivado"} correctamente.`,
        "success"
      );
    } catch (err: any) {
      setBusinesses((prev) =>
        prev.map((b) => (b.id === business.id ? { ...b, active: prevActive } : b))
      );
      showToast(err.message || "Error al actualizar el estado del comercio.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // 2. Selector de Plan (Mutación de columna `plan` en Supabase)
  const handlePlanChange = async (business: BusinessItem, newPlan: PlanRank) => {
    if (!business.active) {
      showToast("No se puede cambiar el plan de un comercio inactivo. Activalo primero.", "error");
      return;
    }

    const prevPlan = business.plan;
    const prevPlanType = business.plan_type;
    const dbPlan = newPlan === "PRO" ? "PRO" : newPlan === "PREMIUM" ? "BLACK" : "FREE";
    const newPlanType = newPlan === "PRO" ? "pro" : newPlan === "PREMIUM" ? "black" : "inicial";

    setBusinesses((prev) =>
      prev.map((b) =>
        b.id === business.id
          ? { ...b, plan: dbPlan, plan_type: newPlanType }
          : b
      )
    );
    setUpdatingId(business.id);

    try {
      const { error: supaError } = await supabase
        .from("businesses")
        .update({
          plan: dbPlan,
          plan_type: newPlanType,
        })
        .eq("id", business.id);

      if (supaError) {
        const res = await fetch("/api/admin/businesses", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: business.id,
            plan: dbPlan,
            plan_type: newPlanType,
          }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || supaError.message);
        }
      }

      showToast(
        `Plan de "${business.name}" actualizado a ${PLAN_LABELS[newPlan]} con éxito.`,
        "success"
      );
    } catch (err: any) {
      setBusinesses((prev) =>
        prev.map((b) =>
          b.id === business.id
            ? { ...b, plan: prevPlan, plan_type: prevPlanType }
            : b
        )
      );
      showToast(err.message || "Error al actualizar el plan del comercio.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Eliminar comercio confirmado
  const handleDeleteBusiness = async (business: BusinessItem) => {
    setIsConfirming(true);
    try {
      const response = await fetch("/api/admin/businesses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: business.id }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "No se pudo eliminar el negocio.");
      }
      setBusinesses((prev) => prev.filter((b) => b.id !== business.id));
      showToast(`Comercio "${business.name}" eliminado correctamente.`, "success");
    } catch (err: any) {
      showToast(err.message || "Error al eliminar el comercio.", "error");
    } finally {
      setIsConfirming(false);
      setConfirmAction(null);
    }
  };

  const copyLink = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(""), 1800);
    } catch {
      showToast("No se pudo copiar el link.", "error");
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl || !qrBusiness) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `qr-${qrBusiness.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    link.click();
  };

  const iconButton =
    "p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer";

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

      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Administración de Plataforma
          </span>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight mt-0.5">
            Gestión de Comercios
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Control de suscripciones, planes y estado operativo de comercios en Mimo Rewards.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Buscador */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o slug…"
              aria-label="Buscar comercio"
              className="w-full sm:w-64 rounded-xl border border-zinc-800 bg-zinc-900 pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-zinc-500 outline-none transition focus:border-white focus:ring-1 focus:ring-white"
            />
          </div>

          <Link
            href="/admin/crear-comercio"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-gray-200 shrink-0"
          >
            <Plus size={16} />
            <span>Nuevo Comercio</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards / Status Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Total Comercios
          </span>
          <p className="text-2xl font-semibold text-white mt-1">{counts.total}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">En la plataforma</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Comercios Activos
          </span>
          <p className="text-2xl font-semibold text-white mt-1">{counts.active}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {counts.inactive} inactivos o pausados
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Planes PRO
          </span>
          <p className="text-2xl font-semibold text-white mt-1">{counts.pro}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Suscripciones Pro activas</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Planes Premium
          </span>
          <p className="text-2xl font-semibold text-white mt-1">{counts.premium}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Nivel VIP Premium</p>
        </div>
      </div>

      {/* Tabla de Comercios */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-zinc-900 rounded-2xl border border-zinc-800">
          <Loader2 className="animate-spin text-white mb-3" size={28} />
          <p className="text-xs font-medium text-zinc-400">Cargando comercios registrados…</p>
        </div>
      ) : businesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 px-6 py-20 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400">
            <Store size={32} strokeWidth={1.6} />
          </div>
          <h2 className="text-lg font-semibold text-white">Todavía no hay comercios</h2>
          <p className="mt-2 max-w-sm text-sm text-zinc-400">
            Creá el primer comercio para generar su cuenta, su link NFC y empezar a sumar clientes.
          </p>
          <Link
            href="/admin/crear-comercio"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-gray-200"
          >
            <Plus size={16} /> Crear el primer negocio
          </Link>
        </div>
      ) : filteredBusinesses.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-zinc-800 bg-zinc-900 px-6 py-16 text-center">
          <Search size={32} className="mb-3 text-zinc-500" />
          <p className="font-semibold text-white">Sin resultados para &ldquo;{search}&rdquo;</p>
          <button
            onClick={() => setSearch("")}
            className="mt-3 text-xs font-medium text-zinc-400 hover:text-white underline cursor-pointer"
          >
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs min-w-[780px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 font-medium uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-5 whitespace-nowrap">Comercio</th>
                  <th className="py-3.5 px-5 whitespace-nowrap">Link NFC</th>
                  <th className="py-3.5 px-5 whitespace-nowrap">Estado</th>
                  <th className="py-3.5 px-5 whitespace-nowrap">Plan de Suscripción</th>
                  <th className="py-3.5 px-5 whitespace-nowrap text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredBusinesses.map((business) => {
                  const currentPlan = resolvePlanRank(business);
                  const isInactive = !business.active;
                  const isBusy = updatingId === business.id;

                  return (
                    <tr
                      key={business.id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Comercio */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {business.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={business.logo_url}
                              alt={`Logo de ${business.name}`}
                              className="h-10 w-10 shrink-0 rounded-xl border border-zinc-800 object-cover bg-zinc-950"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-xs font-semibold text-white border border-zinc-800">
                              {initials(business.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white truncate">
                                {business.name}
                              </span>
                              {business.slug && (
                                <span className="font-mono text-[10px] text-zinc-400 bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 rounded">
                                  /{business.slug}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                              {business.reward_target} sellos · {business.reward_description}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Link NFC */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {business.nfcUrl ? (
                            <>
                              <code className="truncate max-w-[120px] rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] font-mono text-zinc-300">
                                {business.nfcId}
                              </code>
                              <button
                                type="button"
                                onClick={() => copyLink(business.id, business.nfcUrl!)}
                                className={iconButton}
                                title={copiedId === business.id ? "¡Copiado!" : "Copiar enlace NFC"}
                                aria-label="Copiar enlace NFC"
                              >
                                {copiedId === business.id ? (
                                  <Check size={14} className="text-emerald-400" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setQrBusiness(business)}
                                className={iconButton}
                                title="Ver código QR"
                                aria-label="Ver código QR"
                              >
                                <QrCode size={14} />
                              </button>
                              <a
                                href={business.nfcUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={iconButton}
                                title="Probar link NFC"
                                aria-label="Probar link NFC"
                              >
                                <ExternalLink size={14} />
                              </a>
                            </>
                          ) : (
                            <span className="text-[11px] text-zinc-500 italic">
                              Sin tag NFC
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Toggle de Estado (Switch Reactivo) */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={business.active}
                            disabled={isBusy}
                            onClick={() => handleToggleActive(business)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-white ${
                              business.active ? "bg-emerald-500" : "bg-zinc-700"
                            } ${isBusy ? "opacity-60 cursor-wait" : ""}`}
                            title={
                              business.active
                                ? "Clic para pausar comercio"
                                : "Clic para activar comercio"
                            }
                          >
                            <span className="sr-only">Toggle estado activo</span>
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white ring-0 transition duration-200 ease-in-out ${
                                business.active ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>

                          <span
                            className={`text-xs font-medium ${
                              business.active ? "text-emerald-400" : "text-zinc-500"
                            }`}
                          >
                            {business.active ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </td>

                      {/* Selector de Plan */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="relative inline-flex items-center">
                            <select
                              value={currentPlan}
                              disabled={isInactive || isBusy}
                              onChange={(e) =>
                                handlePlanChange(business, e.target.value as PlanRank)
                              }
                              className={`rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-all appearance-none pr-7 outline-none focus:ring-1 focus:ring-white ${
                                isInactive
                                  ? "opacity-50 cursor-not-allowed text-zinc-500 select-none"
                                  : "cursor-pointer hover:border-zinc-700"
                              }`}
                              title={
                                isInactive
                                  ? "Comercio inactivo: activalo para cambiar de plan"
                                  : `Plan asignado: ${PLAN_LABELS[currentPlan]}. Clic para cambiar.`
                              }
                            >
                              <option value="FREE" className="bg-zinc-900 text-white">
                                Free
                              </option>
                              <option value="PRO" className="bg-zinc-900 text-white">
                                Pro
                              </option>
                              <option value="PREMIUM" className="bg-zinc-900 text-white">
                                Premium
                              </option>
                            </select>

                            {isInactive ? (
                              <Lock
                                size={12}
                                className="absolute right-2.5 pointer-events-none text-zinc-500"
                              />
                            ) : (
                              <ChevronDown
                                size={13}
                                className="absolute right-2.5 pointer-events-none text-zinc-400"
                              />
                            )}
                          </div>

                          {isInactive && (
                            <span className="text-[10px] text-zinc-500 font-medium hidden lg:inline">
                              (Bloqueado)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            disabled={impersonatingId === business.id}
                            onClick={async () => {
                              setImpersonatingId(business.id);
                              try {
                                const res = await startImpersonation(business.id);
                                if (res.ok && res.redirectUrl) {
                                  router.push(res.redirectUrl);
                                } else {
                                  showToast(res.error || "No se pudo entrar al comercio.", "error");
                                  setImpersonatingId(null);
                                }
                              } catch {
                                showToast("Error al iniciar modo administrador.", "error");
                                setImpersonatingId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 hover:bg-white hover:text-black transition-colors cursor-pointer disabled:opacity-50"
                            title={`Entrar como ${business.name}`}
                          >
                            {impersonatingId === business.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <ExternalLink size={13} />
                            )}
                            <span>Entrar como comercio</span>
                          </button>
                          <Link
                            href={`/admin/negocios/${business.id}`}
                            className={iconButton}
                            title={`Editar detalles de ${business.name}`}
                            aria-label={`Editar ${business.name}`}
                          >
                            <Edit2 size={15} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ type: "delete", business })}
                            className={iconButton}
                            title="Eliminar comercio"
                            aria-label="Eliminar comercio"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer de resumen */}
          <div className="border-t border-zinc-800 bg-zinc-950 px-5 py-3 text-xs text-zinc-500 flex items-center justify-between">
            <span>
              Mostrando {filteredBusinesses.length} de {businesses.length} comercios
            </span>
            <span className="font-medium text-zinc-400">
              {counts.active} activos · {counts.inactive} inactivos
            </span>
          </div>
        </div>
      )}

      {/* MODAL: Código QR NFC */}
      {qrBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 relative">
            <button
              type="button"
              onClick={() => setQrBusiness(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <X size={18} />
            </button>
            <div className="text-center">
              <h3 className="text-base font-semibold text-white">{qrBusiness.name}</h3>
              <p className="text-xs text-zinc-400 mt-1">Escaneá para probar el link de registro</p>
              {qrDataUrl ? (
                <div className="mt-4 flex justify-center">
                  <div data-qr-box="true" className="bg-white rounded-xl p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrDataUrl}
                      alt={`QR de ${qrBusiness.name}`}
                      className="h-52 w-52 rounded-lg"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-56 w-56 items-center justify-center mx-auto my-4 text-zinc-400">
                  <Loader2 className="animate-spin" size={24} />
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={downloadQr}
                  className="flex-1 rounded-xl bg-white py-2.5 text-xs font-semibold text-black hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Descargar PNG
                </button>
                <button
                  type="button"
                  onClick={() => setQrBusiness(null)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar eliminación */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 relative">
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-2">
                <AlertTriangle size={22} />
              </div>
              <h3 className="text-base font-semibold text-white">¿Eliminar este comercio?</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Estás por eliminar <strong className="text-white">{confirmAction.business.name}</strong>. Esta acción
              eliminará su vinculación con clientes y tarjetas emitidas.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isConfirming}
                onClick={() => setConfirmAction(null)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isConfirming}
                onClick={() => handleDeleteBusiness(confirmAction.business)}
                className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black hover:bg-gray-200 transition-colors"
              >
                {isConfirming ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
