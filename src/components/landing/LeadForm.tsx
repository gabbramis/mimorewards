"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Check } from "lucide-react";
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
        body: JSON.stringify({ name: fields.get("name"), business: fields.get("business"), phone: fields.get("phone"), website: fields.get("website"), consent: true, plan: selectedPlan }),
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
        <h2 id="m-contact-title">Hablemos de<br /><em>tu negocio.</em></h2>
        <p>Dejanos tus datos y te escribimos por WhatsApp.</p>
      </div>
      {submitted ? <div className="m-contact-simple-success" role="status" tabIndex={-1} ref={node => { node?.focus(); }}><Check size={24} /><strong>¡Listo! Te contactamos pronto.</strong></div> : <form onSubmit={submit} aria-busy={pending}>
        {selectedPlan && <p className="m-contact-plan">Me interesa el plan {LEAD_PLAN_NAMES[selectedPlan]}.</p>}
        <fieldset disabled={pending}>
          <div className="m-contact-simple-fields">
            <label>Nombre<input name="name" autoComplete="name" placeholder="Tu nombre" required minLength={2} maxLength={100} /></label>
            <label>Negocio<input name="business" autoComplete="organization" placeholder="Nombre del local" required minLength={2} maxLength={150} /></label>
            <label>WhatsApp<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="099 123 456" required minLength={8} maxLength={30} /></label>
          </div>
          <div className="m-lead-trap" aria-hidden="true"><label>Sitio web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <div className="m-contact-simple-bottom"><p>Al enviar, aceptás que te contactemos por WhatsApp. <button type="button" onClick={onPrivacy}>Privacidad</button></p><button className="m-button m-button-primary" type="submit">{pending ? "Enviando…" : "Que me contacten"}<ArrowUpRight size={16} /></button></div>
        </fieldset>
        {error && <p className="m-contact-simple-error" role="alert">{error}</p>}
      </form>}
    </div>
  </section>;
}
