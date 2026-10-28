"use client";

import QRCode from "react-qr-code";
import type { BarcodeFormat } from "@/lib/wallet-config";

function seeded(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
}

/** QR real; PDF417 y Aztec son representaciones orientativas con la forma del formato. */
export default function WalletBarcode({ format, value, size = 200, className = "" }: { format: BarcodeFormat; value: string; size?: number; className?: string }) {
  if (format === 'QR') return <QRCode value={value || ' '} size={size} className={`min-w-[200px] min-h-[200px] ${className}`} />;
  const rand = seeded(`${format}:${value}`);

  if (format === 'PDF417') {
    const rows = 9, cols = 34, w = size * 1.9, h = size * .7;
    return <svg width={w} height={h} viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none" role="img" aria-label="Código PDF417 de ejemplo" shapeRendering="crispEdges">
      {Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => {
        const edge = c < 3 || c >= cols - 3;
        const on = edge ? (c % 2 === 0) : rand() > .5;
        return on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#111" /> : null;
      }))}
    </svg>;
  }

  const n = 23, mid = 11;
  return <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} role="img" aria-label="Código Aztec de ejemplo" shapeRendering="crispEdges">
    {Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => {
      const ring = Math.max(Math.abs(r - mid), Math.abs(c - mid));
      const on = ring <= 4 ? ring % 2 === 0 || ring === 0 : rand() > .5;
      return on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#111" /> : null;
    }))}
  </svg>;
}
