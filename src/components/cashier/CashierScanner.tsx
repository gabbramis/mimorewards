"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  QrCode,
  Sparkles,
  ArrowRight,
  User,
  XCircle,
  Loader2,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface CashierScannerProps {
  businessId?: string;
  onStampSuccess?: (clientId: string, newTotal?: number) => void;
  onClose?: () => void;
  className?: string;
}

type ScanStatus = "idle" | "scanning" | "detected" | "processing" | "success" | "error";

export default function CashierScanner({
  businessId,
  onStampSuccess,
  onClose,
  className = "",
}: CashierScannerProps) {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [clientId, setClientId] = useState<string>("");
  const [clientDisplayName, setClientDisplayName] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [cameraError, setCameraError] = useState<string>("");
  const [cameraErrorType, setCameraErrorType] = useState<"permission" | "not_readable" | "general" | null>(null);
  const [isResettingCamera, setIsResettingCamera] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentStamps, setCurrentStamps] = useState<number | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const scannerContainerId = "cashier-qr-scanner-view";
  const supabase = createClient();

  // Función auxiliar para extraer el ID si el QR contiene una URL completa
  const parseQrContent = (rawText: string): string => {
    const trimmed = rawText.trim();
    try {
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        const url = new URL(trimmed);
        const cParam =
          url.searchParams.get("c") ||
          url.searchParams.get("customerId") ||
          url.searchParams.get("id");
        if (cParam) return cParam;
        const parts = url.pathname.split("/").filter(Boolean);
        return parts[parts.length - 1] || trimmed;
      }
    } catch {
      // Si no es URL, usamos el texto directo
    }
    return trimmed;
  };

  // Reproducir sonido sutil de confirmación
  const playBeep = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.04);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // AudioContext opcional
    }
  };

  // Buscar información rápida del cliente (si existe en DB)
  const lookupCustomerDetails = useCallback(async (idOrCode: string) => {
    try {
      let query = supabase
        .from("customers")
        .select("id, first_name, last_name, unique_code, current_stamps");

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);
      const orQuery = isUUID
        ? `id.eq.${idOrCode},unique_code.ilike.${idOrCode},phone.eq.${idOrCode}`
        : `unique_code.ilike.${idOrCode},phone.eq.${idOrCode}`;

      const { data } = await query.or(orQuery).maybeSingle();
      if (data) {
        const fullName = `${data.first_name || ""} ${data.last_name || ""}`.trim();
        setClientDisplayName(fullName || data.unique_code || idOrCode);
        setCurrentStamps(typeof data.current_stamps === "number" ? data.current_stamps : null);
        return data.id;
      }
    } catch (err) {
      console.warn("No se pudo obtener el nombre previo del cliente:", err);
    }
    setClientDisplayName(idOrCode);
    return idOrCode;
  }, [businessId, supabase]);

  // Callback de detección de QR
  const onScanSuccess = useCallback(async (decodedText: string) => {
    if (status === "detected" || status === "processing" || status === "success" || isPaused) {
      return;
    }

    const detectedId = parseQrContent(decodedText);
    if (!detectedId) return;

    playBeep();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(120);
    }

    // Pausar escaneo
    setIsPaused(true);
    if (scannerRef.current) {
      try {
        scannerRef.current.pause(true);
      } catch (err) {
        console.warn("Error al pausar html5-qrcode:", err);
      }
    }

    setClientId(detectedId);
    setStatus("detected");
    setErrorMessage("");

    // Opcional: buscar si existe el nombre del cliente
    await lookupCustomerDetails(detectedId);
  }, [status, isPaused, lookupCustomerDetails]);

  // 1. Atributos del Video (Crucial para iOS/Safari):
  // Safari bloquea la reproducción y deja la pantalla en negro si el video no tiene playsInline, autoPlay y muted
  const injectVideoAttributes = useCallback(() => {
    if (typeof document === "undefined") return;
    const container = document.getElementById(scannerContainerId);
    if (!container) return;
    const videos = container.querySelectorAll("video");
    videos.forEach((video) => {
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.setAttribute("autoplay", "true");
      video.setAttribute("muted", "true");
      video.playsInline = true;
      video.autoplay = true;
      video.muted = true;
      if (video.paused) {
        video.play().catch(() => {});
      }
    });
  }, [scannerContainerId]);

  // Observer para inyectar los atributos en cuanto html5-qrcode agregue el elemento <video>
  const setupVideoObserver = useCallback(() => {
    if (typeof document === "undefined") return;
    const container = document.getElementById(scannerContainerId);
    if (!container) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    injectVideoAttributes();

    const observer = new MutationObserver(() => {
      injectVideoAttributes();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["playsinline", "webkit-playsinline", "autoplay", "muted"],
    });

    observerRef.current = observer;
  }, [injectVideoAttributes, scannerContainerId]);

  // Iniciar la cámara trasera con html5-qrcode
  const startCamera = useCallback(async () => {
    setCameraError("");
    setCameraErrorType(null);
    setStatus("scanning");
    setIsPaused(false);
    setClientId("");
    setClientDisplayName("");
    setCurrentStamps(null);

    // 3. Tiempo de Montaje: retraso de 300ms para darle tiempo a Safari de renderizar el contenedor antes de inyectar el video
    await new Promise((r) => setTimeout(r, 300));

    try {
      const container = document.getElementById(scannerContainerId);
      if (!container) {
        throw new Error("No se encontró el contenedor de escaneo en la pantalla.");
      }

      setupVideoObserver();

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
          ],
          verbose: false,
        });
      }

      const qrCode = scannerRef.current;

      // Si ya está escaneando, resumir si estaba en pausa
      if (qrCode.isScanning) {
        try {
          qrCode.resume();
        } catch {
          // ignore
        }
        injectVideoAttributes();
        return;
      }

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrEdgeSize = Math.max(Math.floor(minEdge * 0.72), 200);
          return {
            width: qrEdgeSize,
            height: qrEdgeSize,
          };
        },
        aspectRatio: 1.0,
      };

      try {
        // 2. Forzar Cámara Trasera: pedir explícitamente facingMode: "environment" (evitando { exact: "environment" })
        await qrCode.start(
          { facingMode: "environment" },
          config,
          onScanSuccess,
          undefined
        );
      } catch (err: any) {
        console.warn("Fallo cámara trasera o no disponible, intentando con facingMode user:", err);
        // Fallback a cámara frontal/disponible si el dispositivo no tiene trasera o falla el selector
        await qrCode.start(
          { facingMode: "user" },
          config,
          onScanSuccess,
          undefined
        );
      }

      // Inyección inmediata y verificación periódica inicial de atributos
      injectVideoAttributes();
      let checks = 0;
      const interval = setInterval(() => {
        injectVideoAttributes();
        checks += 1;
        if (checks >= 8) clearInterval(interval);
      }, 150);

    } catch (err: any) {
      console.error("Error al acceder a la cámara:", err);

      const errName = err?.name || "";
      const errMsg = String(err?.message || err || "");
      const isNotAllowed =
        errName === "NotAllowedError" ||
        errName === "PermissionDeniedError" ||
        errMsg.toLowerCase().includes("permission") ||
        errMsg.toLowerCase().includes("notallowed");

      const isNotReadable =
        errName === "NotReadableError" ||
        errName === "TrackStartError" ||
        errMsg.toLowerCase().includes("notreadable") ||
        errMsg.toLowerCase().includes("could not start video source");

      // 4. Reinicio de Permisos: Manejo específico de NotReadableError y NotAllowedError
      if (isNotAllowed) {
        setCameraErrorType("permission");
        setCameraError(
          "Permiso de cámara denegado. Habilitá el acceso a la cámara en los ajustes de Safari para escanear."
        );
      } else if (isNotReadable) {
        setCameraErrorType("not_readable");
        setCameraError(
          "La cámara está bloqueada o en uso por otra app/pestaña de iOS. Tocá el botón para reinicializarla limpiamente."
        );
      } else {
        setCameraErrorType("general");
        setCameraError(
          errMsg || "No se pudo acceder a la cámara. Verificá los permisos del navegador."
        );
      }

      setStatus("error");
    }
  }, [onScanSuccess, scannerContainerId, setupVideoObserver, injectVideoAttributes]);

  // Detener la cámara limpiamente y liberar hardware en iOS/Safari
  const stopCamera = useCallback(async () => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (typeof document !== "undefined") {
      const container = document.getElementById(scannerContainerId);
      const videos = container?.querySelectorAll("video");
      videos?.forEach((video) => {
        if (video.srcObject) {
          try {
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach((track) => {
              track.stop();
            });
            video.srcObject = null;
          } catch {}
        }
      });
    }

    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn("Error al detener html5-qrcode:", err);
      }
      scannerRef.current = null;
    }
  }, [scannerContainerId]);

  // 4. Reinicio de Permisos y cámara limpia
  const handleCleanRestart = async () => {
    setIsResettingCamera(true);
    setCameraError("");
    setCameraErrorType(null);
    try {
      await stopCamera();
      // Pausa para que iOS libere el hardware de la cámara
      await new Promise((r) => setTimeout(r, 400));
      await startCamera();
    } finally {
      setIsResettingCamera(false);
    }
  };

  // Reiniciar escaneo para escanear otro cliente
  const handleScanAgain = async () => {
    setErrorMessage("");
    setStatus("scanning");
    setClientId("");
    setClientDisplayName("");
    setCurrentStamps(null);
    setIsPaused(false);

    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        scannerRef.current.resume();
        injectVideoAttributes();
        return;
      } catch (err) {
        console.warn("Error al resumir cámara, reiniciando:", err);
      }
    }
    await startCamera();
  };

  // 5. Conexión: Función handleAddStamp armada para conectar con Supabase / API
  const handleAddStamp = async (targetClientId: string) => {
    if (!targetClientId) return;
    setStatus("processing");
    setErrorMessage("");

    try {
      // 1. Llamada a la API de sellos de Mimo
      const response = await fetch("/api/stamps/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: targetClientId,
          businessId: businessId || undefined,
          method: "QR_SCAN",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo sumar el sello.");
      }

      // Si fue exitoso:
      playBeep();
      setStatus("success");
      const newTotal = typeof data.newTotal === "number" ? data.newTotal : (currentStamps ? currentStamps + 1 : 1);
      setCurrentStamps(newTotal);

      if (onStampSuccess) {
        onStampSuccess(targetClientId, newTotal);
      }
    } catch (err: any) {
      console.error("Error al sumar sello:", err);
      setErrorMessage(
        err?.message || "Ocurrió un error al registrar el sello en la base de datos."
      );
      setStatus("detected"); // Permite reintentar
    }
  };

  // 3. Tiempo de Montaje: Inicializar cámara con retraso (300ms) al montar el componente
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) {
        startCamera();
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  return (
    <div
      className={`w-full max-w-md mx-auto flex flex-col rounded-3xl bg-white border border-[#EBE6DE] shadow-xl overflow-hidden font-sans ${className}`}
    >
      {/* Cabecera del Escáner */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#EBE6DE] bg-[#FAF8F5]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F1] text-[#FF1F2D] shadow-xs">
            <QrCode size={19} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#1F1F1F] tracking-tight">
              Escáner de Caja
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    status === "scanning"
                      ? "animate-ping bg-emerald-400"
                      : status === "detected"
                      ? "bg-amber-400"
                      : "bg-gray-300"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    status === "scanning"
                      ? "bg-emerald-500"
                      : status === "detected"
                      ? "bg-amber-500"
                      : "bg-gray-400"
                  }`}
                />
              </span>
              <span className="text-[11px] font-semibold text-[#737373]">
                {status === "scanning"
                  ? "Cámara activa"
                  : status === "detected"
                  ? "QR capturado"
                  : status === "processing"
                  ? "Acreditando..."
                  : status === "success"
                  ? "Completado"
                  : "En pausa"}
              </span>
            </div>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            title="Cerrar escáner"
          >
            <XCircle size={18} />
          </button>
        )}
      </div>

      {/* Visor de Cámara Central */}
      <div className="relative p-5 flex flex-col items-center">
        {/* Recuadro contenedor de la cámara */}
        <div className="relative w-full aspect-square max-w-[320px] rounded-2xl overflow-hidden bg-black shadow-inner border-2 border-[#1F1F1F]">
          {/* Contenedor DOM para html5-qrcode */}
          <div
            id={scannerContainerId}
            className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full [&>#cashier-qr-scanner-view__scan_region]:w-full [&>#cashier-qr-scanner-view__scan_region]:h-full"
          />

          {/* Overlay visual: Guía de encuadre cuando está escaneando */}
          {status === "scanning" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {/* Esquinas decorativas de escáner */}
              <div className="relative w-[72%] h-[72%]">
                <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#FF1F2D] rounded-tl-lg" />
                <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#FF1F2D] rounded-tr-lg" />
                <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#FF1F2D] rounded-bl-lg" />
                <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#FF1F2D] rounded-br-lg" />

                {/* Línea láser de escaneo animada */}
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#FF1F2D] to-transparent animate-pulse shadow-[0_0_8px_#FF1F2D]" />
              </div>
            </div>
          )}

          {/* Overlay: Error de permisos o cámara con opción de reinicio limpio */}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-5 bg-[#1F1F1F]/95 text-white text-center z-20">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 text-[#FF1F2D] mb-2.5 border border-red-500/20">
                <AlertTriangle size={24} />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-1">
                {cameraErrorType === "permission"
                  ? "Permiso de cámara"
                  : cameraErrorType === "not_readable"
                  ? "Cámara no disponible"
                  : "Error de cámara"}
              </h4>
              <p className="text-xs text-gray-300 leading-relaxed mb-4 max-w-[260px]">
                {cameraError || "No se pudo activar la cámara trasera."}
              </p>
              <button
                type="button"
                onClick={handleCleanRestart}
                disabled={isResettingCamera}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF1F2D] text-white px-4 py-2.5 text-xs font-extrabold shadow-md hover:bg-[#e01826] transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={isResettingCamera ? "animate-spin" : ""} />
                <span>{isResettingCamera ? "Reinicializando..." : "Reiniciar cámara limpiamente"}</span>
              </button>
              {cameraErrorType === "permission" && (
                <p className="mt-3 text-[10px] text-gray-400 max-w-[240px] leading-tight">
                  En Safari: tocá <strong>aA</strong> en la barra de direcciones → <em>Configuración del sitio web</em> → <em>Cámara: Permitir</em>.
                </p>
              )}
            </div>
          )}
        </div>

        {/* 2. Texto debajo del recuadro central */}
        {status === "scanning" && (
          <p className="mt-4 text-center text-xs sm:text-sm font-semibold text-[#737373] tracking-tight">
            Apuntá al QR del cliente para sumar un sello
          </p>
        )}

        {/* 3 & 4. Tarjeta y Acción de confirmación al detectar el QR */}
        {status === "detected" && (
          <div className="w-full mt-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
            {/* Tarjeta con ID/Nombre del cliente detectado */}
            <div className="rounded-2xl border border-[#EBE6DE] bg-[#FFF9F5] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0F1] text-[#FF1F2D]">
                  <User size={20} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#737373]">
                    Cliente Detectado
                  </span>
                  <p className="text-sm font-extrabold text-[#1F1F1F] truncate">
                    {clientDisplayName || clientId}
                  </p>
                  {currentStamps !== null && (
                    <span className="text-[11px] font-medium text-emerald-700">
                      Tiene actualmente {currentStamps} {currentStamps === 1 ? "sello" : "sellos"}
                    </span>
                  )}
                </div>
              </div>

              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
                QR Válido
              </span>
            </div>

            {errorMessage && (
              <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-xl">
                {errorMessage}
              </p>
            )}

            {/* 4. Botón grande de confirmación */}
            <button
              type="button"
              onClick={() => handleAddStamp(clientId)}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#FF1F2D] text-white py-3.5 px-4 text-sm font-extrabold shadow-md hover:bg-[#e01826] active:scale-[0.99] transition-all cursor-pointer"
            >
              <Zap size={18} fill="currentColor" />
              <span>Sumar 1 Sello a {clientDisplayName || clientId}</span>
            </button>

            {/* Botón secundario para descartar y escanear otro */}
            <button
              type="button"
              onClick={handleScanAgain}
              className="w-full py-2 text-xs font-semibold text-[#737373] hover:text-[#1F1F1F] transition-colors cursor-pointer text-center"
            >
              Descartar y volver a escanear
            </button>
          </div>
        )}

        {/* Estado de procesamiento */}
        {status === "processing" && (
          <div className="w-full mt-4 p-5 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col items-center justify-center gap-2">
            <Loader2 size={24} className="animate-spin text-[#FF1F2D]" />
            <p className="text-xs font-bold text-gray-700">
              Registrando sello en la tarjeta...
            </p>
          </div>
        )}

        {/* 6. Feedback: Alerta verde de éxito y botón para volver a escanear */}
        {status === "success" && (
          <div className="w-full mt-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-emerald-900 flex items-center gap-3 shadow-xs">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={24} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-extrabold text-emerald-950">
                  Sello sumado con éxito
                </h4>
                <p className="text-xs text-emerald-800 leading-tight mt-0.5">
                  Se acreditó 1 sello a {clientDisplayName || clientId}.
                  {currentStamps !== null && ` Ahora tiene ${currentStamps} sellos.`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleScanAgain}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1F1F1F] text-white py-3.5 px-4 text-xs sm:text-sm font-extrabold shadow-sm hover:bg-black active:scale-[0.99] transition-all cursor-pointer"
            >
              <RefreshCw size={16} />
              <span>Volver a escanear</span>
            </button>
          </div>
        )}
      </div>

      {/* Pie de ayuda */}
      <div className="px-5 py-3 border-t border-[#EBE6DE] bg-[#FAF8F5] flex items-center justify-between text-[11px] text-[#737373]">
        <span>Terminal de Caja Mimo</span>
        <span className="font-mono">v1.0</span>
      </div>
    </div>
  );
}
