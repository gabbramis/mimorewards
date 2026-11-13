"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, MessageCircle } from "lucide-react";
import { LEAD_PLAN_NAMES } from "@/lib/landing-leads";

interface FormErrors {
  name?: string;
  business?: string;
  email?: string;
  phone?: string;
}

// 1. Filtrado para Nombre y Nombre del negocio: solo letras (incluye tildes, diéresis y ñ) y espacios
function filterOnlyLettersAndSpaces(value: string): string {
  return value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, "");
}

// 2. Filtrado para WhatsApp: solo números, permitiendo únicamente un '+' al principio opcional
function filterPhone(value: string): string {
  const trimmed = value.trimStart();
  const startsWithPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");
  return startsWithPlus ? `+${digitsOnly}` : digitsOnly;
}

// 3. Regex estricta para email: contiene '@' y su dominio termina específicamente en '.com'
const EMAIL_COM_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com$/i;

export function EarlyAccess({ onPrivacy, selectedPlan = "" }: {
  onPrivacy: () => void; selectedPlan?: string;
}) {
  const [formData, setFormData] = useState({
    name: "",
    business: "",
    email: "",
    phone: "",
    website: "",
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);

  function validate(): { isValid: boolean; errors: FormErrors } {
    const errors: FormErrors = {};

    // 1. Validar Nombre
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      errors.name = "El nombre es obligatorio.";
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/.test(trimmedName)) {
      errors.name = "Solo se permiten letras y espacios.";
    } else if (trimmedName.length < 2) {
      errors.name = "Ingresá un nombre válido (mínimo 2 letras).";
    }

    // 1. Validar Nombre del negocio
    const trimmedBusiness = formData.business.trim();
    if (!trimmedBusiness) {
      errors.business = "El nombre del negocio es obligatorio.";
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/.test(trimmedBusiness)) {
      errors.business = "Solo se permiten letras y espacios.";
    } else if (trimmedBusiness.length < 2) {
      errors.business = "Ingresá un nombre de negocio válido (mínimo 2 letras).";
    }

    // 3. Validar Email: obligatorio '@' y terminar específicamente en '.com'
    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      errors.email = "El correo electrónico es obligatorio.";
    } else if (!EMAIL_COM_REGEX.test(trimmedEmail)) {
      errors.email = "El email debe ser válido, contener '@' y terminar en '.com' (ej: vos@tunegocio.com).";
    }

    // 2. Validar WhatsApp: solo números (con '+' opcional al principio)
    const trimmedPhone = formData.phone.trim();
    const phoneDigits = trimmedPhone.replace(/\D/g, "");
    if (!trimmedPhone) {
      errors.phone = "El WhatsApp es obligatorio.";
    } else if (!/^\+?\d+$/.test(trimmedPhone)) {
      errors.phone = "Solo se permiten números (y un '+' opcional al inicio).";
    } else if (phoneDigits.length < 8) {
      errors.phone = "Ingresá un número de WhatsApp válido (mínimo 8 dígitos).";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;

    // Validación estricta en el submit: previene el envío si hay errores
    const { isValid, errors } = validate();
    if (!isValid) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    sending.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/landing-leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          name: formData.name.trim(),
          business: formData.business.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          website: formData.website,
          consent: true,
          plan: selectedPlan,
        }),
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
      {submitted ? <div className="m-contact-panel m-contact-simple-success" role="status" tabIndex={-1} ref={node => { node?.focus(); }}><span className="m-contact-success-icon"><Check size={28} /></span><h3>¡Gracias por escribirnos!</h3><p>Recibimos tu solicitud. Nos estaremos contactando con vos por WhatsApp para conocer tu negocio y contarte cómo empezar con mimo.</p><span className="m-contact-success-note"><MessageCircle size={16} />Seguimos la conversación por ahí.</span></div> : <form onSubmit={submit} aria-busy={pending} className="m-contact-panel" noValidate>
        <h3>Hablemos de tu negocio</h3>
        <p className="m-contact-form-intro">Dejanos tus datos. Nosotros te contactamos.</p>
        {selectedPlan && <p className="m-contact-plan">Me interesa el plan {LEAD_PLAN_NAMES[selectedPlan]}.</p>}
        <fieldset disabled={pending}>
          <div className="m-contact-simple-fields">
            <label>
              Nombre
              <input
                name="name"
                value={formData.name}
                onChange={(e) => {
                  const filtered = filterOnlyLettersAndSpaces(e.target.value);
                  setFormData((prev) => ({ ...prev, name: filtered }));
                  if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                }}
                autoComplete="name"
                placeholder="Tu nombre"
                maxLength={100}
                aria-invalid={Boolean(formErrors.name)}
                style={formErrors.name ? { borderColor: "#df1424" } : undefined}
              />
              {formErrors.name && (
                <span className="m-contact-field-error" style={{ color: "#df1424", fontSize: "11px", fontWeight: 500, lineHeight: 1.3 }} role="alert">
                  {formErrors.name}
                </span>
              )}
            </label>

            <label>
              Nombre del negocio
              <input
                name="business"
                value={formData.business}
                onChange={(e) => {
                  const filtered = filterOnlyLettersAndSpaces(e.target.value);
                  setFormData((prev) => ({ ...prev, business: filtered }));
                  if (formErrors.business) setFormErrors((prev) => ({ ...prev, business: undefined }));
                }}
                autoComplete="organization"
                placeholder="Ej.: Café de la esquina"
                maxLength={150}
                aria-invalid={Boolean(formErrors.business)}
                style={formErrors.business ? { borderColor: "#df1424" } : undefined}
              />
              {formErrors.business && (
                <span className="m-contact-field-error" style={{ color: "#df1424", fontSize: "11px", fontWeight: 500, lineHeight: 1.3 }} role="alert">
                  {formErrors.business}
                </span>
              )}
            </label>

            <label>
              Email
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, email: e.target.value }));
                  if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
                }}
                autoComplete="email"
                placeholder="vos@tunegocio.com"
                maxLength={254}
                aria-invalid={Boolean(formErrors.email)}
                style={formErrors.email ? { borderColor: "#df1424" } : undefined}
              />
              {formErrors.email && (
                <span className="m-contact-field-error" style={{ color: "#df1424", fontSize: "11px", fontWeight: 500, lineHeight: 1.3 }} role="alert">
                  {formErrors.email}
                </span>
              )}
            </label>

            <label>
              WhatsApp
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                value={formData.phone}
                onChange={(e) => {
                  const filtered = filterPhone(e.target.value);
                  setFormData((prev) => ({ ...prev, phone: filtered }));
                  if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                autoComplete="tel"
                placeholder="099 123 456"
                maxLength={30}
                aria-invalid={Boolean(formErrors.phone)}
                style={formErrors.phone ? { borderColor: "#df1424" } : undefined}
              />
              <span className="m-contact-field-hint">Tu celular, con código de país si es del exterior.</span>
              {formErrors.phone && (
                <span className="m-contact-field-error" style={{ color: "#df1424", fontSize: "11px", fontWeight: 500, lineHeight: 1.3 }} role="alert">
                  {formErrors.phone}
                </span>
              )}
            </label>
          </div>
          <div className="m-lead-trap" aria-hidden="true">
            <label>Sitio web<input name="website" value={formData.website} onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))} tabIndex={-1} autoComplete="off" /></label>
          </div>
          <div className="m-contact-simple-bottom">
            <button className="m-button m-button-primary" type="submit" disabled={pending}>
              {pending ? "Enviando solicitud…" : "Quiero que me contacten"}
              <ArrowUpRight size={18} />
            </button>
            <p>Al enviar, aceptás que te contactemos por WhatsApp sobre tu consulta. <button type="button" onClick={onPrivacy}>Cómo usamos tus datos</button>.</p>
          </div>
        </fieldset>
        {error && <p className="m-contact-simple-error" role="alert">{error}</p>}
      </form>}
    </div>
  </section>;
}
