"use client";

import { useEffect, useState } from "react";

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export default function PushNotificationManager() {
  const [loading, setLoading] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[Service Worker] Registrado correctamente:", registration.scope);
          return registration.pushManager.getSubscription();
        })
        .then((subscription) => {
          if (subscription) {
            setIsActivated(true);
          }
        })
        .catch((error) => {
          console.error("[Service Worker] Error al registrar:", error);
        });
    }
  }, []);

  const activarBeneficios = async () => {
    setLoading(true);
    setStatusMessage(null);

    try {
      // a) Fetch POST a /api/clientes/actualizar-whatsapp
      const waResponse = await fetch("/api/clientes/actualizar-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ aceptaWhatsapp: true }),
      });

      if (!waResponse.ok) {
        console.warn("[WhatsApp] No se pudo actualizar el permiso de WhatsApp en el servidor");
      }

      // b) Solicitar permiso del navegador para notificaciones Push
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setStatusMessage("WhatsApp activado. Tu navegador no soporta notificaciones push.");
        setIsActivated(true);
        setLoading(false);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatusMessage("WhatsApp activado. Permiso de notificaciones denegado.");
        setIsActivated(true);
        setLoading(false);
        return;
      }

      // c) Si el permiso es 'granted', ejecutar la suscripción Push
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error("No se encontró la variable NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const pushResponse = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });

      const pushData = await pushResponse.json();
      if (pushResponse.ok && pushData.success) {
        setIsActivated(true);
        setStatusMessage("¡WhatsApp y Notificaciones activados con éxito!");
      } else {
        throw new Error(pushData.error || "No se pudo registrar la suscripción push.");
      }
    } catch (error: any) {
      console.error("[Beneficios] Error al activar beneficios:", error);
      setStatusMessage(error.message || "Ocurrió un error al activar los avisos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4">
      <button
        type="button"
        onClick={activarBeneficios}
        disabled={loading || isActivated}
        className={`inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm ${
          isActivated
            ? "bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-700"
            : loading
            ? "bg-zinc-700 text-white cursor-wait opacity-80"
            : "bg-white text-black hover:bg-zinc-200 active:scale-95 cursor-pointer"
        }`}
      >
        {loading
          ? "Activando..."
          : isActivated
          ? "Avisos Activados (WhatsApp y Notificaciones)"
          : "Activar avisos de premios (WhatsApp y Notificaciones)"}
      </button>

      {statusMessage && (
        <p
          className={`text-xs font-medium transition-opacity ${
            isActivated ? "text-emerald-400" : "text-zinc-400"
          }`}
        >
          {statusMessage}
        </p>
      )}
    </div>
  );
}
