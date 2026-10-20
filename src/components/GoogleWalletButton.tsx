"use client";

import React from "react";

export interface GoogleWalletButtonProps {
  /** Enlace directo si se dispone de la URL de guardado */
  href?: string;
  /** Manejador al hacer clic */
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  /** Estado de carga */
  loading?: boolean;
  /** Texto durante la carga */
  loadingText?: string;
  /** Deshabilita la interacción */
  disabled?: boolean;
  /** Subtítulo superior (por defecto: "Agregar a") */
  sublabel?: string;
  /** Título principal (por defecto: "Google Wallet") */
  mainlabel?: string;
  /** Texto plano opcional para sobrescribir el lockup oficial de dos líneas */
  label?: string;
  /** Clases CSS adicionales */
  className?: string;
  /** Estilos en línea */
  style?: React.CSSProperties;
  /** Destino del enlace (ej: "_blank") */
  target?: string;
  /** Relación del enlace */
  rel?: string;
  /** Tipo de botón HTML */
  type?: "button" | "submit" | "reset";
}

/**
 * Isotipo oficial de Google Wallet con los 4 colores vectoriales exactos
 * (Verde, Amarillo, Rojo y degradado Azul de Google).
 */
export function GoogleWalletOfficialIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="30"
      height="25"
      viewBox="21 12 36 31"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="gw-official-blue"
          x1="37.28"
          y1="34.04"
          x2="18.78"
          y2="55.72"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4285F4" />
          <stop offset="1" stopColor="#1B74E8" />
        </linearGradient>
      </defs>
      <path
        d="M57 23.791H21V18.1456C21 15.0809 23.6422 12.5001 26.7798 12.5001H51.2202C54.3578 12.5001 57 15.0809 57 18.1456V23.791Z"
        fill="#34A853"
      />
      <path
        d="M57 29H21V23C21 19.7429 23.6422 17 26.7798 17H51.2202C54.3578 17 57 19.7429 57 23V29Z"
        fill="#FBBC04"
      />
      <path
        d="M57 34H21V28C21 24.7429 23.6422 22 26.7798 22H51.2202C54.3578 22 57 24.7429 57 28V34Z"
        fill="#EA4335"
      />
      <path
        d="M21 25.2409L43.8493 30.4025C46.4795 31.0477 49.4384 30.4025 51.5753 28.7895L57 24.9183V37.0157C57 40.0804 54.3699 42.4999 51.2466 42.4999H26.7534C23.6301 42.4999 21 40.0804 21 37.0157V25.2409Z"
        fill="url(#gw-official-blue)"
      />
    </svg>
  );
}

function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin shrink-0 text-white ${className}`}
      width="20"
      height="20"
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

const GOOGLE_FONT =
  '"Google Sans", "Product Sans", Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/**
 * Botón oficial de "Agregar a Google Wallet" siguiendo fielmente las pautas
 * de marca de Google Wallet (pill badge con borde #747775 y fondo #1F1F1F).
 */
export default function GoogleWalletButton({
  href,
  onClick,
  loading = false,
  loadingText,
  disabled = false,
  sublabel = "Agregar a",
  mainlabel = "Google Wallet",
  label,
  className = "",
  style,
  target,
  rel,
  type = "button",
}: GoogleWalletButtonProps) {
  const isInteractive = !disabled && !loading;

  const baseStyles: React.CSSProperties = {
    fontFamily: GOOGLE_FONT,
    backgroundColor: "#1F1F1F",
    color: "#FFFFFF",
    minHeight: "48px",
    borderRadius: "9999px",
    ...style,
  };

  const commonClasses = [
    "inline-flex items-center justify-center gap-3 px-5 py-2",
    "border border-[#747775] shadow-md",
    "select-none cursor-pointer text-center no-underline",
    "transition-all duration-150 ease-out",
    isInteractive
      ? "hover:bg-[#2C2C2C] hover:border-[#8E918F] hover:shadow-lg active:bg-[#383838] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white"
      : "opacity-60 cursor-not-allowed pointer-events-none",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const badgeContent = (
    <>
      {loading ? <LoadingSpinner /> : <GoogleWalletOfficialIcon />}
      {loading ? (
        <span className="text-[14px] font-medium tracking-tight text-white">
          {loadingText || "Abriendo…"}
        </span>
      ) : label ? (
        <span className="text-[15px] font-medium tracking-tight text-white">
          {label}
        </span>
      ) : (
        <div className="flex flex-col text-left leading-[1.15]">
          <span className="text-[10.5px] font-medium tracking-normal text-[#E3E3E3]">
            {sublabel}
          </span>
          <span className="text-[16px] font-medium tracking-[-0.2px] text-white">
            {mainlabel}
          </span>
        </div>
      )}
    </>
  );

  if (href && isInteractive) {
    return (
      <a
        href={href}
        onClick={onClick}
        target={target}
        rel={rel}
        className={commonClasses}
        style={baseStyles}
        aria-label={`${sublabel} ${mainlabel}`}
      >
        {badgeContent}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={isInteractive ? onClick : undefined}
      disabled={!isInteractive}
      className={commonClasses}
      style={baseStyles}
      aria-busy={loading}
      aria-label={`${sublabel} ${mainlabel}`}
    >
      {badgeContent}
    </button>
  );
}
