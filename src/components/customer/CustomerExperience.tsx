"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Gift, Heart, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { NfcContext } from "@/lib/mimo-nfc";
import AppleWalletButton from "@/components/AppleWalletButton";
import GoogleWalletButton from "@/components/GoogleWalletButton";
import { useDevicePlatform } from "@/hooks/useDevicePlatform";
import { COUNTRY_CODES, formatCustomerSubmitPhone } from "@/lib/customer-phone";

export type CustomerView = {
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

export type CustomerStage = "register" | "recover" | "card" | "stamp" | "cooldown" | "reward";
type Phase = "loading" | "unavailable" | CustomerStage;
type FormValues = { firstName: string; lastName: string; phone: string; birthdate: string };

const emptyForm: FormValues = { firstName: "", lastName: "", phone: "", birthdate: "" };

function readableBrand(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#9C302E";
  const rgb = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const luminance = (values: number[]) => values.map(value => {
    const channel = value / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const background = luminance([247, 244, 239]);
  for (let factor = 1; factor >= 0; factor -= .05) {
    const candidate = rgb.map(value => Math.round(value * factor));
    if ((background + .05) / (luminance(candidate) + .05) >= 4.5) {
      return `#${candidate.map(value => value.toString(16).padStart(2, "0")).join("")}`;
    }
  }
  return "#232421";
}

function messageFor(status: string | null, firstName: string) {
  if (status === "success") return { title: `¡Un sello más, ${firstName}!`, detail: "Tu tarjeta ya está actualizada.", tone: "success" };
  if (status === "cooldown") return { title: "Tu visita ya está registrada", detail: "Hay una espera de 3 horas entre sellos. Tu progreso está a salvo.", tone: "neutral" };
  if (status === "reward_pending") return { title: "Tu premio te espera", detail: "Ya completaste la tarjeta. Mostrala en el comercio para canjearlo.", tone: "success" };
  if (status === "error") return { title: "No pudimos sumar el sello", detail: "Mostrá tu tarjeta en caja para que puedan ayudarte.", tone: "error" };
  return null;
}

function StampGrid({ customer, context }: { customer: CustomerView; context: NfcContext }) {
  const target = Math.max(1, Math.min(customer.targetStamps || context.rewardTarget, 15));
  const current = Math.min(customer.currentStamps, target);
  const columns = Math.ceil(target / Math.ceil(target / 5));
  return (
    <div className="cx-stamps" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-label={`${current} de ${target} sellos`}>
      {Array.from({ length: target }, (_, index) => {
        const filled = index < current;
        const image = filled ? context.stampCompletedUrl : context.stampPendingUrl;
        return <span className={`cx-stamp ${filled ? "is-filled" : ""}`} key={index} aria-hidden="true">
          {image ? <img src={image} alt="" /> : filled ? <Heart size={21} fill="currentColor" strokeWidth={1.5} /> : <span className="cx-stamp-empty" />}
        </span>;
      })}
    </div>
  );
}

function LoyaltyCard({ customer, context, celebrate }: { customer: CustomerView; context: NfcContext; celebrate: boolean }) {
  const completed = customer.currentStamps >= customer.targetStamps;
  return <div className={`cx-card ${celebrate ? "cx-card-celebrate" : ""}`}>
    <div className="cx-card-top">
      <span className="cx-card-label">TARJETA DE BENEFICIOS</span>
    </div>
    <div className="cx-card-business">
      {context.businessLogo && <img src={context.businessLogo} alt="" />}
      <span>{context.businessName}</span>
    </div>
    <div className="cx-card-progress"><strong>{customer.currentStamps}<span> / {customer.targetStamps}</span></strong><span>sellos</span></div>
    <StampGrid customer={customer} context={context} />
    <div className="cx-card-reward"><Gift size={17} aria-hidden="true" /><span><small>{completed ? "PREMIO DISPONIBLE" : "TU PRÓXIMO PREMIO"}</small><strong>{context.rewardDescription}</strong></span></div>
    <div className="cx-card-bottom"><span>{customer.firstName} {customer.lastName}</span><span>{customer.uniqueCode}</span></div>
  </div>;
}

function InputField({ label, name, value, onChange, type = "text", placeholder, autoComplete, disabled }: {
  label: string; name: keyof FormValues; value: string; onChange: (name: keyof FormValues, value: string) => void;
  type?: string; placeholder?: string; autoComplete?: string; disabled?: boolean;
}) {
  return <label className="cx-field"><span>{label}</span><input required type={type} name={name} value={value} onChange={event => onChange(name, event.target.value)} placeholder={placeholder} autoComplete={autoComplete} disabled={disabled} /></label>;
}

function PhoneInputField({ label, value, onChange, countryCode, onCountryChange, disabled }: {
  label: string; value: string; onChange: (value: string) => void;
  countryCode: string; onCountryChange: (code: string) => void; disabled?: boolean;
}) {
  return (
    <label className="cx-field">
      <span>{label}</span>
      <div className="cx-phone-input-group">
        <select
          value={countryCode}
          onChange={e => onCountryChange(e.target.value)}
          disabled={disabled}
          className="cx-country-select"
          aria-label="Código de país"
        >
          {COUNTRY_CODES.map(c => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        <input
          required
          type="tel"
          name="phone"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={countryCode === "+598" ? "099 123 456" : "Número de celular"}
          autoComplete="tel-national"
          disabled={disabled}
          className="cx-phone-input"
        />
      </div>
    </label>
  );
}

function LoadingView() {
  return <div className="cx-loading" role="status" aria-label="Cargando información del comercio">
    <div className="cx-skeleton cx-skeleton-title" /><div className="cx-skeleton cx-skeleton-copy" />
    <div className="cx-form-card"><div className="cx-skeleton cx-skeleton-input" /><div className="cx-skeleton cx-skeleton-input" /><div className="cx-skeleton cx-skeleton-input" /><div className="cx-skeleton cx-skeleton-button" /></div>
  </div>;
}

export default function CustomerExperience({ nfcId, initialContext, initialCustomer, stampStatus = null, googleWalletUrl, previewStage }: {
  nfcId?: string;
  initialContext?: NfcContext;
  initialCustomer?: CustomerView | null;
  stampStatus?: string | null;
  appleWalletReady?: boolean;
  googleWalletReady?: boolean;
  googleWalletUrl?: string;
  previewStage?: CustomerStage;
}) {
  const preview = Boolean(previewStage);
  const [context, setContext] = useState<NfcContext | null>(initialContext || null);
  const [customer, setCustomer] = useState<CustomerView | null>(initialCustomer || null);
  const [phase, setPhase] = useState<Phase>(previewStage || (initialCustomer ? "card" : initialContext ? "register" : "loading"));
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [countryCode, setCountryCode] = useState<string>("+598");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [whatsappMarketingOptIn, setWhatsappMarketingOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localNotice, setLocalNotice] = useState("");
  const [returning, setReturning] = useState(Boolean(initialCustomer));
  const [walletBusy, setWalletBusy] = useState(false);
  const [appleWalletBusy, setAppleWalletBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const { platform } = useDevicePlatform();
  const supabase = useMemo(() => preview ? null : createClient(), [preview]);

  useEffect(() => {
    if (!nfcId || preview) return;
    let cancelled = false;
    fetch(`/api/nfc/${encodeURIComponent(nfcId)}`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Este programa no está disponible por ahora.");
        return response.json();
      })
      .then(payload => {
        if (cancelled) return;
        setContext(payload.context);
        setCustomer(payload.customer || null);
        setReturning(Boolean(payload.customer));
        setPhase(payload.customer ? "card" : "register");
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "No pudimos abrir este programa.");
        setPhase("unavailable");
      });
    return () => { cancelled = true; };
  }, [nfcId, preview]);

  useEffect(() => {
    if (!customer?.id || !supabase || preview) return;
    const channel = supabase.channel(`customer-stamps-${customer.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stamp_logs", filter: `customer_id=eq.${customer.id}` }, payload => {
        const redeemed = payload.new.method === "REDEEM";
        setCustomer(previous => previous ? { ...previous, currentStamps: redeemed ? 0 : Math.min(previous.currentStamps + 1, previous.targetStamps) } : previous);
        setLocalNotice(redeemed ? "Premio canjeado. ¡Tu próxima tarjeta ya empezó!" : "¡Un sello más! Tu tarjeta está actualizada.");
        setCelebrate(!redeemed);
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [customer?.id, supabase, preview]);

  useEffect(() => {
    if (!celebrate) return;
    const timeout = window.setTimeout(() => setCelebrate(false), 900);
    return () => window.clearTimeout(timeout);
  }, [celebrate]);

  useEffect(() => {
    if (!appleWalletBusy) return;
    const timeout = window.setTimeout(() => setAppleWalletBusy(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [appleWalletBusy]);

  function updateField(name: keyof FormValues, value: string) { setForm(current => ({ ...current, [name]: value })); }

  async function submit(event: FormEvent<HTMLFormElement>, recover: boolean) {
    event.preventDefault();
    if (preview || !nfcId || busy) return;
    setBusy(true); setError(""); setLocalNotice("");
    try {
      const cleanPhone = formatCustomerSubmitPhone(form.phone, countryCode);

      const response = await fetch(recover ? "/api/recover" : "/api/customers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recover ? { nfcId, phone: cleanPhone } : { ...form, phone: cleanPhone, nfcId, legalAccepted, whatsappMarketingOptIn }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No pudimos completar la solicitud.");
      setContext(payload.context);
      setCustomer(payload.customer);
      setReturning(recover || payload.isNewCustomer === false);
      setPhase("card");
      setLocalNotice(recover || payload.isNewCustomer === false ? (payload.message || "Tu tarjeta está lista.") : "");
      setCelebrate(!recover && payload.stampAdded !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos completar la solicitud.");
    } finally { setBusy(false); }
  }

  async function openGoogleWallet() {
    if (!customer || preview || walletBusy) return;
    if (googleWalletUrl) { window.location.href = googleWalletUrl; return; }
    setWalletBusy(true); setError("");
    try {
      const response = await fetch("/api/wallet/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.saveUrl) {
        throw new Error(payload.error || "Google Wallet no está disponible en este momento.");
      }
      window.location.href = payload.saveUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al abrir Google Wallet.");
      setWalletBusy(false);
    }
  }

  function openAppleWallet() {
    if (!customer || preview || appleWalletBusy) return;
    setAppleWalletBusy(true);
    setError("");
    const passUrl = `/api/wallet/apple/${encodeURIComponent(customer.id)}`;
    window.location.href = passUrl;
  }

  const theme = context ? {
    "--cx-card": context.primaryColor,
    "--cx-card-text": context.textColor,
    "--cx-card-accent": context.accentColor,
    "--cx-brand": readableBrand(context.primaryColor),
  } as CSSProperties : undefined;
  const visibleCustomer = customer;
  const statusMessage = visibleCustomer ? messageFor(stampStatus, visibleCustomer.firstName) : null;
  const rewardReady = Boolean(visibleCustomer && visibleCustomer.currentStamps >= visibleCustomer.targetStamps);
  const isCard = phase === "card" || phase === "stamp" || phase === "cooldown" || phase === "reward";
  const stageMessage = phase === "stamp" ? messageFor("success", visibleCustomer?.firstName || "") : phase === "cooldown" ? messageFor("cooldown", "") : phase === "reward" || (rewardReady && stampStatus === "success") ? messageFor("reward_pending", "") : statusMessage;
  const PageTag = preview ? "div" : "main";
  const FormTag = preview ? "div" : "form";

  return <PageTag className={`cx-page ${preview ? "cx-preview" : ""}`} style={theme}>
    <div className="cx-shell">
      <header className="cx-header">
        <div className="cx-identity">
          <span className="cx-logo">{context?.businessLogo ? <img src={context.businessLogo} alt="" /> : context?.businessName ? context.businessName.slice(0, 1).toUpperCase() : <span className="cx-skeleton cx-skeleton-logo" />}</span>
          <span className="cx-identity-name">{context?.businessName || "Tu comercio"}<small>PROGRAMA DE BENEFICIOS</small></span>
        </div>
        <span className="cx-brand-sign"><Image src="/images/mimo-wordmark.png" width={1220} height={469} alt="Mimo Rewards" priority /></span>
      </header>

      {phase === "loading" ? <LoadingView /> : phase === "unavailable" ? <section className="cx-state cx-unavailable"><span className="cx-state-icon"><LockKeyhole size={22} /></span><h1>Este programa no está disponible</h1><p>{error || "Pedile al comercio un enlace válido para sumarte."}</p></section> : context && <div className="cx-content" aria-live="polite">
        {phase === "register" && <>
          <div className="cx-heading">
            <span className="cx-overline" style={{ color: "#111827" }}>{context.registroSubtitulo || "TU TARJETA EMPIEZA ACÁ"}</span>
            <h1 style={{ color: "#111827" }}>{context.registroTitulo || "Cada visita cuenta."}</h1>
          </div>
          <section className="cx-form-card"><FormTag className="cx-form-fields" onSubmit={preview ? undefined : event => submit(event as FormEvent<HTMLFormElement>, false)}>
            {error && <p className="cx-alert cx-alert-error" role="alert">{error}</p>}
            <div className="cx-field-pair"><InputField label="Nombre" name="firstName" value={form.firstName} onChange={updateField} placeholder="Tu nombre" autoComplete="given-name" disabled={preview} /><InputField label="Apellido" name="lastName" value={form.lastName} onChange={updateField} placeholder="Tu apellido" autoComplete="family-name" disabled={preview} /></div>
            <PhoneInputField
              label="Celular"
              value={form.phone}
              onChange={val => updateField("phone", val)}
              countryCode={countryCode}
              onCountryChange={setCountryCode}
              disabled={preview}
            />
            <InputField label="Fecha de nacimiento" name="birthdate" value={form.birthdate} onChange={updateField} type="date" autoComplete="bday" disabled={preview} />
            <div className="cx-consents">
              <label className="cx-consent"><input type="checkbox" checked={legalAccepted} onChange={event => setLegalAccepted(event.target.checked)} required disabled={preview} /><span>Acepto los <Link href="/terminos" target="_blank" rel="noopener noreferrer">Términos de uso</Link> y la <Link href="/privacidad" target="_blank" rel="noopener noreferrer">Política de privacidad</Link> para crear mi tarjeta. <strong>Obligatorio.</strong></span></label>
              <label className="cx-consent"><input type="checkbox" checked={whatsappMarketingOptIn} onChange={event => setWhatsappMarketingOptIn(event.target.checked)} disabled={preview} /><span>Quiero recibir promociones y novedades de {context.businessName} por WhatsApp al celular que registré. Puedo retirar esta autorización cuando quiera. <strong>Opcional.</strong></span></label>
            </div>
            <button className="cx-button cx-button-primary" type="submit" disabled={busy || preview}>{busy ? "Creando tu tarjeta…" : <>Crear mi tarjeta <ArrowRight size={18} /></>}</button>
          </FormTag><button className="cx-text-button" type="button" disabled={preview} onClick={() => { setPhase("recover"); setError(""); }}>¿Ya tenés tarjeta? Recuperala</button></section>
          <p className="cx-privacy"><LockKeyhole size={13} /> Usamos tus datos para tu tarjeta. Las promociones requieren tu autorización.</p>
        </>}

        {phase === "recover" && <>
          <div className="cx-heading"><span className="cx-overline">QUÉ BUENO VERTE OTRA VEZ</span><h1>Volvé a<br /><em>tu tarjeta.</em></h1><p>Ingresá el celular que usaste en {context.businessName}.</p></div>
          <section className="cx-form-card"><FormTag className="cx-form-fields" onSubmit={preview ? undefined : event => submit(event as FormEvent<HTMLFormElement>, true)}>
            {error && <p className="cx-alert cx-alert-error" role="alert">{error}</p>}
            <PhoneInputField
              label="Celular"
              value={form.phone}
              onChange={val => updateField("phone", val)}
              countryCode={countryCode}
              onCountryChange={setCountryCode}
              disabled={preview}
            />
            
            <button className="cx-button cx-button-primary" type="submit" disabled={busy || preview}>{busy ? "Buscando tu tarjeta…" : <>Recuperar tarjeta <ArrowRight size={18} /></>}</button>
          </FormTag><button className="cx-text-button" type="button" disabled={preview} onClick={() => { setPhase("register"); setError(""); }}>Registrarme por primera vez</button></section>
        </>}

        {isCard && visibleCustomer && <>
          <div className="cx-heading cx-card-heading"><span className="cx-overline">{rewardReady ? "¡OBJETIVO CUMPLIDO!" : returning ? "TU TARJETA DIGITAL" : "¡YA SOS PARTE!"}</span><h1>{stageMessage?.title || (rewardReady ? "Tu premio te espera." : returning ? `Hola, ${visibleCustomer.firstName}.` : "Ya sos parte.")}</h1><p>{stageMessage?.detail || (rewardReady ? `Mostrá tu tarjeta en ${context.businessName} para canjear ${context.rewardDescription}.` : returning ? "Seguí sumando. Tu próximo mimo está más cerca." : "Tu primer sello ya está en la tarjeta.")}</p></div>
          <LoyaltyCard customer={visibleCustomer} context={context} celebrate={celebrate || phase === "stamp"} />
          {localNotice && !stageMessage && <p className="cx-alert cx-alert-success" role="status"><Check size={16} /> {localNotice}</p>}
          {error && <p className="cx-alert cx-alert-error" role="alert">{error}</p>}
          <div className="cx-card-actions">
            {/* Si el usuario entra desde iOS: ÚNICAMENTE Apple Wallet */}
            {platform === "ios" && (
              <AppleWalletButton
                href={preview ? undefined : `/api/wallet/apple/${encodeURIComponent(visibleCustomer.id)}`}
                onClick={openAppleWallet}
                loading={appleWalletBusy}
                loadingText="Generando pase…"
                disabled={preview || appleWalletBusy}
                className="w-full"
              />
            )}

            {/* Si el usuario entra desde Android: ÚNICAMENTE Google Wallet */}
            {platform === "android" && (
              <GoogleWalletButton
                href={preview ? undefined : googleWalletUrl}
                onClick={openGoogleWallet}
                loading={walletBusy}
                loadingText="Abriendo Google Wallet…"
                disabled={preview || walletBusy}
                className="w-full"
              />
            )}

            {/* Si entra desde Desktop / Computadora o plataforma no identificada: mostrar ambos botones */}
            {(platform === "desktop" || platform === "unknown") && (
              <>
                <AppleWalletButton
                  href={preview ? undefined : `/api/wallet/apple/${encodeURIComponent(visibleCustomer.id)}`}
                  onClick={openAppleWallet}
                  loading={appleWalletBusy}
                  loadingText="Generando pase…"
                  disabled={preview || appleWalletBusy}
                  className="w-full"
                />
                <GoogleWalletButton
                  href={preview ? undefined : googleWalletUrl}
                  onClick={openGoogleWallet}
                  loading={walletBusy}
                  loadingText="Abriendo Google Wallet…"
                  disabled={preview || walletBusy}
                  className="w-full"
                />
              </>
            )}
            <p className="cx-wallet-note">Podés guardar tu tarjeta en tu teléfono o abrirla desde este enlace cuando quieras.</p>
          </div>
        </>}
      </div>}
      <footer className="cx-footer">Powered by <Image src="/images/mimo-wordmark.png" width={1220} height={469} alt="Mimo Rewards" /></footer>
    </div>
  </PageTag>;
}
