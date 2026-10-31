"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Heart, Menu, X } from "lucide-react";
import { Brand, CTA } from "./ui";
import { BrandHeart } from "./StoryArt";
import { LegalDialog } from "./contact";
import { demoHref } from "./demo-link";

const navLinks = [["Qué es", "valor"], ["Cómo funciona", "sumarse"], ["Para tu negocio", "para-comercios"], ["Planes", "planes"], ["FAQ", "preguntas"]];

export default function LandingFrame({ children, isHome = false, className = "" }: { children: ReactNode; isHome?: boolean; className?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(null);
  const sectionHref = (section: string) => isHome ? `#${section}` : `/#${section}`;
  return <div className={`m-landing ${className}`} id="inicio">
    <a className="m-skip-link" href="#contenido">Ir al contenido</a>
    <header className="m-header m-story-header"><div className="m-container m-nav"><a href={sectionHref("inicio")} aria-label="mimo rewards, inicio"><Brand /></a><nav className="m-desktop-nav" aria-label="Navegación principal">{navLinks.map(([label, id]) => <a href={sectionHref(id)} key={id}>{label}</a>)}</nav><div className="m-nav-actions"><CTA href={demoHref}>Quiero conocer mimo</CTA><button className="m-menu-toggle" aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuOpen} aria-controls="m-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></div></div><nav id="m-mobile-nav" className="m-mobile-nav" hidden={!menuOpen} aria-label="Navegación móvil" onKeyDown={e => { if (e.key === "Escape") { setMenuOpen(false); document.querySelector<HTMLButtonElement>(".m-menu-toggle")?.focus(); } }}>{navLinks.map(([label, id]) => <a href={sectionHref(id)} key={id} onClick={() => setMenuOpen(false)}>{label}<ArrowUpRight size={16} /></a>)}<Link href="/caja">Terminal Web de Caja</Link><Link href="/login">Panel de Admin (CRM)</Link></nav></header>
    {children}
    <footer className="m-footer m-story-footer"><BrandHeart className="m-footer-heart" /><div className="m-container"><div className="m-footer-top"><a href={sectionHref("inicio")} aria-label="mimo rewards, volver al inicio"><Brand /></a><p>Sellos con NFC.<br />Un programa con tu marca.</p><nav aria-label="Enlaces del pie de página"><a href={sectionHref("sumarse")}>Cómo funciona</a><a href={sectionHref("planes")}>Planes</a><a href={demoHref}>Hablemos</a><button onClick={() => setLegal("privacy")}>Privacidad</button><button onClick={() => setLegal("terms")}>Términos</button></nav></div><div className="m-footer-bottom"><span>© {new Date().getFullYear()} mimo rewards</span><span><Heart size={13} fill="currentColor" /> Hecho para los comercios de todos los días.</span><div><Link href="/caja">Caja <ArrowUpRight size={12} /></Link><Link href="/login">Panel de Admin <ArrowUpRight size={12} /></Link></div></div></div></footer>
    {legal && <LegalDialog type={legal} close={() => setLegal(null)} />}
  </div>;
}
