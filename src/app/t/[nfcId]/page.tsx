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
  businessName: "",
  businessLogo: "",
  rewardTarget: 10,
  rewardDescription: "",
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
  const [phase, setPhase] = useState<"loading" | "register" | "recover" | "card" | "unavailable">("loading");
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

    fetch(`/api/nfc/${encodeURIComponent(nfcId)}${savedCustomer?.id ? `?customerId=${savedCustomer.id}` : ""}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("No pudimos identificar este soporte.");
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        if (!payload.context?.businessId || !payload.context?.businessName) {
          throw new Error("No pudimos identificar el negocio de este link.");
        }

        setContext(payload.context);
        if (payload.customer) {
          setCustomer(payload.customer);
          setIsReturning(true);
          setPhase("card");
          localStorage.setItem(storageKey, JSON.stringify(payload.customer));
        } else {
          if (savedCustomer) localStorage.removeItem(storageKey);
          setPhase("register");
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (savedCustomer) {
          localStorage.removeItem(storageKey);
          setCustomer(null);
          setIsReturning(false);
        }
        setError("Este link no pertenece a un negocio activo.");
        setPhase("unavailable");
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

  async function handleRecover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.phone, nfcId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No pudimos recuperar tu tarjeta.");

      setCustomer(payload.customer);
      setContext(payload.context || context);
      setIsReturning(true);
      setPhase("card");
      setNotice(payload.message || "¡Qué bueno verte de nuevo! Ya recuperamos tu tarjeta.");
      localStorage.setItem(storageKey, JSON.stringify(payload.customer));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No pudimos recuperar tu tarjeta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function walletMessage(walletName: string) {
    setNotice(`${walletName} estará disponible cuando activemos tu tarjeta digital.`);
  }

  const title = isReturning ? "¡Qué bueno verte de nuevo!" : "¡Bienvenida a mimo!";
  const isUnavailable = phase === "unavailable";
  const isLoading = phase === "loading";

  return (
    <main className="m-nfc-page m-nfc-mobile-only">
      <header className="m-nfc-header">
        <Link href="/" className="m-nfc-brand" aria-label="mimo rewards, inicio">
          {context.businessLogo ? (
            <img src={context.businessLogo} alt={context.businessName} style={{ objectFit: 'contain' }} onError={(e) => { e.currentTarget.src = "/images/mimo-wordmark.png"; }} />
          ) : (
            <Image src="/images/mimo-wordmark.png" width={1220} height={469} alt="mimo rewards" priority />
          )}
        </Link>
        <span className="m-nfc-token"><Wifi size={14} /> {isUnavailable ? "LINK NO DISPONIBLE" : `NFC · ${nfcId}`}</span>
      </header>

      <div className="m-nfc-layout">
        <section className="m-nfc-intro" aria-label="Invitación al programa">
          <span className="m-nfc-kicker"><Wifi size={14} /> {isUnavailable ? "LINK NO DISPONIBLE" : isLoading ? "VERIFICANDO LINK" : `NFC DETECTADO · ${context.businessName}`}</span>
          <h1>{isUnavailable ? <>Este link no está<br /><span>activo.</span></> : isLoading ? <>Verificando tu<br /><span>programa.</span></> : <>Creá tu cuenta.<br /><span>Guardá tus sellos.</span></>}</h1>
          <p>{isUnavailable ? "Este QR o NFC no está vinculado a un comercio activo." : isLoading ? "Estamos comprobando que el link pertenezca a un programa de beneficios." : "Una tarjeta digital para que tus beneficios estén siempre a mano. Te registrás una vez y después solo acercás tu celular."}</p>

          {!isUnavailable && !isLoading && <div className="m-nfc-trust"><ShieldCheck size={16} /> Sin app para descargar · Gratis para sumarte</div>}
        </section>

        <section className="m-nfc-panel" aria-live="polite">
          {phase === "loading" && (
            <div className="m-nfc-loading"><Loader2 size={28} className="m-nfc-spin" /><span>Preparando tu tarjeta…</span></div>
          )}

          {phase === "unavailable" && (
            <div className="m-nfc-unavailable">
              <span className="m-nfc-success-mark"><Wifi size={20} /></span>
              <div className="m-nfc-panel-heading">
                <span className="m-nfc-step">LINK NO DISPONIBLE</span>
                <h2>Este QR o NFC no está activo.</h2>
                <p>Pedile al comercio que te comparta un link válido para sumarte a su programa de beneficios.</p>
              </div>
            </div>
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
              <div className="mt-8 text-center pb-4">
                <button type="button" onClick={() => { setPhase("recover"); setError(""); setNotice(""); }} className="text-[15px] font-medium text-[#1F1F1F] underline decoration-[#FFD9DC] decoration-2 underline-offset-4 hover:text-[#FF1F2D] transition-colors">¿Ya tienes una tarjeta en este local? Inicia sesión con tu celular</button>
              </div>
            </>
          )}

          {phase === "recover" && (
            <>
              <div className="m-nfc-panel-heading">
                <span className="m-nfc-step">RECUPERAR TARJETA</span>
                <h2>Iniciá sesión</h2>
                <p>Ingresá tu número de celular para recuperar tu cuenta y seguir sumando en {context.businessName}.</p>
              </div>

              <form onSubmit={handleRecover} className="m-nfc-form">
                {error && <div className="m-nfc-alert m-nfc-alert-error" role="alert">{error}</div>}

                <Field label="Celular" name="phone" value={formData.phone} onChange={updateField} icon={Phone} type="tel" placeholder="+598 9X XXX XXX" autoComplete="tel" />

                <button type="submit" className="w-full bg-[#FF1F2D] text-white font-bold rounded-2xl py-3 px-6 mt-4 flex items-center justify-center gap-2 hover:bg-black transition-colors" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={19} className="m-nfc-spin" /> : <>Recuperar mi tarjeta <ArrowRight size={18} /></>}
                </button>
                <div className="mt-6 text-center">
                  <button type="button" onClick={() => { setPhase("register"); setError(""); setNotice(""); }} className="text-sm font-medium text-[#777] underline decoration-gray-300 underline-offset-4 hover:text-[#1F1F1F] transition-colors">Prefiero registrarme por primera vez</button>
                </div>
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
                {context.businessLogo ? (
                  <img className="m-nfc-card-logo" style={{ objectFit: 'contain' }} src={context.businessLogo} alt={context.businessName} onError={(e) => { e.currentTarget.src = "/images/mimo-wordmark.png"; e.currentTarget.style.objectFit = "initial"; }} />
                ) : (
                  <Image className="m-nfc-card-logo" src="/images/mimo-wordmark.png" width={180} height={70} alt={context.businessName} />
                )}
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
        <div className="m-nfc-powered">
          <span>Powered by</span>
          <Image src="/images/mimo-wordmark.png" width={64} height={25} alt="mimo rewards" />
        </div>
      </footer>
    </main>
  );
}
