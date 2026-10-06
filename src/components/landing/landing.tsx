"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Heart, Menu, MessageCircle, Plus, X } from "lucide-react";
import { Brand, CTA, Eyebrow, Reveal } from "./ui";
import IntroScrollStory from "./IntroScrollStory";
import { JoinJourney } from "./BrandStory";
import RewardsStory from "./RewardsStory";
import MerchantStory from "./MerchantStory";
import GesturesStory from "./GesturesStory";
import KitStory from "./KitStory";
import { BrandHeart, SectionWave } from "./StoryArt";
import { EarlyAccess, LegalDialog } from "./contact";

const navLinks = [["Cómo funciona", "sumarse"], ["Para tu negocio", "para-comercios"], ["Kit", "kit"], ["FAQ", "preguntas"]];
const faq = [
  ["¿El cliente tiene que descargar una app?", "No. Se registra desde el navegador de su celular y puede guardar su tarjeta de beneficios en Apple Wallet o Google Wallet. Sin otra app y sin contraseñas para recordar."],
  ["¿Cómo se agregan los sellos?", "Inicialmente se agregan desde el panel del comercio. Más adelante se podrán sumar opciones mediante QR o integraciones con sistemas de venta. Vos definís qué compra suma un sello."],
  ["¿Necesito cambiar mi sistema de caja?", "No. mimo funciona de forma independiente. Podés seguir usando tu sistema de caja y gestionar la fidelización desde el panel web."],
  ["¿Qué pasa si el cliente no tiene NFC?", "También puede ingresar mediante un código QR. El registro y la tarjeta digital funcionan igual desde el navegador."],
  ["¿Puedo crear mis propias recompensas?", "Sí. Cada comercio define su programa: cuántos sellos se necesitan y qué recompensa se obtiene. Puede ser un café, un descuento o ese beneficio que sabés que les encanta."],
  ["¿Puedo comunicarme con mis clientes?", "Sí. El sistema está pensado para permitir promociones, recordatorios y campañas segmentadas, con el consentimiento de tus clientes. Los canales y funciones disponibles se confirmarán durante el acceso anticipado."],
];

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(null);
  return <div className="m-landing" id="inicio">
    <a className="m-skip-link" href="#contenido">Ir al contenido</a>
<header className="m-header m-story-header"><div className="m-container m-nav"><a href="#inicio" aria-label="mimo rewards, inicio"><Brand /></a><nav className="m-desktop-nav" aria-label="Navegación principal">{navLinks.map(([label, id]) => <a href={`#${id}`} key={id}>{label}</a>)}</nav><div className="m-nav-actions"><CTA /><button className="m-menu-toggle" aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuOpen} aria-controls="m-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></div></div><nav id="m-mobile-nav" className="m-mobile-nav" hidden={!menuOpen} aria-label="Navegación móvil" onKeyDown={e => { if (e.key === "Escape") { setMenuOpen(false); document.querySelector<HTMLButtonElement>(".m-menu-toggle")?.focus(); } }}>{navLinks.map(([label, id]) => <a href={`#${id}`} key={id} onClick={() => setMenuOpen(false)}>{label}<ArrowUpRight size={16} /></a>)}<Link href="/caja">Terminal Web de Caja</Link><Link href="/login">Panel de Admin (CRM)</Link></nav></header>
    <main id="contenido">
      <IntroScrollStory />
      <div className="m-after-hero">
        <JoinJourney />
        <SectionWave from="cream" />
        <RewardsStory />
        <SectionWave from="red" />
        <MerchantStory />
        <GesturesStory />
        <KitStory />
        <SectionWave from="cream" />
        <div className="m-access-composition"><BrandHeart className="m-access-art" /><EarlyAccess onPrivacy={() => setLegal("privacy")} /></div>
        <SectionWave from="red" />
<section id="preguntas" className="m-section m-faq"><div className="m-container m-faq-grid"><Reveal className="m-section-heading"><Eyebrow>TE LO HACEMOS SIMPLE</Eyebrow><h2>Quizás te estés<br />preguntando…</h2><p>Todo lo que necesitás saber<br />antes del primer mimo.</p><a className="m-text-link" href="#acceso">Conversemos <MessageCircle size={18} /></a></Reveal><div className="m-faq-list">{faq.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={19} /></summary><p>{answer}</p></details>)}</div></div></section>
      </div>
    </main>
    <footer className="m-footer m-story-footer"><BrandHeart className="m-footer-heart" /><div className="m-container"><div className="m-footer-top"><a href="#inicio" aria-label="mimo rewards, volver al inicio"><Brand /></a><p>Fidelización simple.<br />Relaciones que siguen.</p><nav aria-label="Enlaces del pie de página"><a href="#sumarse">Cómo funciona</a><a href="#beneficios">Beneficios</a><a href="#acceso">Contacto</a><button onClick={() => setLegal("privacy")}>Privacidad</button><button onClick={() => setLegal("terms")}>Términos</button></nav></div><div className="m-footer-bottom"><span>© {new Date().getFullYear()} mimo rewards</span><span><Heart size={13} fill="currentColor" /> Hecho para los comercios de todos los días.</span><div><Link href="/caja">Caja <ArrowUpRight size={12} /></Link><Link href="/login">Panel de Admin <ArrowUpRight size={12} /></Link></div></div></div></footer>
    {legal && <LegalDialog type={legal} close={() => setLegal(null)} />}
  </div>;
}
