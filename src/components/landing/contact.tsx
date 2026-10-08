"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, Check, Heart, X } from "lucide-react";
import { Eyebrow, Reveal } from "./ui";

// Configure before launch. The form prepares an email; it does not store leads.
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_MIMO_CONTACT_EMAIL?.trim() || "";

export function EarlyAccess({ onPrivacy }: { onPrivacy: () => void }) {
  const [status, setStatus] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!CONTACT_EMAIL) {
      setStatus("Las solicitudes todavía no están habilitadas. Estamos preparando el acceso anticipado: volvé pronto para sumarte. Tus datos no se enviaron.");
      return;
    }
    const fields = new FormData(event.currentTarget);
    const value = (name: string) => String(fields.get(name) ?? "").trim();
    const body = `¡Hola! Quiero probar mimo rewards.\n\nNombre: ${value("name")}\nComercio: ${value("business")}\nWhatsApp: ${value("phone")}\nEmail: ${value("email")}\n\nAcepto que me contacten sobre el acceso anticipado.`;
    window.location.href = `mailto:${encodeURIComponent(CONTACT_EMAIL)}?subject=${encodeURIComponent("Quiero usar mimo — acceso anticipado")}&body=${encodeURIComponent(body)}`;
    setStatus("Tu aplicación de correo se abrirá con la consulta lista. Enviá ese correo para completar tu solicitud.");
  }
  return <section id="acceso" className="m-access"><div className="m-container m-access-grid"><Reveal className="m-access-copy"><Eyebrow light>SE VIENEN COSAS LINDAS</Eyebrow><h2>Tu próximo cliente<br />frecuente empieza<br />con un <span>mimo.</span></h2><p>¿Querés probar mimo en tu comercio? Estamos preparando las primeras implementaciones y buscamos comercios que quieran sumarse desde el principio.</p><div className="m-access-note"><span><Heart size={22} fill="currentColor" /></span><div><strong>Hecho para comercios como el tuyo.</strong><small>Acceso anticipado · Sin compromiso</small></div></div></Reveal><Reveal className="m-access-form-wrap"><h3>Mimar a tus clientes nunca fue tan fácil.</h3><p>Dejanos tus datos y conversemos.</p><form onSubmit={submit}><div className="m-form-row"><label>Tu nombre<input name="name" autoComplete="name" placeholder="Ej. Sofía" required maxLength={100} pattern=".*\S.*" /></label><label>Tu comercio<input name="business" autoComplete="organization" placeholder="Nombre del comercio" required maxLength={150} pattern=".*\S.*" /></label></div><label>WhatsApp<input name="phone" type="tel" autoComplete="tel" placeholder="+598 99 123 456" required minLength={7} maxLength={25} pattern="[+0-9 ]{7,25}" /></label><label>Email<input name="email" type="email" autoComplete="email" placeholder="vos@tucomercio.com" required maxLength={254} /></label><label className="m-consent"><input name="consent" type="checkbox" required /><span>Quiero que me contacten sobre mimo y leí el <button type="button" onClick={onPrivacy}>aviso de privacidad</button>.</span></label><button className="m-button m-button-primary m-form-submit" type="submit">Quiero probar mimo <ArrowUpRight size={18} /></button><p className="m-form-hint">{CONTACT_EMAIL ? "La consulta se envía desde tu aplicación de correo." : "Estamos preparando la apertura de solicitudes."}</p><p className="m-form-status" role="status">{status}</p></form></Reveal></div></section>;
}

export function LegalDialog({ type, close }: { type: "privacy" | "terms"; close: () => void }) {
  const ref = useRef<HTMLDialogElement | null>(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="m-legal-dialog" onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }} aria-labelledby="m-legal-title">
    <div className="m-legal-inner">
      <button onClick={close} className="m-dialog-close" aria-label="Cerrar"><X size={22} /></button>
      <Eyebrow>ETAPA DE LANZAMIENTO</Eyebrow>
      <h2 id="m-legal-title">{type === "privacy" ? "Tu privacidad importa" : "Sobre esta etapa de mimo"}</h2>
      {type === "privacy" ? <>
        <p>Al elegir “Agendar una demo” se abre tu aplicación de correo con un mensaje preparado para contactomimorewards@gmail.com. Esta página no guarda ni envía tus datos por sí sola: el correo se envía únicamente si vos decidís enviarlo.</p>
        <p>Usaremos los datos que incluyas en ese correo para responderte y coordinar la demo. Podés pedir que dejemos de contactarte respondiendo al intercambio.</p>
        <p>Antes de registrar clientes en el producto, cada comercio deberá contar con la información de privacidad y los consentimientos correspondientes.</p>
      </> : <>
        <p>mimo rewards está preparando sus primeras implementaciones. Las imágenes, las métricas y las tarjetas de esta página son ejemplos de la experiencia propuesta.</p>
        <p>El plan anunciado es de $1.290 por mes. El kit físico se cobra aparte y su precio, el plazo de entrega y las condiciones del servicio se confirman antes de contratar. Solicitar una demo no implica una compra ni una reserva.</p>
        <p>El QR abre el mismo recorrido que el NFC cuando el teléfono no puede usarlo. Las campañas, las integraciones y las opciones de Wallet se confirmarán para el lanzamiento.</p>
      </>}
      <button className="m-button m-button-primary" onClick={close}>Entendido <Check size={17} /></button>
    </div>
  </dialog>;
}
