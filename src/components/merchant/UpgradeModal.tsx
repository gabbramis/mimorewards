"use client";

import React, { useEffect } from "react";
import {
  X,
  Sparkles,
  ArrowRight,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8 relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        {/* Badge & Icon */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-3 py-1 text-[11px] font-medium text-white border border-zinc-800">
            <Sparkles size={13} className="text-zinc-300" />
            PLAN PRO
          </span>
          <span className="text-[11px] font-medium text-zinc-400">
            Exclusivo para comercios Pro
          </span>
        </div>

        {/* Title & Description */}
        <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-white leading-tight">
          {title}
        </h3>
        <p className="mt-2 text-xs sm:text-sm text-zinc-400 leading-relaxed">
          {defaultDescription}
        </p>

        {/* Features Checklist */}
        <div className="mt-6 space-y-3 rounded-xl bg-zinc-950 border border-zinc-800 p-4 text-xs">
          <p className="font-medium text-[11px] uppercase tracking-wider text-zinc-400">
            Incluido en el Plan Pro:
          </p>

          <div className="flex items-start gap-2.5">
            <Users size={16} className="text-zinc-300 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Semáforo de retención y métricas</p>
              <p className="text-zinc-400">
                Estado de inactividad (Activos, Riesgo e Inactivos), visitas totales y fecha exacta de última visita.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Download size={16} className="text-zinc-300 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Exportación a CSV sin límites</p>
              <p className="text-zinc-400">
                Descargá el historial completo de transacciones para tu sistema contable o Excel.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Megaphone size={16} className="text-zinc-300 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Comunicaciones & Push Wallet</p>
              <p className="text-zinc-400">
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
            className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-semibold text-black hover:bg-gray-200 transition-colors"
          >
            <Zap size={14} />
            <span>Actualizar a Plan Pro</span>
            <ArrowRight size={14} />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-3 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
          >
            Ahora no
          </button>
        </div>

        <p className="mt-4 text-center text-[10px] text-zinc-500">
          Podés cancelar o cambiar de plan en cualquier momento.
        </p>
      </div>
    </div>
  );
}
