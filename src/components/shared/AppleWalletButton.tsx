"use client";

import React from "react";

/**
 * Mapeo web del enum oficial de Apple PKAddPassButtonStyle:
 * https://developer.apple.com/documentation/passkit/pkaddpassbuttonstyle
 * - 'black': Botón negro estándar con texto blanco y borde sutil.
 * - 'blackOutline': Botón negro con contorno blanco nítido para fondos oscuros o con color.
 */
export type PKAddPassButtonStyle = "black" | "blackOutline";

export interface AppleWalletButtonProps {
  /** Estilo oficial equivalente a PKAddPassButtonStyle de Apple PassKit ('black' o 'blackOutline') */
  addPassButtonStyle?: PKAddPassButtonStyle;
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
  /** Subtítulo superior (por defecto: "Agregar a") */
  sublabel?: string;
  /** Título principal (por defecto: "Apple Wallet") */
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
  /** Atributo download para forzar descarga */
  download?: string | boolean;
  /** Tipo de botón HTML */
  type?: "button" | "submit" | "reset";
}

/**
 * Icono oficial de Apple Wallet con los vectores y proporciones idénticos
 * al badge oficial de Apple Developer (cyan, amarillo, verde, rojo y bolsillo frontal con muesca).
 */
export function AppleWalletOfficialIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="32"
      height="25"
      viewBox="7.5 7 26.5 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <path
          id="aw-pocket-clip"
          d="M33.601,21.437c0,0.199,0,0.398-0.001,0.597c-0.001,0.168-0.003,0.335-0.008,0.503 c-0.01,0.365-0.032,0.733-0.097,1.094c-0.067,0.367-0.176,0.708-0.347,1.041c-0.169,0.327-0.389,0.627-0.652,0.886 c-0.263,0.26-0.566,0.477-0.898,0.644c-0.337,0.169-0.683,0.277-1.054,0.343c-0.366,0.065-0.739,0.086-1.109,0.096 c-0.17,0.005-0.34,0.006-0.509,0.007c-0.202,0.001-0.403,0.001-0.605,0.001l-0.168,0H15.155l-2.316,0 c-0.202,0-0.403,0-0.605-0.001c-0.17-0.001-0.34-0.003-0.509-0.007c-0.37-0.01-0.743-0.031-1.109-0.096 c-0.371-0.066-0.717-0.173-1.054-0.343c-0.331-0.167-0.635-0.384-0.898-0.644c-0.263-0.26-0.483-0.559-0.652-0.886 c-0.172-0.333-0.281-0.674-0.347-1.041C7.6,23.27,7.578,22.902,7.568,22.537c-0.005-0.168-0.007-0.335-0.008-0.503 c-0.001-0.199-0.001-0.398-0.001-0.597l0-2.286v-6.999l0-1.459c0-0.127,0-0.254,0.001-0.381 c0.001-0.107,0.002-0.214,0.005-0.321c0.006-0.233,0.02-0.468,0.062-0.698c0.043-0.234,0.112-0.452,0.222-0.664 c0.108-0.209,0.248-0.4,0.416-0.565c0.168-0.166,0.361-0.305,0.573-0.411C9.052,7.544,9.273,7.475,9.51,7.433 c0.233-0.041,0.472-0.055,0.708-0.061c0.108-0.003,0.217-0.004,0.325-0.005c0.129-0.001,0.257-0.001,0.386-0.001l1.478,0h17.722 l-1.373,0.001l1.478-0.001c0.129,0,0.257,0,0.386,0.001c0.108,0.001,0.217,0.002,0.325,0.005 c0.236,0.006,0.474,0.02,0.708,0.061c0.237,0.042,0.457,0.111,0.672,0.219c0.211,0.106,0.405,0.245,0.573,0.411 c0.168,0.166,0.308,0.357,0.416,0.565c0.11,0.213,0.179,0.43,0.222,0.664c0.042,0.23,0.056,0.465,0.062,0.698 c0.003,0.107,0.004,0.214,0.005,0.321c0.001,0.127,0.001,0.254,0.001,0.381l0,1.459v6.999L33.601,21.437z"
        />
        <clipPath id="aw-clip">
          <use href="#aw-pocket-clip" />
        </clipPath>
        <linearGradient id="aw-grad" x1="20.58" y1="16.4" x2="20.58" y2="18.35" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#D3D1C8" />
          <stop offset="0.23" stopColor="#C4C3BB" />
          <stop offset="0.69" stopColor="#A5A59F" />
          <stop offset="1" stopColor="#8C8D88" />
        </linearGradient>
      </defs>
      {/* Fondo de billetera */}
      <path
        clipPath="url(#aw-clip)"
        fill="#D3D1C8"
        d="M33.601,9.87v16.78H7.559V9.852c0-1.423,1.101-2.457,2.459-2.457h21.123c1.358,0,2.459,1.025,2.459,2.457C33.601,9.858,33.601,9.864,33.601,9.87z"
      />
      <rect x="7.56" y="16.4" width="26.04" height="1.94" clipPath="url(#aw-clip)" fill="url(#aw-grad)" />
      {/* Tarjetas de colores oficiales */}
      <g clipPath="url(#aw-clip)">
        {/* Tarjeta Cyan/Azul */}
        <path
          fill="#319DCC"
          d="M8.644,20.764V11.55l0-0.936c0-0.5,0.2-0.9,0.5-1.15c0.3-0.25,0.7-0.35,1.1-0.35h20.5c0.4,0,0.8,0.1,1.1,0.35c0.3,0.25,0.5,0.65,0.5,1.15v10.15H8.644z"
        />
        {/* Tarjeta Amarilla */}
        <path
          fill="#FDB921"
          d="M8.644,22.932v-9.214l0-0.936c0-0.5,0.2-0.9,0.5-1.15c0.3-0.25,0.7-0.35,1.1-0.35h20.5c0.4,0,0.8,0.1,1.1,0.35c0.3,0.25,0.5,0.65,0.5,1.15v10.15H8.644z"
        />
        {/* Tarjeta Verde */}
        <path
          fill="#71BF49"
          d="M8.644,25.1v-9.214l0-0.936c0-0.5,0.2-0.9,0.5-1.15c0.3-0.25,0.7-0.35,1.1-0.35h20.5c0.4,0,0.8,0.1,1.1,0.35c0.3,0.25,0.5,0.65,0.5,1.15v10.15H8.644z"
        />
        {/* Tarjeta Roja */}
        <path
          fill="#F37163"
          d="M8.644,25.1v-7.046l0-0.936c0-0.5,0.2-0.9,0.5-1.15c0.3-0.25,0.7-0.35,1.1-0.35h20.5c0.4,0,0.8,0.1,1.1,0.35c0.3,0.25,0.5,0.65,0.5,1.15v8.33H8.644z"
        />
      </g>
      {/* Bolsillo exterior con muesca central de extracción */}
      <path
        clipPath="url(#aw-clip)"
        fill="#D3D1C8"
        d="M33.601,26.906H7.559v-9.756l6.324,0c0.155,0,0.311,0,0.466,0.001c0.131,0.001,0.262,0.002,0.392,0.006c0.285,0.008,0.572,0.024,0.854,0.075c0.286,0.051,0.552,0.135,0.812,0.267c-0.055-0.028,0.715,0.288,1.391,1.339c0.488,0.758,1.436,1.562,2.763,1.562s2.276-0.804,2.763-1.562c0.642-0.998,1.356-1.322,1.39-1.339c0.26-0.132,0.526-0.216,0.812-0.267c0.282-0.051,0.569-0.067,0.854-0.075c0.131-0.004,0.262-0.005,0.392-0.006c0.155-0.001,0.311-0.001,0.466-0.001l6.362,0V26.906z"
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

const SYSTEM_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * Botón oficial de "Agregar a Apple Wallet" cumpliendo las especificaciones
 * de diseño de Apple para la web:
 * - Altura mínima de 44px (estándar 48px)
 * - Fondo negro (#000000)
 * - Lockup oficial de 2 líneas ("Agregar a" / "Apple Wallet") o texto personalizado
 * - Tipografía de sistema (-apple-system / SF Pro)
 * - Esquinas redondeadas (~10px)
 * - Estados hover, active y soporte para loading
 */
export default function AppleWalletButton({
  href,
  onClick,
  loading = false,
  loadingText,
  addPassButtonStyle = "black",
  disabled = false,
  sublabel = "Agregar a",
  mainlabel = "Apple Wallet",
  label,
  className = "",
  style,
  target,
  rel,
  download,
  type = "button",
}: AppleWalletButtonProps) {
  const isInteractive = !disabled && !loading;
  const isOutline = addPassButtonStyle === "blackOutline";

  const baseStyles: React.CSSProperties = {
    fontFamily: SYSTEM_FONT,
    backgroundColor: "#000000",
    color: "#FFFFFF",
    minHeight: "48px",
    borderRadius: "10px",
    ...style,
  };

  const commonClasses = [
    "pk-add-pass-button PKAddPassButton",
    isOutline ? "pk-add-pass-button-black-outline" : "pk-add-pass-button-black",
    "inline-flex items-center justify-center gap-3 px-5 py-2",
    isOutline
      ? "border-[1.5px] border-white shadow-[0_0_0_1px_rgba(255,255,255,0.2)]"
      : "border border-white/20 shadow-md",
    "select-none cursor-pointer text-center no-underline",
    "transition-all duration-150 ease-out",
    isInteractive
      ? isOutline
        ? "hover:bg-[#1a1a1a] hover:border-white active:bg-[#2c2c2e] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white"
        : "hover:bg-[#141414] hover:border-white/30 hover:shadow-lg active:bg-[#222222] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black"
      : "opacity-60 cursor-not-allowed pointer-events-none",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const badgeContent = (
    <>
      {loading ? <LoadingSpinner /> : <AppleWalletOfficialIcon />}
      {loading ? (
        <span className="text-[14px] font-medium tracking-tight text-white">
          {loadingText || "Generando pase…"}
        </span>
      ) : label ? (
        <span className="text-[15px] font-medium tracking-tight text-white">
          {label}
        </span>
      ) : (
        <div className="flex flex-col text-left leading-[1.15]">
          <span className="text-[10.5px] font-medium tracking-tight text-white/85">
            {sublabel}
          </span>
          <span className="text-[16px] font-semibold tracking-[-0.25px] text-white">
            {mainlabel}
          </span>
        </div>
      )}
    </>
  );

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
        aria-label={`${sublabel} ${mainlabel}`}
      >
        {badgeContent}
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
      aria-label={`${sublabel} ${mainlabel}`}
    >
      {badgeContent}
    </button>
  );
}
