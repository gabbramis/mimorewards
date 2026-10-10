"use client";

import { useState } from "react";
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
import DemoStory from "./DemoStory";
import { demoHref } from "./demo-link";
import { BrandHeart, SectionWave } from "./StoryArt";
import { LegalDialog } from "./contact";

const navLinks = [["Qué es", "valor"], ["Cómo funciona", "sumarse"], ["Para tu negocio", "para-comercios"], ["Kit y precio", "kit"], ["FAQ", "preguntas"]];

const faq = [
  [
    "¿El cliente tiene que descargar una app?",
    "No. Se registra desde el navegador del celular y puede consultar su tarjeta digital ahí mismo. También puede guardarla en Apple Wallet o Google Wallet para tenerla siempre a mano."
  ],
  [
    "¿Cómo se suman los sellos?",
    "Después de una compra válida, el cliente acerca su celular al soporte NFC. La primera vez se registra y recibe su primer sello; en las siguientes visitas, vuelve a acercar el mismo celular y el sello se suma automáticamente."
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
    "Podés personalizar la tarjeta con el logo y los colores de tu comercio, definir qué acciones suman sellos, cuántos se necesitan y qué recompensa recibe el cliente al completar su tarjeta."
  ],
  [
    "¿Qué puedo ver desde el panel?",
    "Podés consultar clientes registrados, visitas, sellos, progreso y recompensas canjeadas. También ver quién volvió, quién está cerca de completar su tarjeta y qué beneficios se usan."
  ],
  [
    "¿Puedo comunicarme con mis clientes?",
    "Sí. Podés crear comunicaciones y campañas para distintos segmentos, como clientes frecuentes, inactivos, cumpleaños o personas cerca de una recompensa."
  ],
  [
    "¿Cuánto cuesta mimo?",
    "El plan tiene un costo de $1.290 por mes. El kit físico con los soportes NFC se cobra por separado y te informamos su precio antes de comenzar."
  ],
  [
    "¿Cómo empiezo a usar mimo en mi comercio?",
    "Primero hacemos una demo y definimos cómo va a funcionar tu programa: recompensa, cantidad de sellos, logo y colores. Después configuramos tu tarjeta digital, preparamos el kit mimo y coordinamos la entrega."
  ],
];


export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(null);
  return <div className="m-landing" id="inicio">
    <a className="m-skip-link" href="#contenido">Ir al contenido</a>
<header className="m-header m-story-header"><div className="m-container m-nav"><a href="#inicio" aria-label="mimo rewards, inicio"><Brand /></a><nav className="m-desktop-nav" aria-label="Navegación principal">{navLinks.map(([label, id]) => <a href={`#${id}`} key={id}>{label}</a>)}</nav><div className="m-nav-actions"><CTA href={demoHref}>Agendar una demo</CTA><button className="m-menu-toggle" aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuOpen} aria-controls="m-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></div></div><nav id="m-mobile-nav" className="m-mobile-nav" hidden={!menuOpen} aria-label="Navegación móvil" onKeyDown={e => { if (e.key === "Escape") { setMenuOpen(false); document.querySelector<HTMLButtonElement>(".m-menu-toggle")?.focus(); } }}>{navLinks.map(([label, id]) => <a href={`#${id}`} key={id} onClick={() => setMenuOpen(false)}>{label}<ArrowUpRight size={16} /></a>)}<Link href="/caja">Terminal Web de Caja</Link><Link href="/login">Panel de Admin (CRM)</Link></nav></header>
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
        <SectionWave from="cream" />
        <DemoStory />
        <SectionWave from="red" />
<section id="preguntas" className="m-section m-faq"><div className="m-container m-faq-grid"><Reveal className="m-section-heading"><Eyebrow>TE LO HACEMOS SIMPLE</Eyebrow><h2>Quizás te estés<br />preguntando…</h2><p>Todo lo que necesitás saber<br />antes del primer mimo.</p><a className="m-text-link" href={demoHref}>Preguntanos por una demo <MessageCircle size={18} /></a></Reveal><div className="m-faq-list">{faq.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={19} /></summary><p>{answer}</p></details>)}</div></div></section>
      </div>
    </main>
    <footer className="m-footer m-story-footer"><BrandHeart className="m-footer-heart" /><div className="m-container"><div className="m-footer-top"><a href="#inicio" aria-label="mimo rewards, volver al inicio"><Brand /></a><p>Sellos con NFC.<br />Un programa con tu marca.</p><nav aria-label="Enlaces del pie de página"><a href="#sumarse">Cómo funciona</a><a href="#kit">Kit y precio</a><a href={demoHref}>Agendar demo</a><button onClick={() => setLegal("privacy")}>Privacidad</button><button onClick={() => setLegal("terms")}>Términos</button></nav></div><div className="m-footer-bottom"><span>© {new Date().getFullYear()} mimo rewards</span><span><Heart size={13} fill="currentColor" /> Hecho para los comercios de todos los días.</span><div><Link href="/caja">Caja <ArrowUpRight size={12} /></Link><Link href="/login">Panel de Admin <ArrowUpRight size={12} /></Link></div></div></div></footer>
    {legal && <LegalDialog type={legal} close={() => setLegal(null)} />}
  </div>;
}
