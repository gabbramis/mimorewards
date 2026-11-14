"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  Gift,
  Loader2,
} from "lucide-react";

export interface MerchantNotification {
  id: string;
  business_id: string;
  type: "success" | "error" | "prize";
  message: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  businessId: string;
  variant?: "dark" | "light";
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return "Hace instantes";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return new Intl.DateTimeFormat("es-UY", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

export default function NotificationBell({
  businessId,
  variant = "dark",
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<MerchantNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = useCallback(
    async (showLoader = false) => {
      if (!businessId) return;
      if (showLoader) setLoading(true);
      try {
        const res = await fetch(
          `/api/merchant/notifications?businessId=${encodeURIComponent(businessId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
        }
      } catch (err) {
        console.warn("[NotificationBell] No se pudieron cargar notificaciones:", err);
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [businessId]
  );

  useEffect(() => {
    void fetchNotifications(true);
    const interval = setInterval(() => {
      void fetchNotifications(false);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleMarkAsRead = async (notificationId?: string) => {
    if (!businessId) return;
    setMarkingRead(true);
    setNotifications((prev) =>
      prev.map((item) =>
        !notificationId || item.id === notificationId
          ? { ...item, is_read: true }
          : item
      )
    );

    try {
      await fetch("/api/merchant/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, notificationId }),
      });
    } catch (err) {
      console.error("[NotificationBell] Error al marcar como leído:", err);
    } finally {
      setMarkingRead(false);
    }
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      void fetchNotifications(false);
    }
  };

  const isLight = variant === "light";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notificaciones del comercio"
        aria-expanded={open}
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
          isLight
            ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white"
        }`}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} notificaciones sin leer`}
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs ring-2 ring-zinc-950"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Historial de notificaciones"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">
                Notificaciones operativas
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                  {unreadCount} sin leer
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                disabled={markingRead}
                onClick={() => handleMarkAsRead()}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCheck size={13} />
                <span>Marcar todas leídas</span>
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/70">
            {loading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
                <Loader2 size={20} className="animate-spin mb-2" />
                <span className="text-xs">Cargando notificaciones...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <Bell size={24} className="mx-auto text-zinc-600 mb-2" />
                <p className="text-xs font-medium text-zinc-300">
                  Sin notificaciones recientes
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Los escaneos, sellos y premios aparecerán aquí.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const isPrize = item.type === "prize";
                const isError = item.type === "error";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (!item.is_read) {
                        void handleMarkAsRead(item.id);
                      }
                    }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
                      item.is_read
                        ? "bg-zinc-950/60 hover:bg-zinc-900/50 opacity-75"
                        : "bg-zinc-900/40 hover:bg-zinc-900"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                        isPrize
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          : isError
                          ? "border-red-500/30 bg-red-500/10 text-red-400"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {isPrize ? (
                        <Gift size={14} />
                      ) : isError ? (
                        <AlertTriangle size={14} />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white leading-snug break-words">
                        {item.message}
                      </p>
                      <span className="mt-1 block text-[10px] text-zinc-400">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>

                    {!item.is_read && (
                      <span
                        title="Sin leer (clic para marcar como leída)"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

