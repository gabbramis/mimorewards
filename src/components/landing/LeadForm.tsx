"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, MessageCircle } from "lucide-react";
import { LEAD_PLAN_NAMES } from "@/lib/landing-leads";

export function EarlyAccess({ onPrivacy, selectedPlan = "" }: {
  onPrivacy: () => void; selectedPlan?: string;
}) {
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const fields = new FormData(event.currentTarget);
    sending.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/landing-leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ name: fields.get("name"), business: fields.get("business"), email: fields.get("email"), phone: fields.get("phone"), website: fields.get("website"), consent: true, plan: selectedPlan }),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.error || "No pudimos enviar tu consulta. Intentá nuevamente.");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error && err.name !== "TimeoutError" && err.name !== "AbortError"
        ? err.message : "No pudimos confirmar el envío. Intentá nuevamente en un momento.");
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  return <section id="acceso" className="m-contact-simple" aria-labelledby="m-contact-title">
    <div className="m-container m-contact-simple-inner">
      <div className="m-contact-simple-copy">
        <span className="m-contact-eyebrow">EL PRIMER PASO, LO DAMOS JUNTOS</span>
        <h2 id="m-contact-title">Tu negocio.<br />Sus próximas<br /><em>visitas.</em></h2>
        <p>Contanos de tu local y te escribimos por WhatsApp para mostrarte cómo funciona mimo y ayudarte a empezar.</p>
        <ul className="m-contact-reassurance">
          <li><Check size={17} />Te ayudamos a elegir el plan.</li>
          <li><Check size={17} />Coordinamos la puesta en marcha.</li>
          <li><Check size={17} />Consultar no tiene compromiso.</li>
        </ul>
      </div>
      {submitted ? <div className="m-contact-panel m-contact-simple-success" role="status" tabIndex={-1} ref={node => { node?.focus(); }}><span className="m-contact-success-icon"><Check size={28} /></span><h3>¡Gracias por escribirnos!</h3><p>Recibimos tu solicitud. Nos estaremos contactando con vos por WhatsApp para conocer tu negocio y contarte cómo empezar con mimo.</p><span className="m-contact-success-note"><MessageCircle size={16} />Seguimos la conversación por ahí.</span></div> : <form onSubmit={submit} aria-busy={pending} className="m-contact-panel">
        <h3>Hablemos de tu negocio</h3>
        <p className="m-contact-form-intro">Dejanos tus datos. Nosotros te contactamos.</p>
        {selectedPlan && <p className="m-contact-plan">Me interesa el plan {LEAD_PLAN_NAMES[selectedPlan]}.</p>}
        <fieldset disabled={pending}>
          <div className="m-contact-simple-fields">
            <label>Nombre<input name="name" autoComplete="name" placeholder="Tu nombre" required minLength={2} maxLength={100} /></label>
            <label>Nombre del negocio<input name="business" autoComplete="organization" placeholder="Ej.: Café de la esquina" required minLength={2} maxLength={150} /></label>
            <label>Email<input name="email" type="email" autoComplete="email" placeholder="vos@tunegocio.com" required maxLength={254} /></label>
            <label>WhatsApp<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="099 123 456" required minLength={8} maxLength={30} /><span className="m-contact-field-hint">Tu celular, con código de país si es del exterior.</span></label>
          </div>
          <div className="m-lead-trap" aria-hidden="true"><label>Sitio web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <div className="m-contact-simple-bottom"><button className="m-button m-button-primary" type="submit" disabled={pending}>{pending ? "Enviando solicitud…" : "Quiero que me contacten"}<ArrowUpRight size={18} /></button><p>Al enviar, aceptás que te contactemos por WhatsApp sobre tu consulta. <button type="button" onClick={onPrivacy}>Cómo usamos tus datos</button>.</p></div>
        </fieldset>
        {error && <p className="m-contact-simple-error" role="alert">{error}</p>}
      </form>}
    </div>
  </section>;
}
