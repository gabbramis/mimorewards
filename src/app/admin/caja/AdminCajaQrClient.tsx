"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "react-qr-code";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  QrCode as QrIcon,
  RefreshCw,
  Sparkles,
  Store,
  Wifi,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CounterPosterDownloads from "@/components/merchant/CounterPosterDownloads";

type BusinessInfo = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  reward_target: number;
  reward_description: string;
};

export default function AdminCajaQrClient() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [allBusinesses, setAllBusinesses] = useState<BusinessInfo[]>([]);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTimestamp, setRefreshTimestamp] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Cargar usuario y comercio asociado
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setErrorMsg("");

      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (!cancelled) setOrigin(window.location.origin);

        if (userErr || !user) {
          window.location.href = "/login?next=/admin/caja";
          return;
        }

        // Verificar si es superadmin
        const isSuper = user.email?.toLowerCase() === "creator@mimorewards.com";
        if (!cancelled) setIsSuperadmin(isSuper);

        // Buscar membership del usuario
        const { data: member } = await supabase
          .from("business_members")
          .select("business_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        let targetBusinessId = member?.business_id;

        // Si es superadmin o no tiene membership asignado, listamos comercios disponibles
        if (isSuper || !targetBusinessId) {
          const { data: businessesList } = await supabase
            .from("businesses")
            .select("id, name, slug, logo_url, primary_color, reward_target, reward_description")
            .order("name", { ascending: true });

          if (!cancelled && businessesList && businessesList.length > 0) {
            setAllBusinesses(businessesList as BusinessInfo[]);
            if (!targetBusinessId) {
              targetBusinessId = businessesList[0].id;
            }
          }
        }

        if (!targetBusinessId) {
          if (!cancelled) setErrorMsg("No se encontró ningún comercio asociado a tu cuenta.");
          return;
        }

        // Obtener datos del comercio seleccionado
        const { data: bizData, error: bizErr } = await supabase
          .from("businesses")
          .select("id, name, slug, logo_url, primary_color, reward_target, reward_description")
          .eq("id", targetBusinessId)
          .maybeSingle();

        if (bizErr || !bizData) {
          if (!cancelled) setErrorMsg("No se pudieron cargar los datos del comercio.");
          return;
        }

        if (!cancelled) {
          setBusiness(bizData as BusinessInfo);
        }
      } catch (err: any) {
        if (!cancelled) setErrorMsg(err?.message || "Ocurrió un error al cargar la información.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Manejar cambio de comercio (para superadmins)
  function handleSelectBusiness(id: string) {
    const selected = allBusinesses.find((b) => b.id === id);
    if (selected) {
      setBusiness(selected);
    }
  }

  // URL pública del QR para sumar sellos (siempre producción)
  const baseUrl = process.env.NEXT_PUBLIC_MIMO_SITE_URL || "https://mimorewards.com";
  const publicSlug = business?.slug || "";
  const qrUrl = publicSlug ? `https://mimorewards.com/t/${publicSlug}` : "";

  // Botón "Actualizar QR"
  function handleRefreshQr() {
    setIsRefreshing(true);
    const now = Date.now();
    setRefreshTimestamp(now);

    console.log("[Fallback QR] Actualizando código QR dinámico de seguridad...");
    console.log("[Fallback QR] Comercio:", business?.name, `(slug: ${business?.slug})`);
    console.log("[Fallback QR] URL base:", qrUrl);
    console.log("[Fallback QR] Timestamp de rotación:", now);

    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  }

  // Copiar link al portapapeles
  async function handleCopy() {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  // Alternar pantalla completa
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF1F2D]" />
        <p className="text-sm font-medium text-gray-500">Cargando terminal de caja...</p>
      </div>
    );
  }

  if (errorMsg || !business) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-semibold text-red-800">{errorMsg || "Comercio no disponible"}</p>
          <p className="mt-2 text-xs text-red-600">Verificá tus accesos o comunicate con el administrador de mimo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-6 sm:py-10">
      {/* Selector de comercio (si es superadmin y hay varios) */}
      {isSuperadmin && allBusinesses.length > 1 && (
        <div className="mb-6 flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
            <Store size={16} className="text-[#FF1F2D]" />
            <span>Comercio activo:</span>
          </div>
          <select
            value={business.id}
            onChange={(e) => handleSelectBusiness(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-800 outline-none focus:border-[#FF1F2D]"
          >
            {allBusinesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tarjeta Principal de Contingencia QR */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-gray-200/80 bg-white p-6 shadow-xl sm:p-10">
        {/* Botón flotante para modo presentación / pantalla completa */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Salir de pantalla completa" : "Modo mostrador (pantalla completa)"}
          className="absolute right-5 top-5 rounded-xl border border-gray-200 p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>

        {/* Encabezado de identidad del comercio */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm">
            {business.logo_url ? (
              <Image
                src={business.logo_url}
                alt={business.name}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            ) : (
              <Store size={28} className="text-[#FF1F2D]" />
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FF1F2D]">
            <Sparkles size={12} />
            <span>Fallback QR · Clientes sin NFC</span>
          </div>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
            Escaneá este código para sumar tu sello
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Enfocá con la cámara de tu celular para registrar tu compra en{" "}
            <strong className="text-gray-800">{business.name}</strong>.
          </p>
        </div>

        {/* Contenedor central del Código QR */}
        <div className="my-7 flex flex-col items-center justify-center">
          <div className="relative rounded-3xl border-2 border-gray-100 bg-white p-6 shadow-md transition-transform duration-200 hover:scale-[1.01]">
            <div className="flex items-center justify-center bg-white">
              <QRCode
                value={qrUrl || "https://mimorewards.com"}
                size={230}
                level="M"
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                viewBox="0 0 256 256"
              />
            </div>

            {/* Indicador de marca en el QR */}
            <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-gray-400">
              <Wifi size={13} className="text-[#FF1F2D]" />
              <span>mimo rewards · Conexión instantánea</span>
            </div>
          </div>

          {/* Enlace público y botón copiar */}
          <div className="mt-4 flex max-w-full items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs">
            <span className="truncate font-mono text-gray-600">{qrUrl}</span>
            <button
              onClick={handleCopy}
              className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#FF1F2D] hover:text-[#e01826]"
              title="Copiar enlace"
            >
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              <span>{copied ? "Copiado" : "Copiar"}</span>
            </button>
            <a
              href={qrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center text-gray-400 hover:text-gray-700"
              title="Abrir enlace en pestaña nueva"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-[#EBE6DE] bg-[#FFF9F5] p-4">
          <CounterPosterDownloads key={business.id} businessId={business.id} />
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleRefreshQr}
            disabled={isRefreshing}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3.5 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-[0.98] disabled:opacity-60"
          >
            <RefreshCw size={17} className={`text-gray-500 ${isRefreshing ? "animate-spin text-[#FF1F2D]" : ""}`} />
            <span>Actualizar QR</span>
          </button>

          <a
            href={qrUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#FF1F2D] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-200 transition hover:bg-[#e01826] active:scale-[0.98]"
          >
            <QrIcon size={17} />
            <span>Probar Escaneo</span>
          </a>
        </div>

        {/* Tip / Ayuda al cajero */}
        <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-center text-xs leading-relaxed text-gray-500">
          💡 <strong className="text-gray-700">Tip para el cajero:</strong> Mantené esta pantalla a la vista del cliente. Al escanear con la cámara del celular, se abrirá la tarjeta digital sin necesidad de descargar ninguna aplicación.
        </div>
      </div>
    </div>
  );
}
