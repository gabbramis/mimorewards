"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Heart, Menu, MessageCircle, Plus, X } from "lucide-react";
import { Brand, CTA, Eyebrow, Reveal } from "./ui";
import IntroScrollStory from "./IntroScrollStory";
import { JoinJourney } from "./BrandStory";
import ValueStory from "./ValueStory";
import RewardsStory from "./RewardsStory";
import MerchantStory from "./MerchantStory";
import GesturesStory from "./GesturesStory";
import KitStory from "./KitStory";
import PlansStory from "./PlansStory";
import { plansSummary } from "./plans";
import DemoStory from "./DemoStory";
import { demoHref } from "./demo-link";
import { BrandHeart, SectionWave } from "./StoryArt";
import { LegalDialog } from "./contact";

const navLinks = [["Qué es", "valor"], ["Cómo funciona", "sumarse"], ["Para tu negocio", "para-comercios"], ["Planes", "planes"], ["FAQ", "preguntas"]];

const faq = [
  [
    "¿El cliente tiene que descargar una app?",
    "No. Se registra desde el navegador del celular y puede consultar su tarjeta digital ahí mismo. También puede guardarla en Apple Wallet o Google Wallet para tenerla siempre a mano."
  ],
  [
    "¿Cómo se suman los sellos?",
    "Después de una compra válida, el cliente escanea el QR o acerca el celular al tótem NFC de los planes Profesional y Premium. La primera vez se registra; en las siguientes visitas, usa el mismo celular para sumar su sello."
  ],
  [
    "¿Cómo evitan que se sumen sellos varias veces seguidas?",
    "El sistema aplica límites entre toques para evitar repeticiones inmediatas. El comercio sigue siendo quien valida que exista una compra antes de presentar el soporte NFC."
  ],
  [
    "¿Necesito cambiar mi sistema de caja?",
    "No. mimo funciona de forma independiente, así que podés seguir usando tu sistema de caja actual y gestionar el programa de fidelización desde el panel web."
  ],
  [
    "¿Qué pasa si un cliente no tiene NFC?",
    "Puede usar el QR del mismo programa. El flujo es el mismo: abre desde el navegador, se registra si es la primera vez y suma su sello."
  ],
  [
    "¿Qué puedo personalizar?",
    "Inicial incluye una plantilla con tu logo, un color y sellos estándar. Profesional y Premium suman diseño completo para Apple Wallet y Google Wallet, sellos propios y tarjeta sin marca de mimo. En todos los planes definís la recompensa."
  ],
  [
    "¿Qué puedo ver desde el panel?",
    "Podés consultar clientes registrados, visitas, sellos, progreso y recompensas canjeadas. También ver quién volvió, quién está cerca de completar su tarjeta y qué beneficios se usan."
  ],
  [
    "¿Puedo comunicarme con mis clientes?",
    "Premium incluye campañas push en Wallet y automatizaciones por segmentos, como cumpleaños o clientes inactivos. La recepción depende de Wallet y de los permisos del cliente. Las solicitudes de reseñas en Google Maps están en desarrollo."
  ],
  [
    "¿Cuánto cuesta mimo?",
    plansSummary
  ],
  [
    "¿Qué pasa cuando llego al límite de clientes?",
    "Inicial está pensado para probar el programa con hasta 50 clientes activos. Para sumar más, coordinamos el pase a Profesional, que admite hasta 500. Premium permite clientes activos ilimitados. Antes del alta confirmamos cómo se mide la actividad y las condiciones del cambio de plan."
  ],
  [
    "¿Cómo empiezo a usar mimo en mi comercio?",
    "Dejanos tu nombre, negocio y WhatsApp en el formulario. Te contactamos para ayudarte a elegir un plan y definir tu recompensa, logo y colores. Con Inicial recibís tu QR en PDF; con Profesional o Premium coordinamos también la entrega del kit."
  ],
];


export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(null);
  useEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    // A reload starts the story again; direct section links and Back keep working.
    if (navigation?.type !== "reload") return;
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    if (location.hash) history.replaceState(history.state, "", location.pathname + location.search);
    const resetScroll = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    resetScroll();
    window.addEventListener("pageshow", resetScroll, { once: true });
    return () => {
      window.removeEventListener("pageshow", resetScroll);
      history.scrollRestoration = previousRestoration;
    };
  }, []);
  return <div className="m-landing" id="inicio">
    <a className="m-skip-link" href="#contenido">Ir al contenido</a>
<header className="m-header m-story-header"><div className="m-container m-nav"><a href="#inicio" aria-label="mimo rewards, inicio"><Brand /></a><nav className="m-desktop-nav" aria-label="Navegación principal">{navLinks.map(([label, id]) => <a href={`#${id}`} key={id}>{label}</a>)}</nav><div className="m-nav-actions"><CTA href={demoHref}>Quiero conocer mimo</CTA><button className="m-menu-toggle" aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuOpen} aria-controls="m-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></div></div><nav id="m-mobile-nav" className="m-mobile-nav" hidden={!menuOpen} aria-label="Navegación móvil" onKeyDown={e => { if (e.key === "Escape") { setMenuOpen(false); document.querySelector<HTMLButtonElement>(".m-menu-toggle")?.focus(); } }}>{navLinks.map(([label, id]) => <a href={`#${id}`} key={id} onClick={() => setMenuOpen(false)}>{label}<ArrowUpRight size={16} /></a>)}<Link href="/caja">Terminal Web de Caja</Link><Link href="/login">Panel de Admin (CRM)</Link></nav></header>
    <main id="contenido">
      <IntroScrollStory />
      <div className="m-after-hero">
        <ValueStory />
        <JoinJourney />
        <SectionWave from="cream" />
        <RewardsStory />
        <SectionWave from="red" />
        <MerchantStory />
        <GesturesStory />
        <KitStory />
        <PlansStory onSelectPlan={setSelectedPlan} />
        <div className="m-contact-wave"><SectionWave from="cream" /></div>
        <DemoStory onPrivacy={() => setLegal("privacy")} selectedPlan={selectedPlan} />
        <div className="m-contact-wave"><SectionWave from="red" /></div>
<section id="preguntas" className="m-section m-faq"><div className="m-container m-faq-grid"><Reveal className="m-section-heading"><Eyebrow>TE LO HACEMOS SIMPLE</Eyebrow><h2>Quizás te estés<br />preguntando…</h2><p>Todo lo que necesitás saber<br />antes del primer mimo.</p><a className="m-text-link" href={demoHref}>Hablemos de tu negocio <MessageCircle size={18} /></a></Reveal><div className="m-faq-list">{faq.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={19} /></summary><p>{answer}</p></details>)}</div></div></section>
      </div>
    </main>
    <footer className="m-footer m-story-footer"><BrandHeart className="m-footer-heart" /><div className="m-container"><div className="m-footer-top"><a href="#inicio" aria-label="mimo rewards, volver al inicio"><Brand /></a><p>Sellos con NFC.<br />Un programa con tu marca.</p><nav aria-label="Enlaces del pie de página"><a href="#sumarse">Cómo funciona</a><a href="#planes">Planes</a><a href={demoHref}>Hablemos</a><button onClick={() => setLegal("privacy")}>Privacidad</button><button onClick={() => setLegal("terms")}>Términos</button></nav></div><div className="m-footer-bottom"><span>© {new Date().getFullYear()} mimo rewards</span><span><Heart size={13} fill="currentColor" /> Hecho para los comercios de todos los días.</span><div><Link href="/caja">Caja <ArrowUpRight size={12} /></Link><Link href="/login">Panel de Admin <ArrowUpRight size={12} /></Link></div></div></div></footer>
    {legal && <LegalDialog type={legal} close={() => setLegal(null)} />}
  </div>;
}
