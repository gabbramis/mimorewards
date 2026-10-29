"use client";

// @refresh reset
// Reset the selector on development updates instead of retaining the old A6 state.

import { useId, useState } from "react";
import { Download, Loader2 } from "lucide-react";

export default function CounterPosterDownloads({ businessId }: { businessId: string }) {
  const selectId = useId();
  const [format, setFormat] = useState("a4");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setDownloading(true);
    setError("");
    let objectUrl: string | undefined;
    try {
      const response = await fetch(`/api/comercio/${encodeURIComponent(businessId)}/counter-poster?format=${format}`);
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "No pudimos descargar el PDF. Intentá de nuevo.");
      }
      if (!response.headers.get("content-type")?.includes("application/pdf")) {
        throw new Error("Tu sesión venció. Volvé a iniciar sesión e intentá de nuevo.");
      }
      objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || `cartel-mimo-${format}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setError(error instanceof Error ? error.message : "No pudimos descargar el PDF.");
    } finally {
      if (objectUrl) {
        const downloadedUrl = objectUrl;
        setTimeout(() => URL.revokeObjectURL(downloadedUrl), 1000);
      }
      setDownloading(false);
    }
  }

  return (
    <div className="w-full space-y-2">
      <label htmlFor={selectId} className="block text-xs font-bold text-[#1F1F1F]">Cartel para imprimir</label>
      <select id={selectId} value={format} onChange={event => { setFormat(event.target.value); setError(""); }}
        disabled={downloading} className="w-full rounded-xl border border-[#D5CFC4] bg-white px-3 py-2.5 text-sm text-[#1F1F1F] disabled:opacity-50">
        <option value="a4">Grande · A4 (21 × 29,7 cm)</option>
        <option value="a6">Chico · A6 (10,5 × 14,8 cm)</option>
      </select>
      <p className="text-xs leading-relaxed text-[#737373]">
        {format === "a6" ? "Versión breve para el mostrador." : "Tu diseño completo con instrucciones para registrarse."}
        {" "}Incluye automáticamente el logo y el QR de este local.
      </p>
      <button type="button" onClick={handleDownload} disabled={downloading}
        className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#FF1F2D] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#e01826] disabled:opacity-50 sm:text-sm">
        {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {downloading ? "Preparando tu cartel…" : "Descargar PDF con los datos"}
      </button>
      {error && <p role="alert" className="text-center text-xs text-red-700">{error}</p>}
    </div>
  );
}
