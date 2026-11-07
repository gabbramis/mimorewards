"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import QRCodeLib from "qrcode";
import { Check, Copy, Download, ExternalLink, Loader2, QrCode as QrIcon } from "lucide-react";
import CounterPosterDownloads from "./CounterPosterDownloads";

interface CounterQrCardProps {
  businessId: string;
  businessSlug?: string | null;
  businessName: string;
  qrUrl?: string;
}

export default function CounterQrCard({
  businessId,
  businessSlug,
  businessName,
  qrUrl: propQrUrl,
}: CounterQrCardProps) {
  const qrUrl = propQrUrl || `https://mimorewards.com/t/${businessSlug || businessId}`;
  const url = qrUrl;
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error al copiar enlace:", err);
    }
  };

  const handleDownload = async () => {
    if (!url) return;
    setDownloading(true);
    try {
      const dataUrl = await QRCodeLib.toDataURL(url, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: "H",
        color: {
          dark: "#09090b",
          light: "#FFFFFF",
        },
      });

      const cleanName = (businessName || "comercio")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `qr-mostrador-${cleanName || "mimo"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error al descargar QR:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div>
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300">
              <QrIcon size={18} />
            </div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              Tu QR para el mostrador
            </h3>
          </div>
        </div>

        {/* QR centrado */}
        <div className="my-3 flex flex-col items-center justify-center">
          <div
            data-qr-box="true"
            className="relative rounded-2xl border border-zinc-800 bg-white p-4 transition-transform duration-200 hover:scale-[1.01]"
          >
            {url ? (
              <div data-qr-box="true" className="flex items-center justify-center bg-white">
                <QRCode
                  value={url}
                  size={164}
                  level="M"
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  viewBox="0 0 256 256"
                />
              </div>
            ) : (
              <div className="flex h-[164px] w-[164px] items-center justify-center bg-zinc-950 text-zinc-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>

          {/* Enlace público con botón copiar */}
          {url && (
            <div className="mt-3 flex w-full max-w-[260px] items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs">
              <span className="truncate font-mono text-[11px] text-zinc-400">
                {url}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copiar link"
                  className="inline-flex items-center gap-1 font-medium text-white hover:text-zinc-300 cursor-pointer"
                >
                  {copied ? (
                    <Check size={13} className="text-emerald-400" />
                  ) : (
                    <Copy size={13} />
                  )}
                  <span>{copied ? "Copiado" : "Copiar"}</span>
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir página de registro"
                  className="text-zinc-400 hover:text-white"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Acciones y texto de ayuda inferior */}
      <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-col items-center">
        <CounterPosterDownloads businessId={businessId} />
        <button
          type="button"
          onClick={handleDownload}
          disabled={!url || downloading}
          className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 px-4 py-2.5 text-xs sm:text-sm font-medium hover:bg-zinc-800 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
        >
          {downloading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          <span>{downloading ? "Generando imagen…" : "Descargar solo QR (PNG)"}</span>
        </button>

        <p className="mt-2.5 text-center text-xs text-zinc-400 leading-relaxed">
          Imprimí este código y dejalo a la vista. Tus clientes lo escanean para llevarse tu tarjeta en su celular.
        </p>
      </div>
    </div>
  );
}
