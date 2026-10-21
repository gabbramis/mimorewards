"use client";

import { useEffect, useState } from "react";

export type DevicePlatform = "ios" | "android" | "desktop" | "unknown";

/**
 * Función pura para detectar la plataforma según navigator.userAgent y capacidades táctiles.
 * - 'ios': iPhone, iPod, iPad (contemplando iPadOS moderno con userAgent Mac + touch points).
 * - 'android': Dispositivos que incluyan /android/i en userAgent.
 * - 'desktop': Navegadores en computadoras de escritorio (Mac, Windows, Linux).
 * - 'unknown': Entorno de servidor (SSR) o agente no identificado.
 */
export function detectPlatform(): DevicePlatform {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "unknown";
  }

  const ua = navigator.userAgent || "";
  const platform = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || "";

  // Detección iOS: iPhone, iPad o iPod clásico
  const isIOSDevice = /iPad|iPhone|iPod/i.test(ua);

  // iPadOS moderno (iPadOS 13+ reporta 'Macintosh' en userAgent pero cuenta con pantalla táctil multitouch)
  const isIPadOS = /Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1;

  if (isIOSDevice || isIPadOS) {
    return "ios";
  }

  // Detección Android
  if (/android/i.test(ua)) {
    return "android";
  }

  // Detección de sistemas de escritorio
  if (/Macintosh|Windows|Linux/i.test(ua) || /Mac|Win|Linux/i.test(platform)) {
    return "desktop";
  }

  return "desktop";
}

/**
 * Hook de React que ejecuta la detección en el cliente dentro de useEffect
 * para garantizar coherencia con SSR y evitar errores de hidratación (hydration mismatch).
 */
export function useDevicePlatform(): { platform: DevicePlatform; isMounted: boolean } {
  const [platform, setPlatform] = useState<DevicePlatform>("unknown");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsMounted(true);
  }, []);

  return { platform, isMounted };
}
