"use client";

import React, { useState, useTransition } from "react";
import {
  Rocket,
  Zap,
  Bell,
  Clock,
  Sparkles,
  Send,
  AlertCircle,
  CheckCircle2,
  StopCircle,
  Smartphone,
  ChevronRight,
  ShieldCheck,
  Search,
  RefreshCw,
  Flame,
  Calendar,
} from "lucide-react";

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

interface MerchantPromotionsClientProps {
  businessId: string;
  businessName: string;
  initialBusiness: BusinessData;
  initialAudience: AudienceData;
  initialHistory: CampaignLogItem[];
}

export default function MerchantPromotionsClient({
  businessId,
  businessName,
  initialBusiness,
  initialAudience,
  initialHistory,
}: MerchantPromotionsClientProps) {
  const [business, setBusiness] = useState<BusinessData>(initialBusiness);
  const [audience, setAudience] = useState<AudienceData>(initialAudience);
  const [history, setHistory] = useState<CampaignLogItem[]>(initialHistory);

  // Estados de interfaz y acciones
  const [isPending, startTransition] = useTransition();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Plantillas de aviso rápido
  const quickTemplates = [
    {
      id: "beneficio",
      label: "Beneficio Especial",
      text: `Hoy beneficio especial mostrando tu tarjeta en ${businessName}. ¡Te esperamos!`,
    },
    {
      id: "nuevo",
      label: "Nuevo Producto",
      text: `¡Nuevo producto disponible en ${businessName}! Pasate hoy y probalo sumando sellos.`,
    },
    {
      id: "cerca_premio",
      label: "Cerca de tu premio",
      text: `Te recordamos que estás muy cerca de tu recompensa en ${businessName}. ¡Sumá tu visita hoy!`,
    },
  ];

  const [selectedTemplate, setSelectedTemplate] = useState<string>("beneficio");
  const [customPushMessage, setCustomPushMessage] = useState<string>(quickTemplates[0].text);
  const [previewPlatform, setPreviewPlatform] = useState<"apple" | "google">("apple");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const showNotification = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback(null);
    }, 5000);
  };

  const reloadData = async () => {
    try {
      const res = await fetch(`/api/comercio/${businessId}/campaigns`);
      if (res.ok) {
        const data = await res.json();
        setBusiness(data.business);
        setAudience(data.audience);
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Error reloading campaigns data:", err);
    }
  };

  const handleLaunchCampaign = async (
    type: "2X_WEEKEND" | "HAPPY_HOUR" | "QUICK_PROMO",
    customText?: string
  ) => {
    setActionLoading(type);
    setFeedback(null);

    try {
      let payload: any = { campaignType: type };

      if (type === "2X_WEEKEND") {
        payload.campaignName = "Finde de 2x1 en Sellos";
        payload.message = `¡Finde 2x1 en ${businessName}! Todas tus visitas de este fin de semana suman doble sello.`;
      } else if (type === "HAPPY_HOUR") {
        payload.campaignName = "Happy Hour de Sellos (4 horas)";
        payload.message = `¡Happy Hour en ${businessName}! Pasate en las próximas 4 horas y sumá doble sello.`;
      } else if (type === "QUICK_PROMO") {
        payload.campaignName = "Aviso Especial";
        payload.message = customText || customPushMessage;
      }

      const res = await fetch(`/api/comercio/${businessId}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo activar la campaña.");
      }

      showNotification(
        "success",
        `¡Campaña activada! Se enviaron notificaciones push a Apple Wallet (${data.result?.appleSent || 0}) y Google Wallet (${data.result?.googleSent || 0}).`
      );
      await reloadData();
    } catch (err: any) {
      showNotification("error", err.message || "Ocurrió un error al lanzar la campaña.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopCampaign = async () => {
    if (!confirm("¿Estás seguro de que deseas finalizar la campaña activa ahora? El multiplicador regresará a 1x.")) {
      return;
    }

    setActionLoading("STOP");
    setFeedback(null);

    try {
      const res = await fetch(`/api/comercio/${businessId}/campaigns`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo finalizar la campaña.");
      }

      showNotification("success", "Campaña finalizada. El multiplicador de sellos regresó a 1.");
      await reloadData();
    } catch (err: any) {
      showNotification("error", err.message || "Error al finalizar la campaña.");
    } finally {
      setActionLoading(null);
    }
  };

  const formatExpiry = (isoString?: string | null) => {
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

  const filteredHistory = history.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.message.toLowerCase().includes(term) ||
      item.campaign_type.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`flex items-center gap-3 rounded-2xl p-4 text-sm font-semibold shadow-md transition-all ${
            feedback.type === "success"
              ? "bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]"
              : "bg-[#FFF0F1] text-[#991B1B] border border-[#FECACA]"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 size={20} className="shrink-0 text-[#10B981]" />
          ) : (
            <AlertCircle size={20} className="shrink-0 text-[#FF1F2D]" />
          )}
          <span className="flex-1">{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Header con métricas de audiencia dual */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1F1F1F]">
              Promociones y Notificaciones Push
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#FFF0F1] px-2.5 py-0.5 text-[11px] font-bold text-[#FF1F2D] border border-[#FFD9DC]">
              <Sparkles size={11} /> Wallet Push Dual
            </span>
          </div>
          <p className="mt-1.5 max-w-2xl text-xs sm:text-sm text-[#737373] leading-relaxed">
            Lanzá promociones y notificaciones instantáneas directo en la pantalla de bloqueo de tus clientes a través de sus pases digitales de <strong>Apple Wallet</strong> y <strong>Google Wallet</strong> sin costo de SMS.
          </p>
        </div>

        {/* Audience Mini-Pills */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-3 rounded-2xl border border-[#D5CFC4] bg-white px-4 py-3 shadow-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F1] text-[#FF1F2D]">
              <Smartphone size={18} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#737373]">Dispositivos vinculados</p>
              <p className="text-sm font-bold text-[#1F1F1F] flex items-center gap-2">
                <span>{audience.appleDevices + audience.googlePasses} pases</span>
                <span className="text-[10px] font-semibold text-[#10B981] bg-[#ECFDF5] px-1.5 py-0.5 rounded-full border border-[#A7F3D0]">
                  iOS & Android
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[#D5CFC4] bg-white px-4 py-3 shadow-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#10B981]">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#737373]">Apertura en Lockscreen</p>
              <p className="text-sm font-bold text-[#10B981]">
                92.4% <span className="text-[10px] font-normal text-[#737373]">(4x vs email)</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Banner de Campaña Activa en Vivo (o Estado Inactivo) */}
      {business.isCampaignActive ? (
        <section className="relative overflow-hidden rounded-2xl border-2 border-[#FF1F2D]/30 bg-gradient-to-r from-[#FFF0F1] via-white to-[#FFF9F5] p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#FF1F2D] border border-[#FFD9DC] shadow-xs">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF1F2D] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF1F2D]"></span>
                </span>
                <span>Campaña en curso</span>
                <span className="text-[#737373] font-normal text-[11px]">| Multiplicador activo</span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#1F1F1F] tracking-tight">
                  {business.activeCampaignName}
                </h2>
                <p className="text-xs sm:text-sm text-[#525252] mt-1">
                  {business.activeCampaignMessage || "Multiplicador de sellos aplicado automáticamente a cada visita."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#FF1F2D] border border-[#FFD9DC] shadow-2xs">
                  <Flame size={14} className="text-[#FF1F2D]" />
                  <span>{business.stampMultiplier}x Sellos por visita</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFF9F5] px-3 py-1.5 text-xs font-medium text-[#525252] border border-[#D5CFC4]">
                  <Clock size={14} className="text-[#737373]" />
                  <span>Finaliza: {formatExpiry(business.campaignExpiresAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t lg:border-t-0 lg:border-l border-[#D5CFC4] pt-4 lg:pt-0 lg:pl-6 shrink-0">
              <button
                type="button"
                onClick={handleStopCampaign}
                disabled={actionLoading === "STOP"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#737373] border border-[#D5CFC4] hover:bg-[#FFF0F1] hover:text-[#FF1F2D] hover:border-[#FECACA] transition-colors shadow-xs disabled:opacity-50"
              >
                <StopCircle size={16} />
                <span>{actionLoading === "STOP" ? "Finalizando..." : "Finalizar campaña ahora"}</span>
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-[#D5CFC4] bg-white p-5 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF9F5] text-[#737373] border border-[#D5CFC4]">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#1F1F1F]">No hay ninguna promoción con multiplicador corriendo en este momento</p>
              <p className="text-[11px] text-[#737373]">Tus clientes suman 1 sello estándar por visita. Elegí una tarjeta de 1-clic abajo para activar 2x1 o enviar un push.</p>
            </div>
          </div>
        </section>
      )}

      {/* 3. Grid de 3 Tarjetas de Acción Rápida (1-clic) */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-[#1F1F1F] tracking-tight">
            Lanzadores Rápidos de Campañas (1-Clic)
          </h3>
          <p className="text-xs text-[#737373]">
            Activá reglas con disparo simultáneo a los pases de Apple Wallet y Google Wallet de tus clientes.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* TARJETA 1: Finde de 2x1 en Sellos */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#D5CFC4] bg-white p-6 shadow-xs hover:shadow-md transition-shadow">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0F1] px-2.5 py-1 text-[11px] font-bold text-[#FF1F2D] border border-[#FFD9DC]">
                  <Rocket size={13} /> 2x Multiplicador
                </span>
                <span className="text-[11px] font-medium text-[#737373]">Fin de Semana</span>
              </div>

              <div>
                <h4 className="text-base font-bold text-[#1F1F1F]">Finde de 2x1 en Sellos</h4>
                <p className="text-xs text-[#737373] mt-1 leading-relaxed">
                  Duplica los sellos asignados por cada visita desde el momento de activación hasta el próximo domingo a las 23:59:59.
                </p>
              </div>

              <div className="rounded-xl bg-[#FFF9F5] p-3.5 border border-[#D5CFC4] space-y-2 text-xs">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#737373]">Duración:</span>
                  <span className="font-bold text-[#1F1F1F]">Hasta domingo 23:59:59</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#737373]">Impacto:</span>
                  <span className="font-bold text-[#FF1F2D]">+2 sellos por ticket</span>
                </div>
                <div className="pt-2 border-t border-[#D5CFC4]">
                  <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider block mb-1">
                    Mensaje push automático:
                  </span>
                  <p className="text-[11px] italic text-[#1F1F1F] bg-white p-2 rounded-lg border border-[#D5CFC4]">
                    &quot;¡Finde 2x1 en {businessName}! Todas tus visitas de este fin de semana suman doble sello.&quot;
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-[#D5CFC4]">
              <button
                type="button"
                onClick={() => handleLaunchCampaign("2X_WEEKEND")}
                disabled={actionLoading !== null}
                className="w-full py-2.5 px-4 rounded-xl bg-[#FF1F2D] hover:bg-[#E01522] text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
              >
                <Zap size={15} />
                <span>{actionLoading === "2X_WEEKEND" ? "Disparando push dual..." : "Activar y enviar Push a Apple & Google"}</span>
              </button>
            </div>
          </div>

          {/* TARJETA 2: Happy Hour de Sellos (4 horas) */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#D5CFC4] bg-white p-6 shadow-xs hover:shadow-md transition-shadow">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4ED] px-2.5 py-1 text-[11px] font-bold text-[#EA580C] border border-[#FDBA74]">
                  <Clock size={13} /> Flash 4 Horas
                </span>
                <span className="text-[11px] font-medium text-[#737373]">Horario Valle</span>
              </div>

              <div>
                <h4 className="text-base font-bold text-[#1F1F1F]">Happy Hour de Sellos (4h)</h4>
                <p className="text-xs text-[#737373] mt-1 leading-relaxed">
                  Estimula el horario de menor afluencia con sellos dobles automáticos durante las próximas 4 horas exactas.
                </p>
              </div>

              <div className="rounded-xl bg-[#FFF9F5] p-3.5 border border-[#D5CFC4] space-y-2 text-xs">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#737373]">Duración:</span>
                  <span className="font-bold text-[#1F1F1F]">4 horas desde activación</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#737373]">Impacto:</span>
                  <span className="font-bold text-[#EA580C]">+2 sellos por ticket</span>
                </div>
                <div className="pt-2 border-t border-[#D5CFC4]">
                  <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider block mb-1">
                    Mensaje push automático:
                  </span>
                  <p className="text-[11px] italic text-[#1F1F1F] bg-white p-2 rounded-lg border border-[#D5CFC4]">
                    &quot;¡Happy Hour en {businessName}! Pasate en las próximas 4 horas y sumá doble sello.&quot;
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-[#D5CFC4]">
              <button
                type="button"
                onClick={() => handleLaunchCampaign("HAPPY_HOUR")}
                disabled={actionLoading !== null}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1F1F1F] hover:bg-black text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
              >
                <Flame size={15} className="text-[#FDBA74]" />
                <span>{actionLoading === "HAPPY_HOUR" ? "Disparando Happy Hour..." : "Lanzar Happy Hour Ahora"}</span>
              </button>
            </div>
          </div>

          {/* TARJETA 3: Aviso / Promo Rápida (Solo Push con Mockup Preview) */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#D5CFC4] bg-white p-6 shadow-xs hover:shadow-md transition-shadow">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-bold text-[#10B981] border border-[#A7F3D0]">
                  <Bell size={13} /> Solo Notificación Push
                </span>
                <span className="text-[11px] font-semibold text-[#10B981]">Instantáneo</span>
              </div>

              <div>
                <h4 className="text-base font-bold text-[#1F1F1F]">Aviso / Promo Rápida</h4>
                <p className="text-xs text-[#737373] mt-1 leading-relaxed">
                  Envía un mensaje directo a la pantalla bloqueada de tus clientes sin modificar el contador de sellos.
                </p>
              </div>

              {/* Selector de plantillas rápidas */}
              <div className="flex flex-wrap gap-1.5">
                {quickTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(tpl.id);
                      setCustomPushMessage(tpl.text);
                    }}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${
                      selectedTemplate === tpl.id
                        ? "bg-[#FF1F2D] text-white shadow-2xs"
                        : "bg-[#FFF9F5] text-[#525252] border border-[#D5CFC4] hover:bg-[#EBE5DA]"
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>

              {/* Input de texto personalizado */}
              <div>
                <textarea
                  value={customPushMessage}
                  onChange={(e) => setCustomPushMessage(e.target.value)}
                  maxLength={130}
                  rows={2}
                  className="w-full rounded-xl border border-[#D5CFC4] bg-[#FFF9F5] p-2.5 text-xs text-[#1F1F1F] placeholder:text-[#737373] focus:border-[#FF1F2D] focus:bg-white focus:outline-hidden"
                  placeholder="Escribí un mensaje corto para la pantalla de bloqueo..."
                />
                <span className="text-[10px] text-[#737373] float-right mt-0.5">
                  {customPushMessage.length}/130 caracteres
                </span>
              </div>

              {/* Simulador / Preview en pantalla de bloqueo */}
              <div className="rounded-xl bg-[#1A1A1A] p-3 text-white border border-[#333333] shadow-inner mt-2">
                <div className="flex items-center justify-between text-[10px] text-[#A3A3A3] mb-2 px-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                    <span>Vista previa en Lockscreen</span>
                  </div>
                  <div className="flex items-center gap-1 bg-[#262626] rounded-md p-0.5 border border-[#404040]">
                    <button
                      type="button"
                      onClick={() => setPreviewPlatform("apple")}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        previewPlatform === "apple" ? "bg-white text-black" : "text-[#737373]"
                      }`}
                    >
                      Apple
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewPlatform("google")}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        previewPlatform === "google" ? "bg-white text-black" : "text-[#737373]"
                      }`}
                    >
                      Google
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-[#262626]/90 p-2.5 border border-[#404040]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-4 w-4 items-center justify-center rounded bg-[#FF1F2D] text-[9px] font-bold text-white">
                        {businessName.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-[11px] font-bold text-white tracking-tight truncate max-w-[170px]">
                        {businessName}
                      </span>
                    </div>
                    <span className="text-[9px] text-[#737373]">Ahora</span>
                  </div>
                  <p className="text-[11px] text-[#E5E5E5] leading-snug line-clamp-2">
                    {customPushMessage || "Tu mensaje de notificación se verá aquí..."}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-[#D5CFC4]">
              <button
                type="button"
                onClick={() => handleLaunchCampaign("QUICK_PROMO")}
                disabled={actionLoading !== null || !customPushMessage.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#FF1F2D] hover:bg-[#E01522] text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
              >
                <Send size={15} />
                <span>{actionLoading === "QUICK_PROMO" ? "Transmitiendo push..." : "Enviar Notificación Push Dual"}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Tabla Inferior: Historial de Campañas Enviadas */}
      <section className="rounded-2xl border border-[#D5CFC4] bg-white shadow-xs overflow-hidden">
        <div className="p-6 border-b border-[#D5CFC4] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#1F1F1F]">Historial de Campañas y Notificaciones Enviadas</h3>
            <p className="text-xs text-[#737373]">
              Registro auditable de difusiones push entregadas a los pases digitales de tus clientes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-[#737373]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por mensaje o tipo..."
                className="w-full rounded-xl border border-[#D5CFC4] bg-[#FFF9F5] pl-8 pr-3 py-1.5 text-xs text-[#1F1F1F] placeholder:text-[#737373] focus:border-[#FF1F2D] focus:bg-white focus:outline-hidden"
              />
            </div>

            <button
              type="button"
              onClick={reloadData}
              title="Refrescar historial"
              className="p-2 rounded-xl border border-[#D5CFC4] hover:border-[#B8B1A4] text-[#737373] hover:text-[#1F1F1F] hover:bg-[#FFF9F5] transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FFF9F5] text-[11px] font-bold text-[#737373] uppercase tracking-wider border-b border-[#D5CFC4]">
              <tr>
                <th className="px-6 py-3">Fecha y Hora</th>
                <th className="px-6 py-3">Tipo de Campaña</th>
                <th className="px-6 py-3">Mensaje Transmitido</th>
                <th className="px-6 py-3 text-center">Apple Wallet</th>
                <th className="px-6 py-3 text-center">Google Wallet</th>
                <th className="px-6 py-3 text-right">Total Notificados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5CFC4]">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-xs text-[#737373]">
                    No se registran campañas enviadas todavía. Lanzá tu primera promoción arriba con 1 clic.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => {
                  const date = new Date(item.created_at);
                  const formattedDate = date.toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={item.id} className="hover:bg-[#FFF9F5] transition-colors">
                      <td className="px-6 py-3.5 font-medium text-[#1F1F1F] whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                            item.campaign_type.includes("2X") || item.campaign_type.includes("FINDE")
                              ? "bg-[#FFF0F1] text-[#FF1F2D] border-[#FFD9DC]"
                              : item.campaign_type.includes("HAPPY")
                              ? "bg-[#FFF4ED] text-[#EA580C] border-[#FDBA74]"
                              : "bg-[#ECFDF5] text-[#10B981] border-[#A7F3D0]"
                          }`}
                        >
                          {item.campaign_type}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 max-w-md text-[#525252] truncate" title={item.message}>
                        {item.message}
                      </td>
                      <td className="px-6 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#F5F5F7] px-2 py-0.5 text-[11px] font-semibold text-[#1F1F1F] border border-[#E5E5E7]">
                           {item.apple_devices_notified} pases
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#E8F0FE] px-2 py-0.5 text-[11px] font-semibold text-[#1967D2] border border-[#D2E3FC]">
                          G {item.google_passes_notified} pases
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-bold text-[#1F1F1F] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#10B981] border border-[#A7F3D0]">
                          <CheckCircle2 size={12} />
                          {item.apple_devices_notified + item.google_passes_notified} clientes
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
