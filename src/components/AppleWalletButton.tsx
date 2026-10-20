"use client";

import React from "react";

export interface AppleWalletButtonProps {
  /** Enlace directo para abrir/descargar el archivo .pkpass */
  href?: string;
  /** Manejador de evento al hacer clic */
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  /** Indica si la tarjeta se está generando o descargando */
  loading?: boolean;
  /** Texto a mostrar durante el estado de carga */
  loadingText?: string;
  /** Deshabilita la interacción */
  disabled?: boolean;
  /** Texto principal del botón (por defecto: "Agregar a Apple Wallet") */
  label?: string;
  /** Clases CSS adicionales */
  className?: string;
  /** Estilos en línea */
  style?: React.CSSProperties;
  /** Destino del enlace (ej: "_blank") */
  target?: string;
  /** Relación del enlace */
  rel?: string;
  /** Atributo download para forzar descarga */
  download?: string | boolean;
  /** Tipo de botón HTML */
  type?: "button" | "submit" | "reset";
}

/**
 * Icono oficial de Apple Wallet con las tarjetas características
 * en cyan, amarillo y rojo sobre el tarjetero oscuro.
 */
function AppleWalletIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      width="28"
      height="20"
      viewBox="0 0 28 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Tarjeta trasera 1: Cyan / Azul */}
      <rect
        x="2.5"
        y="1.2"
        width="15"
        height="12"
        rx="2"
        transform="rotate(-8 2.5 1.2)"
        fill="#0A84FF"
      />
      {/* Tarjeta intermedia 2: Amarillo / Dorado */}
      <rect
        x="6.2"
        y="0.6"
        width="15"
        height="12"
        rx="2"
        fill="#FFD60A"
      />
      {/* Tarjeta frontal 3: Rojo / Coral */}
      <rect
        x="9.8"
        y="1.2"
        width="15"
        height="12"
        rx="2"
        transform="rotate(8 9.8 1.2)"
        fill="#FF3B30"
      />
      {/* Cartera frontal oscura */}
      <path
        d="M1 5.5C1 3.567 2.567 2 4.5 2H23.5C25.433 2 27 3.567 27 5.5V16.5C27 18.433 25.433 20 23.5 20H4.5C2.567 20 1 18.433 1 16.5V5.5Z"
        fill="#1C1C1E"
        stroke="#3A3A3C"
        strokeWidth="0.8"
      />
      {/* Muesca superior de la cartera */}
      <path
        d="M10 2C10 3.65685 11.3431 5 13 5H15C16.6569 5 18 3.65685 18 2H10Z"
        fill="#2C2C2E"
      />
    </svg>
  );
}

/**
 * Spinner giratorio para el estado de carga
 */
function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin shrink-0 text-white ${className}`}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

const SYSTEM_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * Botón oficial de "Agregar a Apple Wallet" cumpliendo las especificaciones
 * de diseño de Apple para la web:
 * - Altura mínima de 44px
 * - Fondo negro (#000000)
 * - Texto en 15px con tipografía de sistema (-apple-system)
 * - Esquinas redondeadas (~10px)
 * - Estados hover, active y soporte para loading
 */
export default function AppleWalletButton({
  href,
  onClick,
  loading = false,
  loadingText,
  disabled = false,
  label = "Agregar a Apple Wallet",
  className = "",
  style,
  target,
  rel,
  download,
  type = "button",
}: AppleWalletButtonProps) {
  const isInteractive = !disabled && !loading;
  const displayText = loading ? (loadingText || "Cargando…") : label;

  const baseStyles: React.CSSProperties = {
    fontFamily: SYSTEM_FONT,
    backgroundColor: "#000000",
    color: "#FFFFFF",
    minHeight: "44px",
    borderRadius: "10px",
    ...style,
  };

  const commonClasses = [
    "inline-flex items-center justify-center gap-2.5 px-4 py-2.5",
    "text-[15px] font-medium leading-none tracking-[-0.24px]",
    "border border-white/10 shadow-sm",
    "select-none cursor-pointer text-center no-underline",
    "transition-all duration-150 ease-out",
    isInteractive
      ? "hover:bg-[#1a1a1a] hover:border-white/20 hover:shadow-md active:bg-[#2c2c2e] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black"
      : "opacity-60 cursor-not-allowed pointer-events-none",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Si tiene href y está interactivo, renderizar como elemento <a> para soporte nativo directo en Safari
  if (href && isInteractive) {
    return (
      <a
        href={href}
        onClick={onClick}
        target={target}
        rel={rel}
        download={download}
        className={commonClasses}
        style={baseStyles}
        aria-label={label}
      >
        <AppleWalletIcon />
        <span>{displayText}</span>
      </a>
    );
  }

  // En caso contrario (o si está cargando/deshabilitado), renderizar como <button>
  return (
    <button
      type={type}
      onClick={isInteractive ? onClick : undefined}
      disabled={!isInteractive}
      className={commonClasses}
      style={baseStyles}
      aria-busy={loading}
      aria-label={label}
    >
      {loading ? <LoadingSpinner /> : <AppleWalletIcon />}
      <span>{displayText}</span>
    </button>
  );
}
