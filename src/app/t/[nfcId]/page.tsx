"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Gift,
  Heart,
  Loader2,
  Phone,
  ShieldCheck,
  UserRound,
  Wallet,
  Wifi,
} from "lucide-react";

type NfcPageProps = { params: Promise<{ nfcId: string }> };

type NfcContext = {
  nfcId: string;
  businessId: string;
  businessName: string;
  businessLogo: string;
  rewardTarget: number;
  rewardDescription: string;
};

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  birthdate: string;
  uniqueCode: string;
  currentStamps: number;
  targetStamps: number;
  businessName: string;
  businessLogo: string;
  rewardDescription: string;
};

type FormDataState = {
  firstName: string;
  lastName: string;
  phone: string;
  birthdate: string;
};

const initialContext: NfcContext = {
  nfcId: "ABC123",
  businessId: "",
  businessName: "El Gran Café",
  businessLogo: "",
  rewardTarget: 10,
  rewardDescription: "Un café gratis",
};

const emptyForm: FormDataState = {
  firstName: "",
  lastName: "",
  phone: "",
  birthdate: "",
};

function Stamps({ current, target }: { current: number; target: number }) {
  return (
    <div className="m-nfc-stamps" aria-label={`${current} de ${target} sellos`}>
      {Array.from({ length: target }, (_, index) => (
        <span key={index} className={index < current ? "is-filled" : ""}>
          {index < current ? <Heart size={15} fill="currentColor" /> : <span />}
        </span>
      ))}
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  icon: Icon,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  name: keyof FormDataState;
  value: string;
  onChange: (name: keyof FormDataState, value: string) => void;
  icon: typeof UserRound;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="m-nfc-field">
      <span>{label}</span>
      <span className="m-nfc-input-wrap">
        <Icon size={18} aria-hidden="true" />
        <input
          required
          name={name}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange(name, event.target.value)}
        />
      </span>
    </label>
  );
}

export default function NfcEntryPage({ params }: NfcPageProps) {
  const { nfcId: rawNfcId } = use(params);
  const nfcId = rawNfcId.toUpperCase();
  const storageKey = `mimo_customer_${nfcId}`;
  const [context, setContext] = useState<NfcContext>({ ...initialContext, nfcId });
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<FormDataState>(emptyForm);
  const [phase, setPhase] = useState<"loading" | "register" | "card">("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    const saved = localStorage.getItem(storageKey);
    let savedCustomer: Customer | null = null;

    try {
      savedCustomer = saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem(storageKey);
    }

    if (savedCustomer) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomer(savedCustomer);
      setIsReturning(true);
      setPhase("card");
    }

    fetch(`/api/nfc/${encodeURIComponent(nfcId)}${savedCustomer?.id ? `?customerId=${savedCustomer.id}` : ""}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("No pudimos identificar este soporte.");
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        if (payload.context) setContext(payload.context);
        if (payload.customer) {
          setCustomer(payload.customer);
          setIsReturning(true);
          setPhase("card");
          localStorage.setItem(storageKey, JSON.stringify(payload.customer));
        } else if (!savedCustomer) {
          setPhase("register");
        }
      })
      .catch(() => {
        if (!cancelled && !savedCustomer) setPhase("register");
      });

    return () => {
      cancelled = true;
    };
  }, [nfcId, storageKey]);

  function updateField(name: keyof FormDataState, value: string) {
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, nfcId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No pudimos completar el registro.");

      setCustomer(payload.customer);
      setContext(payload.context || context);
      setIsReturning(false);
      setPhase("card");
      setNotice(payload.message || "¡Listo! Tu primer sello ya está adentro.");
      localStorage.setItem(storageKey, JSON.stringify(payload.customer));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No pudimos completar el registro.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function walletMessage(walletName: string) {
    setNotice(`${walletName} estará disponible cuando activemos tu tarjeta digital.`);
  }

  const title = isReturning ? "¡Qué bueno verte de nuevo!" : "¡Bienvenida a mimo!";

  return (
    <main className="m-nfc-page">
      <header className="m-nfc-header">
        <Link href="/" className="m-nfc-brand" aria-label="mimo rewards, inicio">
          {context.businessLogo ? (
            <Image src={context.businessLogo} width={1220} height={469} alt={context.businessName} priority />
          ) : (
            <Image src="/images/mimo-wordmark.png" width={1220} height={469} alt="mimo rewards" priority />
          )}
        </Link>
        <span className="m-nfc-token"><Wifi size={14} /> NFC · {nfcId}</span>
      </header>

      <div className="m-nfc-layout">
        <section className="m-nfc-intro" aria-label="Invitación al programa">
          <span className="m-nfc-kicker"><Wifi size={14} /> NFC DETECTADO · {context.businessName}</span>
          <h1>Creá tu cuenta.<br /><span>Guardá tus sellos.</span></h1>
          <p>Una tarjeta digital para que tus beneficios estén siempre a mano. Te registrás una vez y después solo acercás tu celular.</p>

           <div className="m-nfc-trust"><ShieldCheck size={16} /> Sin app para descargar · Gratis para sumarte</div>
         </section>

        <section className="m-nfc-panel" aria-live="polite">
          {phase === "loading" && (
            <div className="m-nfc-loading"><Loader2 size={28} className="m-nfc-spin" /><span>Preparando tu tarjeta…</span></div>
          )}

          {phase === "register" && (
            <>
              <div className="m-nfc-panel-heading">
                <span className="m-nfc-step">CREÁ TU CUENTA</span>
                <h2>{title}</h2>
                <p>Registrate una vez y empezá a sumar sellos en {context.businessName}.</p>
              </div>

              <form onSubmit={handleSubmit} className="m-nfc-form">
                {error && <div className="m-nfc-alert m-nfc-alert-error" role="alert">{error}</div>}
                <div className="m-nfc-form-grid">
                  <Field label="Nombre" name="firstName" value={formData.firstName} onChange={updateField} icon={UserRound} placeholder="Ej. Sofía" autoComplete="given-name" />
                  <Field label="Apellido" name="lastName" value={formData.lastName} onChange={updateField} icon={UserRound} placeholder="Ej. López" autoComplete="family-name" />
                </div>
                <Field label="Celular" name="phone" value={formData.phone} onChange={updateField} icon={Phone} type="tel" placeholder="+598 99 123 456" autoComplete="tel" />
                <Field label="Fecha de nacimiento" name="birthdate" value={formData.birthdate} onChange={updateField} icon={CalendarDays} type="date" autoComplete="bday" />
                <button type="submit" className="m-nfc-primary-button" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={19} className="m-nfc-spin" /> : <>Crear mi cuenta <ArrowRight size={18} /></>}
                </button>
                <p className="m-nfc-form-note"><ShieldCheck size={14} /> Usamos tus datos solo para tu tarjeta y tus beneficios.</p>
              </form>
            </>
          )}

          {phase === "card" && customer && (
            <div className="m-nfc-card-view">
              <div className="m-nfc-panel-heading">
                <span className="m-nfc-success-mark"><Check size={20} /></span>
                <span className="m-nfc-step">{isReturning ? "CLIENTE IDENTIFICADO" : "¡LISTO! TU TARJETA ESTÁ CREADA"}</span>
                <h2>{isReturning ? title : "Ahora sí, a sumar sellos."}</h2>
                <p>{isReturning ? "Tu tarjeta está lista para seguir sumando." : "Guardala en tu Wallet para tenerla siempre a mano."}</p>
              </div>

              <div className="m-nfc-loyalty-card">
                <Image className="m-nfc-card-logo" src={context.businessLogo || "/images/mimo-wordmark.png"} width={180} height={70} alt={context.businessName} />
                <div className="m-nfc-card-business">{customer.businessName}</div>
                <div className="m-nfc-card-balance"><strong>{customer.currentStamps}<small>/{customer.targetStamps} sellos</small></strong><span>1 compra = 1 sello</span></div>
                <Stamps current={customer.currentStamps} target={customer.targetStamps} />
                <div className="m-nfc-card-reward"><Gift size={19} /><span>{customer.currentStamps >= customer.targetStamps ? "Recompensa disponible" : "Tu próximo mimo"}<strong>{customer.rewardDescription}</strong></span></div>
                <div className="m-nfc-card-footer"><span>Tarjeta de beneficios</span><span>{customer.uniqueCode}</span></div>
              </div>

              {error && <div className="m-nfc-alert m-nfc-alert-error" role="alert">{error}</div>}
              {notice && <div className="m-nfc-alert m-nfc-alert-success" role="status"><Check size={16} /> {notice}</div>}

              <div className="m-nfc-actions">
                <button type="button" className="m-nfc-wallet-button m-nfc-wallet-apple" onClick={() => walletMessage("Apple Wallet")}><Wallet size={18} /> Agregar a Apple Wallet</button>
                <button type="button" className="m-nfc-wallet-button m-nfc-wallet-google" onClick={() => walletMessage("Google Wallet")}><Wallet size={18} /> Guardar en Google Wallet</button>
              </div>
              <p className="m-nfc-bottom-note">Podés consultar tus sellos y beneficios cuando quieras desde tu celular.</p>
            </div>
          )}
        </section>
      </div>
      <footer className="m-nfc-footer">
        <Image src="/images/mimo-wordmark.png" width={80} height={30} alt="mimo rewards" />
        <span>Powered by mimo rewards</span>
      </footer>
    </main>
  );
}
