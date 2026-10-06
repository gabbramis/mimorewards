"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUpRight, Coffee, Gift, Heart } from "lucide-react";
import type { ReactNode } from "react";

export function Brand({ light = false }: { light?: boolean }) {
  return <span className={`m-brand ${light ? "m-brand-light" : ""}`}><Image src="/images/mimo-wordmark.png" width={1220} height={469} alt="mimo rewards" /></span>;
}

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={false} whileInView={reduced ? {} : { y: [16, 0] }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.55, ease: "easeOut" }}>{children}</motion.div>;
}

export function CTA({ children = "Quiero usar mimo", secondary = false, href = "#acceso", className = "" }: { children?: ReactNode; secondary?: boolean; href?: string; className?: string }) {
  return <a href={href} className={`m-button ${secondary ? "m-button-secondary" : "m-button-primary"} ${className}`}>{children}{secondary ? <ArrowDown size={17} /> : <ArrowUpRight size={18} />}</a>;
}

export function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <span className={`m-eyebrow ${light ? "m-eyebrow-light" : ""}`}>{children}</span>;
}

export function Stamps({ count = 4 }: { count?: number }) {
  return <div className="m-stamps" aria-label={`${count} de 10 sellos`}>{Array.from({ length: 10 }, (_, i) => <span key={i} className={i < count ? "m-stamped" : ""}>{i < count ? <Heart size={17} fill="currentColor" /> : i === 9 ? <Gift size={17} /> : <span className="m-stamp-dot" />}</span>)}</div>;
}

export function DemoLoyaltyCard({ count = 4, mini = false }: { count?: number; mini?: boolean }) {
  return <div className={`m-loyalty-card ${mini ? "m-loyalty-mini" : ""}`}><div className="m-card-top"><div><span className="m-cafe-name"><Coffee size={17} /> café de la esquina</span><span className="m-card-caption">Tu pausa de siempre, con un mimo.</span></div><Heart size={24} fill="currentColor" /></div><div className="m-card-balance"><strong>{count}<span>/10 sellos</span></strong><span>1 compra = 1 sello</span></div><Stamps count={count} /><div className="m-card-reward"><Gift size={17} /><span>{count === 10 ? "¡Recompensa disponible!" : "Tu próximo mimo"}<strong>Un café gratis</strong></span><ArrowUpRight size={17} /></div><div className="m-card-bottom"><span>Hecho con <Heart size={9} fill="currentColor" /> por mimo</span><span>TARJETA DE BENEFICIOS</span></div></div>;
}
