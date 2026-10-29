"use client";

import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { Eyebrow } from "./ui";
import { plansSummary } from "./plans";
export { EarlyAccess } from "./LeadForm";

export function LegalDialog({ type, close }: { type: "privacy" | "terms"; close: () => void }) {
  const ref = useRef<HTMLDialogElement | null>(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="m-legal-dialog" onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }} aria-labelledby="m-legal-title">
    <div className="m-legal-inner">
      <button onClick={close} className="m-dialog-close" aria-label="Cerrar"><X size={22} /></button>
      <Eyebrow>ETAPA DE LANZAMIENTO</Eyebrow>
      <h2 id="m-legal-title">{type === "privacy" ? "Tu privacidad importa" : "Sobre esta etapa de mimo"}</h2>
      {type === "privacy" ? <>
        <p>Al enviar el formulario, tu nombre, negocio, WhatsApp y plan de interés llegan por correo al equipo de mimo para responderte por WhatsApp. No se guardan en una base de datos ni se usan para suscribirte a campañas.</p>
        <p>Podés pedir que dejemos de contactarte o eliminemos tu consulta escribiendo a contactomimorewards@gmail.com.</p>
        <p>Antes de registrar clientes en el producto, cada comercio deberá contar con la información de privacidad y los consentimientos correspondientes.</p>
      </> : <>
        <p>mimo rewards está preparando sus primeras implementaciones. Las imágenes, las métricas y las tarjetas de esta página son ejemplos de la experiencia propuesta.</p>
        <p>{plansSummary} El plazo de entrega, la definición de cliente activo y las condiciones del servicio se confirman antes de contratar. Consultar por un plan no implica una compra ni una reserva.</p>
        <p>Inicial usa QR; Profesional y Premium agregan NFC. La disponibilidad de campañas, automatizaciones y opciones de Wallet se confirma durante el alta. Los push dependen de la plataforma y los permisos del cliente. Las solicitudes de reseñas en Google Maps están en desarrollo.</p>
      </>}
      <button className="m-button m-button-primary" onClick={close}>Entendido <Check size={17} /></button>
    </div>
  </dialog>;
}
