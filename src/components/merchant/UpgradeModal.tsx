"use client";

import React, { useEffect } from "react";
import {
  X,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Download,
  Users,
  Megaphone,
} from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  feature?: "export" | "customers" | "communications" | "general";
}

export default function UpgradeModal({
  isOpen,
  onClose,
  title = "Actualizá a MIMO Pro",
  description,
  feature = "general",
}: UpgradeModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const defaultDescription =
    description ||
    (feature === "export"
      ? "La exportación de reportes a CSV es una funcionalidad exclusiva del Plan Pro para ayudarte a analizar y conciliar tus datos."
      : feature === "customers"
      ? "El semáforo de retención, las visitas totales y la última visita te permiten reactivar clientes dormidos antes de perderlos."
      : feature === "communications"
      ? "El módulo de comunicaciones te permite enviar notificaciones push directo a los pases de Apple Wallet y Google Wallet de tus clientes."
      : "Desbloqueá todas las herramientas avanzadas de fidelización y retención de MIMO Rewards.");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl border border-[#D5CFC4] bg-white p-6 sm:p-8 shadow-2xl relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-[#737373] hover:bg-[#FFF9F5] hover:text-[#1F1F1F] transition-colors"
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        {/* Badge & Icon */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800 border border-amber-200">
            <Sparkles size={13} className="text-amber-600" />
            PLAN PRO
          </span>
          <span className="text-[11px] font-medium text-[#737373]">
            Exclusivo para comercios Pro
          </span>
        </div>

        {/* Title & Description */}
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1F1F1F] leading-tight">
          {title}
        </h3>
        <p className="mt-2 text-xs sm:text-sm text-[#525252] leading-relaxed">
          {defaultDescription}
        </p>

        {/* Features Checklist */}
        <div className="mt-6 space-y-3 rounded-2xl bg-[#FFF9F5] border border-[#D5CFC4] p-4 text-xs">
          <p className="font-bold text-[#1F1F1F] text-[11px] uppercase tracking-wider text-[#737373]">
            Incluido en el Plan Pro:
          </p>

          <div className="flex items-start gap-2.5">
            <Users size={16} className="text-[#FF1F2D] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#1F1F1F]">Semáforo de retención y métricas</p>
              <p className="text-[#737373]">
                Estado de inactividad (Activos, Riesgo e Inactivos), visitas totales y fecha exacta de última visita.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Download size={16} className="text-[#10B981] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#1F1F1F]">Exportación a CSV sin límites</p>
              <p className="text-[#737373]">
                Descargá el historial completo de transacciones para tu sistema contable o Excel.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Megaphone size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#1F1F1F]">Comunicaciones & Push Wallet</p>
              <p className="text-[#737373]">
                Dispará notificaciones y promociones push ilimitadas a los celulares de tus clientes.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <a
            href="https://wa.me/5491100000000?text=Hola!%20Quiero%20actualizar%20mi%20cuenta%20de%20MIMO%20al%20Plan%20Pro"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF1F2D] px-5 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#E01522] transition-colors"
          >
            <Zap size={14} className="text-amber-300" />
            <span>Actualizar a Plan Pro</span>
            <ArrowRight size={14} />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-[#D5CFC4] bg-white px-5 py-3 text-xs font-semibold text-[#525252] hover:bg-[#FFF9F5] transition-colors"
          >
            Ahora no
          </button>
        </div>

        <p className="mt-4 text-center text-[10px] text-[#A3A3A3]">
          Podés cancelar o cambiar de plan en cualquier momento.
        </p>
      </div>
    </div>
  );
}
