"use client";

import React, { useState, useTransition, useEffect } from "react";
import {
  Clock,
  Send,
  AlertCircle,
  CheckCircle2,
  StopCircle,
  Smartphone,
  Search,
  RefreshCw,
  Users,
  Sliders,
  Check,
  Eye,
  Gift,
  HeartHandshake,
  Info,
  ShieldAlert,
} from "lucide-react";
import { type PushQuotaInfo } from "@/lib/push-quota";

export interface CampaignLogItem {
  id: string;
  campaign_type: string;
  message: string;
  apple_devices_notified: number;
  google_passes_notified: number;
  created_at: string;
}

export interface BusinessData {
  id: string;
  name: string;
  stampMultiplier: number;
  activeCampaignName: string | null;
  activeCampaignMessage: string | null;
  campaignExpiresAt: string | null;
  isCampaignActive: boolean;
}

export interface AudienceData {
  appleDevices: number;
  googlePasses: number;
  totalCustomers: number;
}

export interface AutomationsState {
  inactive_customer: boolean;
  near_reward: boolean;
}

interface MerchantAutomationsClientProps {
  businessId: string;
  businessName: string;
  initialBusiness: BusinessData;
  initialAudience: AudienceData;
  initialAutomations: AutomationsState;
  initialQuota: PushQuotaInfo;
  initialHistory: CampaignLogItem[];
}

export default function MerchantAutomationsClient({
  businessId,
  businessName,
  initialBusiness,
  initialAudience,
  initialAutomations,
  initialQuota,
  initialHistory,
}: MerchantAutomationsClientProps) {
  const [business, setBusiness] = useState<BusinessData>(initialBusiness);
  const [audience, setAudience] = useState<AudienceData>(initialAudience);
  const [automations, setAutomations] = useState<AutomationsState>(initialAutomations);
  const [quota, setQuota] = useState<PushQuotaInfo>(initialQuota);
  const [history, setHistory] = useState<CampaignLogItem[]>(initialHistory);

  const [, startTransition] = useTransition();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Plantillas estrictamente ligadas a la tarjeta (sin opciones sueltas no permitidas por Apple)
  const quickTemplates = [
    {
      id: "beneficio_tarjeta",
      title: "Beneficio en tu tarjeta",
      text: "¡Hoy tenés un beneficio sorpresa mostrando tu tarjeta en el local!",
      tag: "Beneficio en tarjeta",
      allowedApple: true,
    },
    {
      id: "recordatorio_sellos",
      title: "Recordatorio de sellos",
      text: "¡Pasate hoy a sumar sellos y acercate a tu próximo premio!",
      tag: "Sellos y meta",
      allowedApple: true,
    },
  ];

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(quickTemplates[0].id);
  const [customPushMessage, setCustomPushMessage] = useState<string>(quickTemplates[0].text);
  const [selectedChannel, setSelectedChannel] = useState<"all" | "google_only">("all");
  const [previewPlatform, setPreviewPlatform] = useState<"apple" | "google">("google");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("15:42");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setCurrentTimeStr(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const showNotification = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback(null);
    }, 5500);
  };

  const reloadData = async () => {
    try {
      const res = await fetch(`/api/comercio/${businessId}/automations`);
      if (res.ok) {
        const data = await res.json();
        if (data.business) setBusiness(data.business);
        if (data.audience) setAudience(data.audience);
        if (data.automations) {
          setAutomations({
            inactive_customer: Boolean(data.automations.inactive_customer),
            near_reward: Boolean(data.automations.near_reward),
          });
        }
        if (data.quota) setQuota(data.quota);
        if (data.history) setHistory(data.history);
      }
    } catch (err) {
      console.error("Error recargando datos de automatizaciones:", err);
    }
  };

  // Lanzar Campaña o Mensaje Manual
  const handleLaunchCampaign = async (
    type: "2X_WEEKEND" | "HAPPY_HOUR" | "QUICK_PROMO",
    customText?: string
  ) => {
    if (!quota.canSendNow) {
      showNotification("error", "No es posible realizar envíos en este momento debido al límite semanal o tiempo de espera.");
      return;
    }

    setActionLoading(type);
    try {
      const res = await fetch(`/api/comercio/${businessId}/automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignType: type,
          message: customText || undefined,
          targetChannels: type === "QUICK_PROMO" ? selectedChannel : "all",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.quota) setQuota(data.quota);
        throw new Error(data.error || "No se pudo activar la campaña.");
      }

      showNotification(
        "success",
        `¡Notificación transmitida con éxito! ${data.result?.appleSent || 0} dispositivos Apple y ${data.result?.googleSent || 0} pases Google actualizados.`
      );
      await reloadData();
    } catch (err: any) {
      showNotification("error", err.message || "Error al procesar la campaña.");
    } finally {
      setActionLoading(null);
    }
  };

  // Finalizar Promoción Activa
  const handleCancelCampaign = async () => {
    if (!confirm("¿Deseas finalizar la promoción activa y regresar a 1 sello por visita?")) {
      return;
    }
    setActionLoading("CANCEL");
    try {
      const res = await fetch(`/api/comercio/${businessId}/automations`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo finalizar la promoción.");
      }

      showNotification("success", "La promoción finalizó y las visitas volvieron a sumar 1 sello.");
      await reloadData();
    } catch (err: any) {
      showNotification("error", err.message || "Error al finalizar la promoción.");
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle de Reglas Automáticas
  const handleToggleAutomation = async (type: "inactive_customer" | "near_reward") => {
    const nextValue = !automations[type];
    setAutomations((prev) => ({ ...prev, [type]: nextValue }));
    setActionLoading(`TOGGLE_${type}`);

    try {
      const res = await fetch(`/api/comercio/${businessId}/automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_automation",
          type,
          enabled: nextValue,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAutomations((prev) => ({ ...prev, [type]: !nextValue }));
        throw new Error(data.error || "No se pudo actualizar la regla.");
      }

      showNotification(
        "success",
        nextValue
          ? `Automatización "${type === "inactive_customer" ? "Te extrañamos" : "A 1 sello de tu premio"}" activada.`
          : `Automatización pausada.`
      );
    } catch (err: any) {
      showNotification("error", err.message || "Error al cambiar automatización.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectTemplate = (tpl: typeof quickTemplates[0]) => {
    setSelectedTemplateId(tpl.id);
    setCustomPushMessage(tpl.text);
  };

  const filteredHistory = history.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.campaign_type.toLowerCase().includes(term) ||
      item.message.toLowerCase().includes(term)
    );
  });

  const formatExpiryTime = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleString("es-AR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const formatNextAvailable = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }) + " hs";
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F5] text-[#1F1F1F] p-4 md:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-8">
        {/* Toast flotante */}
        {feedback && (
          <div
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl transition-all animate-in fade-in slide-in-from-top-3 ${
              feedback.type === "success"
                ? "bg-[#10B981] text-white"
                : "bg-[#FF1F2D] text-white"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm font-medium">{feedback.text}</span>
          </div>
        )}

        {/* Encabezado Principal y Resumen de Audiencia (SIN badges superiores) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2 border-b border-[#D5CFC4]">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1F1F1F]">
              Automatizaciones
            </h1>
            <p className="text-sm text-[#737373] mt-1 max-w-2xl">
              Activá sellos dobles en un clic o configurá avisos automáticos para las tarjetas de tus clientes.
            </p>
          </div>

          {/* Tarjetas KPI de Audiencia */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white border border-[#D5CFC4] rounded-xl px-4 py-2.5 shadow-sm min-w-[120px]">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-black" />
                Apple Wallet
              </div>
              <div className="text-xl font-bold text-[#1F1F1F] mt-0.5 tabular-nums">
                {audience.appleDevices}
              </div>
              <div className="text-[10px] text-[#737373]">Dispositivos activos</div>
            </div>

            <div className="bg-white border border-[#D5CFC4] rounded-xl px-4 py-2.5 shadow-sm min-w-[120px]">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#4285F4]" />
                Google Wallet
              </div>
              <div className="text-xl font-bold text-[#1F1F1F] mt-0.5 tabular-nums">
                {audience.googlePasses}
              </div>
              <div className="text-[10px] text-[#737373]">Pases instalados</div>
            </div>

            <div className="bg-white border border-[#D5CFC4] rounded-xl px-4 py-2.5 shadow-sm min-w-[120px]">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#10B981]" />
                Total Clientes
              </div>
              <div className="text-xl font-bold text-[#1F1F1F] mt-0.5 tabular-nums">
                {audience.totalCustomers}
              </div>
              <div className="text-[10px] text-[#10B981] font-medium">100% alcance directo</div>
            </div>

            <button
              onClick={reloadData}
              title="Refrescar métricas y estado"
              className="p-2.5 bg-white border border-[#D5CFC4] hover:bg-[#FFF9F5] text-[#737373] hover:text-[#1F1F1F] rounded-xl transition-all shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CAJA DE ESTADO DE PROMOCIÓN ACTIVA */}
        {business.isCampaignActive ? (
          <div className="relative overflow-hidden bg-gradient-to-r from-[#FFF0F1] via-white to-[#FFF9F5] border-2 border-[#FF1F2D] rounded-2xl p-6 shadow-md transition-all">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#10B981]" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#10B981] bg-[#ECFDF5] px-2.5 py-0.5 rounded-full border border-[#A7F3D0]">
                    Promoción activa en curso
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#FF1F2D] bg-[#FFF0F1] px-2.5 py-0.5 rounded-full border border-[#FFD0D4]">
                    2 sellos por visita
                  </span>
                </div>

                <h2 className="text-xl md:text-2xl font-bold text-[#1F1F1F]">
                  {business.activeCampaignName || "Promoción de sellos dobles"}
                </h2>

                <p className="text-sm text-[#4A4A4A] max-w-2xl bg-white/70 p-2.5 rounded-lg border border-[#D5CFC4]">
                  <strong className="text-[#1F1F1F]">Mensaje en la tarjeta:</strong> &ldquo;{business.activeCampaignMessage}&rdquo;
                </p>

                <div className="flex items-center gap-2 text-xs text-[#737373]">
                  <Clock className="w-4 h-4 text-[#FF1F2D]" />
                  <span>
                    Finaliza automáticamente:{" "}
                    <strong className="text-[#1F1F1F]">
                      {formatExpiryTime(business.campaignExpiresAt)}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={handleCancelCampaign}
                  disabled={actionLoading === "CANCEL"}
                  className="flex items-center gap-2 px-5 py-3 bg-[#FF1F2D] hover:bg-[#E01522] text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-[#FF1F2D]/20 active:scale-95 disabled:opacity-50"
                >
                  <StopCircle className="w-4 h-4" />
                  {actionLoading === "CANCEL" ? "Finalizando..." : "Finalizar ahora (volver a 1 sello por visita)"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#D5CFC4] rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="text-sm font-semibold text-[#1F1F1F]">
                No hay ninguna promoción activa en este momento
              </h3>
              <p className="text-xs text-[#737373] mt-0.5">
                Tus clientes suman 1 sello por visita. Podés activar el 2x1 del finde o un Happy Hour abajo.
              </p>
            </div>
            <div className="text-xs text-[#737373] bg-[#FFF9F5] px-3.5 py-1.5 rounded-lg border border-[#D5CFC4] whitespace-nowrap">
              <strong className="text-[#1F1F1F]">1 sello por visita</strong>
            </div>
          </div>
        )}

        {/* PROMOCIONES DE SELLOS DOBLES (Sin ícono rayo) */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#1F1F1F]">
              Promociones de sellos dobles
            </h2>
            <p className="text-xs text-[#737373] mt-0.5">
              Activá el 2x1 en sellos con un clic y actualizá las tarjetas de tus clientes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Tarjeta A: Finde de 2x1 en Sellos */}
            <div className="bg-white border border-[#D5CFC4] hover:border-[#FFD0D4] rounded-2xl p-6 shadow-sm transition-all hover:shadow-md flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#FFF0F1] text-[#FF1F2D] border border-[#FFD0D4]">
                    Doble sello · Fin de semana
                  </span>
                  <span className="text-[11px] font-medium text-[#737373]">
                    Hasta el domingo 23:59
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#1F1F1F]">Finde de 2x1 en Sellos</h3>
                  <p className="text-xs text-[#737373] mt-1">
                    Cada visita suma 2 sellos durante todo el fin de semana y actualiza la tarjeta de tus clientes.
                  </p>
                </div>

                <div className="bg-[#FFF9F5] border border-[#D5CFC4] rounded-xl p-3 text-xs text-[#4A4A4A] italic">
                  &ldquo;¡Finde 2x1 en {businessName}! Todas tus visitas de este fin de semana suman doble sello.&rdquo;
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-[#D5CFC4] flex items-center justify-between gap-3">
                <div className="text-[11px] text-[#737373]">
                  Beneficio: <strong className="text-[#FF1F2D]">Doble sello</strong>
                </div>
                <button
                  onClick={() => handleLaunchCampaign("2X_WEEKEND")}
                  disabled={
                    Boolean(actionLoading) ||
                    (business.isCampaignActive && business.activeCampaignName?.includes("Finde")) ||
                    !quota.canSendNow
                  }
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#FF1F2D] hover:bg-[#E01522] text-white rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {actionLoading === "2X_WEEKEND"
                    ? "Activando..."
                    : business.isCampaignActive && business.activeCampaignName?.includes("Finde")
                    ? "Promoción Activa"
                    : "Activar Finde 2x1"}
                </button>
              </div>
            </div>

            {/* Tarjeta B: Happy Hour de Sellos (4 horas) */}
            <div className="bg-white border border-[#D5CFC4] hover:border-[#FFD0D4] rounded-2xl p-6 shadow-sm transition-all hover:shadow-md flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#FFF0F1] text-[#FF1F2D] border border-[#FFD0D4]">
                    Flash 4 Horas · Doble sello
                  </span>
                  <span className="text-[11px] font-medium text-[#737373]">
                    Duración: 4 horas exactas
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#1F1F1F]">Happy Hour de Sellos (4 horas)</h3>
                  <p className="text-xs text-[#737373] mt-1">
                    Ideal para horarios de menor afluencia. Activa 2 sellos por visita por 4 horas y notifica en el acto.
                  </p>
                </div>

                <div className="bg-[#FFF9F5] border border-[#D5CFC4] rounded-xl p-3 text-xs text-[#4A4A4A] italic">
                  &ldquo;¡Happy Hour en {businessName}! Pasate en las próximas 4 horas y sumá doble sello.&rdquo;
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-[#D5CFC4] flex items-center justify-between gap-3">
                <div className="text-[11px] text-[#737373]">
                  Beneficio: <strong className="text-[#FF1F2D]">Doble sello</strong>
                </div>
                <button
                  onClick={() => handleLaunchCampaign("HAPPY_HOUR")}
                  disabled={
                    Boolean(actionLoading) ||
                    (business.isCampaignActive && business.activeCampaignName?.includes("Happy Hour")) ||
                    !quota.canSendNow
                  }
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#FF1F2D] hover:bg-[#E01522] text-white rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {actionLoading === "HAPPY_HOUR"
                    ? "Activando..."
                    : business.isCampaignActive && business.activeCampaignName?.includes("Happy Hour")
                    ? "Promoción Activa"
                    : "Activar Happy Hour"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MENSAJES RÁPIDOS PARA TARJETAS CON SEPARACIÓN APPLE / GOOGLE Y LÍMITE ANTI-SPAM (Sin ícono campana) */}
        <div className="bg-white border border-[#D5CFC4] rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#1F1F1F]">
              Mensajes Rápidos
            </h2>
            <p className="text-xs text-[#737373] mt-0.5">
              Enviá avisos directos a Google Wallet o actualizá el estado de la tarjeta en Apple Wallet.
            </p>
          </div>

          {/* AVISO IMPORTANTE SOBRE POLÍTICAS DE APPLE WALLET */}
          <div className="bg-[#FFF9F5] border border-[#D5CFC4] rounded-xl p-4 flex items-start gap-3.5 text-xs text-[#4A4A4A]">
            <Info className="w-5 h-5 text-[#FF1F2D] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-[#1F1F1F] block text-sm">
                Importante en Apple Wallet:
              </strong>
              <p className="leading-relaxed">
                Apple solo envía notificaciones cuando cambia un dato de la tarjeta (sellos acumulados, premio o activación de sellos dobles). No permite enviar promociones ni mensajes sueltos.
              </p>
              <p className="text-[11px] text-[#737373] pt-0.5">
                • <strong>Google Wallet:</strong> Recibe el aviso como notificación directa en la pantalla de bloqueo.
                <br />
                • <strong>Apple Wallet:</strong> Actualiza los datos informativos del pase de tus clientes en su iPhone.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Columna Izquierda: Formulario, Selector de canal y Límite Semanal */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <label className="text-xs font-semibold text-[#737373] uppercase tracking-wider block mb-2">
                  1. Plantilla ligada a la tarjeta:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {quickTemplates.map((tpl) => {
                    const isSelected = selectedTemplateId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleSelectTemplate(tpl)}
                        className={`text-left p-3.5 rounded-xl border text-xs transition-all flex flex-col justify-between min-h-[95px] ${
                          isSelected
                            ? "bg-[#FFF0F1] border-[#FF1F2D] text-[#FF1F2D] shadow-sm ring-2 ring-[#FF1F2D]/20"
                            : "bg-white border-[#D5CFC4] hover:border-[#FFD0D4] text-[#1F1F1F]"
                        }`}
                      >
                        <div>
                          <span className="font-bold block text-[13px]">{tpl.title}</span>
                          <span className="text-[11px] text-[#737373] mt-1 block line-clamp-2">
                            {tpl.text}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold mt-2 opacity-80 uppercase tracking-wider">
                          {tpl.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector de Canal de Destino */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#737373] uppercase tracking-wider block">
                  2. Canal de destino:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedChannel("all");
                      setPreviewPlatform("google");
                    }}
                    className={`text-left p-3 rounded-xl border text-xs transition-all ${
                      selectedChannel === "all"
                        ? "bg-[#FFF0F1] border-[#FF1F2D] text-[#1F1F1F] ring-1 ring-[#FF1F2D]"
                        : "bg-white border-[#D5CFC4] text-[#737373] hover:text-[#1F1F1F]"
                    }`}
                  >
                    <div className="font-bold text-[#1F1F1F]">Google Wallet + Apple Wallet</div>
                    <div className="text-[10px] text-[#737373] mt-0.5">
                      Aviso en Android + Actualización en iPhone
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedChannel("google_only");
                      setPreviewPlatform("google");
                    }}
                    className={`text-left p-3 rounded-xl border text-xs transition-all ${
                      selectedChannel === "google_only"
                        ? "bg-[#FFF0F1] border-[#FF1F2D] text-[#1F1F1F] ring-1 ring-[#FF1F2D]"
                        : "bg-white border-[#D5CFC4] text-[#737373] hover:text-[#1F1F1F]"
                    }`}
                  >
                    <div className="font-bold text-[#1F1F1F]">Solo Google Wallet</div>
                    <div className="text-[10px] text-[#737373] mt-0.5">
                      Notificación directa a pantalla de Android
                    </div>
                  </button>
                </div>
              </div>

              {/* Textarea Editable */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#1F1F1F] block">
                    3. Texto del aviso (Editable):
                  </label>
                  <span className="text-[11px] text-[#737373] tabular-nums">
                    {customPushMessage.length} caracteres
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={customPushMessage}
                  onChange={(e) => setCustomPushMessage(e.target.value)}
                  placeholder="Escribí el mensaje para la tarjeta..."
                  className="w-full text-sm p-3.5 bg-[#FFF9F5] border border-[#D5CFC4] focus:border-[#FF1F2D] focus:ring-2 focus:ring-[#FF1F2D]/15 rounded-xl outline-none transition-all resize-none text-[#1F1F1F]"
                />
              </div>

              {/* CONTROL DE FRECUENCIA Y LÍMITE SEMANAL (Anti-Spam) */}
              <div className="bg-[#FFF9F5] border border-[#D5CFC4] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-[#1F1F1F]">
                    Envíos disponibles esta semana: {quota.availableThisWeek} de 2 (mínimo 3 días entre cada aviso)
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      quota.canSendNow
                        ? "bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]"
                        : "bg-[#FFF0F1] text-[#FF1F2D] border border-[#FFD0D4]"
                    }`}
                  >
                    {quota.canSendNow ? "Disponible para enviar" : "En período de espera"}
                  </span>
                </div>

                {!quota.canSendNow && (
                  <div className="flex items-start gap-2 text-xs text-[#FF1F2D] bg-white p-2.5 rounded-lg border border-[#FFD0D4]">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      {quota.cooldownHoursRemaining > 0 ? (
                        <span>
                          Debes esperar 72 horas (3 días) entre envíos masivos para proteger la experiencia de tus clientes. Próximo aviso disponible:{" "}
                          <strong>{formatNextAvailable(quota.nextAvailableAt)}</strong>.
                        </span>
                      ) : (
                        <span>
                          Alcanzaste el límite de 2 avisos manuales de esta semana. Próximo aviso disponible:{" "}
                          <strong>{formatNextAvailable(quota.nextAvailableAt)}</strong>.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Botón de Envío */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-2">
                <button
                  onClick={() => handleLaunchCampaign("QUICK_PROMO", customPushMessage)}
                  disabled={Boolean(actionLoading) || !customPushMessage.trim() || !quota.canSendNow}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#FF1F2D] hover:bg-[#E01522] text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-[#FF1F2D]/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {actionLoading === "QUICK_PROMO"
                    ? "Enviando..."
                    : quota.canSendNow
                    ? "Enviar Notificación"
                    : "Envío no disponible (esperar tiempo mínimo)"}
                </button>
              </div>
            </div>

            {/* Columna Derecha: Mockup Móvil de Pantalla de Bloqueo */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#FF1F2D]" />
                  Vista previa en pantalla de bloqueo
                </span>
                <div className="flex items-center bg-[#FFF9F5] border border-[#D5CFC4] rounded-lg p-0.5 text-[11px] font-medium">
                  <button
                    type="button"
                    onClick={() => setPreviewPlatform("google")}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      previewPlatform === "google"
                        ? "bg-[#FF1F2D] text-white shadow-sm font-bold"
                        : "text-[#737373] hover:text-[#1F1F1F]"
                    }`}
                  >
                    Google Wallet (Android)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPlatform("apple")}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      previewPlatform === "apple"
                        ? "bg-[#FF1F2D] text-white shadow-sm font-bold"
                        : "text-[#737373] hover:text-[#1F1F1F]"
                    }`}
                  >
                    Apple Wallet (iOS)
                  </button>
                </div>
              </div>

              {/* Teléfono simulado */}
              <div className="w-full max-w-[340px] bg-gradient-to-b from-neutral-900 via-neutral-950 to-black rounded-[36px] p-4 text-white shadow-2xl border-4 border-neutral-800 relative">
                {/* Dynamic Island / Notch */}
                <div className="flex justify-center mb-6">
                  <div className="w-24 h-5 bg-black rounded-full border border-neutral-800" />
                </div>

                {/* Reloj y Fecha */}
                <div className="text-center space-y-1 mb-8">
                  <div className="text-4xl font-bold tracking-tight font-sans">
                    {currentTimeStr}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-medium">
                    Hoy, {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                  </div>
                </div>

                {/* Banner de Notificación Push */}
                <div className="bg-white/95 backdrop-blur-md text-neutral-900 rounded-2xl p-3.5 shadow-lg border border-white/20 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-[#FF1F2D] text-white flex items-center justify-center text-[10px] font-black">
                        M
                      </div>
                      <span className="text-xs font-bold text-neutral-900">
                        {previewPlatform === "apple" ? "Apple Wallet" : "Google Wallet"}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-medium">ahora</span>
                  </div>

                  <div className="text-xs font-bold text-neutral-900">
                    {businessName}
                  </div>
                  <div className="text-xs text-neutral-700 mt-0.5 line-clamp-3 leading-relaxed">
                    {customPushMessage || "Tu mensaje aparecerá acá..."}
                  </div>
                </div>

                <div className="text-center text-[10px] text-neutral-500 mt-10 mb-2">
                  {previewPlatform === "apple"
                    ? "Apple Wallet actualiza el dato en la tarjeta del cliente"
                    : "Notificación directa en la pantalla de bloqueo de Android"}
                </div>
                {/* Home Indicator */}
                <div className="w-32 h-1 bg-white/40 rounded-full mx-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* AUTOMATIZACIONES POR CONDICIÓN (Reglas Siempre Activas) */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#1F1F1F] flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#FF1F2D]" />
              Automatizaciones por Condición (Reglas Siempre Activas)
            </h2>
            <p className="text-xs text-[#737373] mt-0.5">
              Estas reglas evalúan automáticamente las visitas de tus clientes y disparan avisos sin que tengas que intervenir.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Regla 1: Te extrañamos (Inactivos +30 días) */}
            <div className="bg-white border border-[#D5CFC4] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFF0F1] text-[#FF1F2D] flex items-center justify-center shrink-0">
                      <HeartHandshake className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1F1F1F]">
                        Te extrañamos (Inactivos +30 días)
                      </h3>
                      <span className="text-xs text-[#737373]">
                        Condición: 30 días sin visitas al local
                      </span>
                    </div>
                  </div>

                  {/* Switch Toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={automations.inactive_customer}
                    disabled={actionLoading === "TOGGLE_inactive_customer"}
                    onClick={() => handleToggleAutomation("inactive_customer")}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      automations.inactive_customer ? "bg-[#10B981]" : "bg-neutral-300"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        automations.inactive_customer ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-[#4A4A4A] leading-relaxed">
                  Envía un push automático a los clientes que cumplan 30 días sin visitas recordándoles sus sellos acumulados y beneficios para motivar su regreso.
                </p>

                <div className="bg-[#FFF9F5] border border-[#D5CFC4] rounded-xl p-3 text-xs text-[#737373]">
                  <strong className="text-[#1F1F1F] block mb-0.5">Mensaje automático configurado:</strong>
                  &ldquo;¡Te extrañamos en {businessName}! Pasate a sumar sellos y aprovechá tus beneficios exclusivos.&rdquo;
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[#D5CFC4] flex items-center justify-between text-xs">
                <span className="text-[#737373]">Canal: Apple & Google Wallet</span>
                <span
                  className={`font-semibold ${
                    automations.inactive_customer ? "text-[#10B981]" : "text-[#737373]"
                  }`}
                >
                  {automations.inactive_customer ? "● Activa y monitoreando" : "○ Pausada"}
                </span>
              </div>
            </div>

            {/* Regla 2: ¡A 1 sello de tu premio! */}
            <div className="bg-white border border-[#D5CFC4] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFF0F1] text-[#FF1F2D] flex items-center justify-center shrink-0">
                      <Gift className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1F1F1F]">
                        ¡A 1 sello de tu premio!
                      </h3>
                      <span className="text-xs text-[#737373]">
                        Condición: Falta 1 sello para completar tarjeta
                      </span>
                    </div>
                  </div>

                  {/* Switch Toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={automations.near_reward}
                    disabled={actionLoading === "TOGGLE_near_reward"}
                    onClick={() => handleToggleAutomation("near_reward")}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      automations.near_reward ? "bg-[#10B981]" : "bg-neutral-300"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        automations.near_reward ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-[#4A4A4A] leading-relaxed">
                  Envía un recordatorio automático a los clientes en cuanto registran el penúltimo sello, acelerando la frecuencia de visita para canjear la recompensa.
                </p>

                <div className="bg-[#FFF9F5] border border-[#D5CFC4] rounded-xl p-3 text-xs text-[#737373]">
                  <strong className="text-[#1F1F1F] block mb-0.5">Mensaje automático configurado:</strong>
                  &ldquo;¡Estás a solo 1 sello de tu recompensa en {businessName}! Pasá hoy a completar tu tarjeta.&rdquo;
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[#D5CFC4] flex items-center justify-between text-xs">
                <span className="text-[#737373]">Canal: Apple & Google Wallet</span>
                <span
                  className={`font-semibold ${
                    automations.near_reward ? "text-[#10B981]" : "text-[#737373]"
                  }`}
                >
                  {automations.near_reward ? "● Activa y monitoreando" : "○ Pausada"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* HISTORIAL DE ENVÍOS */}
        <div className="bg-white border border-[#D5CFC4] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#1F1F1F]">
                Historial de Notificaciones y Campañas Enviadas
              </h2>
              <p className="text-xs text-[#737373] mt-0.5">
                Registro de todas las transmisiones efectuadas a las billeteras de tus clientes.
              </p>
            </div>

            {/* Barra de búsqueda */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por campaña o texto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-3.5 py-2 bg-[#FFF9F5] border border-[#D5CFC4] rounded-xl focus:border-[#FF1F2D] outline-none text-[#1F1F1F]"
              />
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-[#737373] space-y-2">
              <p className="text-sm font-medium">Aún no se han enviado notificaciones push.</p>
              <p className="text-xs text-[#A09891]">
                Podés activar una promoción de sellos dobles o tus automatizaciones arriba.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#D5CFC4] text-[#737373] uppercase tracking-wider font-semibold text-[11px]">
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Campaña / Mensaje</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4 text-center">Apple Wallet</th>
                    <th className="py-3 px-4 text-center">Google Wallet</th>
                    <th className="py-3 px-4 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-[#D5CFC4]">
                  {filteredHistory.map((item) => {
                    const date = new Date(item.created_at);
                    const dateFormatted = date.toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    });
                    const timeFormatted = date.toLocaleTimeString("es-AR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <tr key={item.id} className="hover:bg-[#FFF9F5] transition-colors">
                        <td className="py-3.5 px-4 text-[#737373] whitespace-nowrap">
                          <div className="font-medium text-[#1F1F1F]">{dateFormatted}</div>
                          <div className="text-[10px]">{timeFormatted} hs</div>
                        </td>
                        <td className="py-3.5 px-4 max-w-md">
                          <div className="font-semibold text-[#1F1F1F] line-clamp-2">
                            {item.message}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF0F1] text-[#FF1F2D] border border-[#FFD0D4]">
                            {item.campaign_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums font-semibold text-[#1F1F1F]">
                          {item.apple_devices_notified}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums font-semibold text-[#1F1F1F]">
                          {item.google_passes_notified}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#10B981] bg-[#ECFDF5] px-2.5 py-1 rounded-full border border-[#A7F3D0]">
                            <Check className="w-3 h-3" />
                            Transmitido
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
