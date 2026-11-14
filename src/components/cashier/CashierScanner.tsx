"use client";

import { useState, useCallback, useEffect } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  CheckCircle2,
  RefreshCw,
  QrCode,
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
  businessId: propBusinessId,
  onStampSuccess,
  onClose,
  className = "",
}: CashierScannerProps) {
  const [status, setStatus] = useState<ScanStatus>("scanning");
  const [clientId, setClientId] = useState<string>("");
  const [resolvedCustomerId, setResolvedCustomerId] = useState<string>("");
  const [clientDisplayName, setClientDisplayName] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentStamps, setCurrentStamps] = useState<number | null>(null);
  const [activeBusinessId, setActiveBusinessId] = useState<string>(propBusinessId || "");

  const supabase = createClient();

  const resolveCurrentBusinessId = useCallback(async (): Promise<string> => {
    if (propBusinessId) {
      if (activeBusinessId !== propBusinessId) {
        setActiveBusinessId(propBusinessId);
      }
      return propBusinessId;
    }
    if (activeBusinessId) {
      return activeBusinessId;
    }

    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const bParam = params.get("businessId")?.trim();
        if (bParam) {
          setActiveBusinessId(bParam);
          return bParam;
        }
        const match = window.location.pathname.match(/\/comercio\/([^/]+)/);
        if (match && match[1]) {
          const pathBizId = decodeURIComponent(match[1]).trim();
          setActiveBusinessId(pathBizId);
          return pathBizId;
        }
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: member } = await supabase
          .from("business_members")
          .select("business_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        if (member?.business_id) {
          setActiveBusinessId(member.business_id);
          return member.business_id;
        }
      }
    } catch (err) {
      console.warn("No se pudo resolver el businessId:", err);
    }
    return "";
  }, [propBusinessId, activeBusinessId, supabase]);

  useEffect(() => {
    void resolveCurrentBusinessId();
  }, [resolveCurrentBusinessId]);

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
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // AudioContext opcional
    }
  };

  const lookupCustomerDetails = useCallback(async (idOrCode: string) => {
    const cleanInput = idOrCode.replace(/^CLI\s*-\s*/i, "").trim();
    try {
      const currentBusinessId = await resolveCurrentBusinessId();
      if (!currentBusinessId) {
        setClientDisplayName(cleanInput);
        return cleanInput;
      }

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanInput);
      let query = supabase
        .from("customers")
        .select("id, first_name, last_name, unique_code, current_stamps, business_id");

      if (isUUID) {
        query = query.eq("id", cleanInput).eq("business_id", currentBusinessId);
      } else {
        query = query.eq("unique_code", cleanInput).eq("business_id", currentBusinessId);
      }

      const { data } = await query.maybeSingle();
      if (data) {
        const fullName = `${data.first_name || ""} ${data.last_name || ""}`.trim();
        setClientDisplayName(fullName || data.unique_code || cleanInput);
        setCurrentStamps(typeof data.current_stamps === "number" ? data.current_stamps : 0);
        setResolvedCustomerId(data.id);
        return data.id;
      }
    } catch (err) {
      console.warn("No se pudo obtener el nombre previo del cliente:", err);
    }
    setClientDisplayName(cleanInput);
    return cleanInput;
  }, [resolveCurrentBusinessId, supabase]);

  const handleScanSuccess = useCallback(async (rawText: string) => {
    if (status === "detected" || status === "processing" || status === "success" || isPaused) {
      return;
    }

    const detectedId = parseQrContent(rawText);
    if (!detectedId) return;

    playBeep();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(120);
    }

    setIsPaused(true);
    setClientId(detectedId);
    setStatus("detected");
    setErrorMessage("");

    await lookupCustomerDetails(detectedId);
  }, [status, isPaused, lookupCustomerDetails]);

  const handleScanAgain = () => {
    setErrorMessage("");
    setStatus("scanning");
    setClientId("");
    setResolvedCustomerId("");
    setClientDisplayName("");
    setCurrentStamps(null);
    setIsPaused(false);
  };

  const handleAddStamp = async (targetClientId: string) => {
    const idToSend = (resolvedCustomerId || targetClientId).replace(/^CLI\s*-\s*/i, "").trim();
    if (!idToSend) return;
    setStatus("processing");
    setErrorMessage("");

    try {
      const currentBusinessId = await resolveCurrentBusinessId();
      if (!currentBusinessId) {
        throw new Error("No se pudo identificar el comercio autenticado (businessId).");
      }

      const response = await fetch("/api/stamps/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: idToSend,
          clientId: idToSend,
          customerId: resolvedCustomerId || undefined,
          businessId: currentBusinessId,
          method: "QR",
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        const text = await response.text().catch(() => "");
        data = { error: text || `HTTP ${response.status} ${response.statusText}` };
      }

      if (!response.ok) {
        const rawErrMsg =
          data?.error ||
          data?.message ||
          data?.details ||
          (typeof data === "string" ? data : JSON.stringify(data)) ||
          `HTTP Error ${response.status}`;
        const errorObj = new Error(rawErrMsg);
        (errorObj as any).response = { data, status: response.status, statusText: response.statusText };
        throw errorObj;
      }

      playBeep();
      setStatus("success");
      const newTotal = typeof data.newTotal === "number" ? data.newTotal : (currentStamps ? currentStamps + 1 : 1);
      setCurrentStamps(newTotal);

      if (onStampSuccess) {
        onStampSuccess(idToSend, newTotal);
      }
    } catch (err: any) {
      console.error("Fallo exacto en backend:", err);
      const rawError =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        (typeof err === "object" ? JSON.stringify(err) : String(err)) ||
        "Error desconocido al procesar";

      setErrorMessage(String(rawError));
      setStatus("detected");
    }
  };

  return (
    <div
      className={`w-full max-w-md mx-auto flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden font-sans ${className}`}
    >
      {/* Cabecera del Escáner */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200">
            <QrCode size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">
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
                      : "bg-zinc-600"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    status === "scanning"
                      ? "bg-emerald-400"
                      : status === "detected"
                      ? "bg-amber-400"
                      : "bg-zinc-500"
                  }`}
                />
              </span>
              <span className="text-[11px] font-medium text-zinc-400">
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
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cerrar escáner"
          >
            <XCircle size={18} />
          </button>
        )}
      </div>

      {/* Visor de Cámara Central */}
      <div className="relative p-5 flex flex-col items-center">
        <div className="relative w-full aspect-square max-w-[320px] rounded-2xl overflow-hidden bg-black border border-zinc-800">
          <Scanner
            onScan={(result) => {
              if (result && result.length > 0 && result[0]?.rawValue) {
                handleScanSuccess(result[0].rawValue);
              }
            }}
            onError={(err) => console.log(err)}
            paused={isPaused || status === "detected" || status === "processing" || status === "success"}
            sound={false}
            components={{ finder: true, audio: false } as any}
            styles={{
              container: { width: "100%", height: "100%" },
              video: { objectFit: "cover", width: "100%", height: "100%" },
            }}
          />
        </div>

        {status === "scanning" && (
          <p className="mt-4 text-center text-xs sm:text-sm font-medium text-zinc-400 tracking-tight">
            Apuntá al QR del cliente para sumar un sello
          </p>
        )}

        {status === "detected" && (
          <div className="w-full mt-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-white">
                  <User size={20} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                    Cliente Detectado
                  </span>
                  <p className="text-sm font-semibold text-white truncate">
                    {clientDisplayName || clientId}
                  </p>
                  {currentStamps !== null && (
                    <span className="text-[11px] font-medium text-emerald-400">
                      Tiene actualmente {currentStamps} {currentStamps === 1 ? "sello" : "sellos"}
                    </span>
                  )}
                </div>
              </div>

              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                QR Válido
              </span>
            </div>

            {errorMessage && (
              <p className="text-xs font-mono font-medium text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl break-words whitespace-pre-wrap">
                {errorMessage}
              </p>
            )}

            <button
              type="button"
              onClick={() => handleAddStamp(clientId)}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-white text-black py-3.5 px-4 text-sm font-semibold hover:bg-gray-200 active:scale-[0.99] transition-all cursor-pointer"
            >
              <Zap size={16} />
              <span>Sumar 1 Sello a {clientDisplayName || clientId}</span>
            </button>

            <button
              type="button"
              onClick={handleScanAgain}
              className="w-full py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer text-center"
            >
              Descartar y volver a escanear
            </button>
          </div>
        )}

        {status === "processing" && (
          <div className="w-full mt-4 p-5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center gap-2">
            <Loader2 size={24} className="animate-spin text-white" />
            <p className="text-xs font-medium text-zinc-300">
              Registrando sello en la tarjeta...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="w-full mt-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 size={24} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-white">
                  Sello sumado con éxito
                </h4>
                <p className="text-xs text-emerald-400 leading-tight mt-0.5">
                  Se acreditó 1 sello a {clientDisplayName || clientId}.
                  {currentStamps !== null && ` Ahora tiene ${currentStamps} sellos.`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleScanAgain}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black py-3.5 px-4 text-xs sm:text-sm font-semibold hover:bg-gray-200 active:scale-[0.99] transition-all cursor-pointer"
            >
              <RefreshCw size={16} />
              <span>Volver a escanear</span>
            </button>
          </div>
        )}
      </div>

      {/* Pie de ayuda */}
      <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-[11px] text-zinc-500">
        <span>Terminal de Caja Mimo</span>
        <span className="font-mono">v1.0</span>
      </div>
    </div>
  );
}
