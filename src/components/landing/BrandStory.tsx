"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Heart, Wallet, Wifi } from "lucide-react";
import { Brand, DemoLoyaltyCard, Eyebrow } from "./ui";
import { BrandHeart } from "./StoryArt";

function NfcStand() {
  return <div className="m-nfc-stand" aria-label="Soporte NFC mimo"><Brand light /><strong>ACERCÁ<br />TU CELULAR</strong><span className="m-nfc-touch"><Wifi size={44} /></span><BrandHeart /><span className="m-nfc-base" /></div>;
}

export function JoinJourney() {
  const reduced = useReducedMotion();
  return <section id="sumarse" className="m-join-story m-story-section">
    <BrandHeart className="m-join-heart" />
    <div className="m-container">
      <div className="m-join-heading"><div><Eyebrow>MENOS PASOS, MÁS ENCUENTROS</Eyebrow><h2>Un toque.<br /><em>Y ya son parte.</em></h2></div><div><p>Colocás mimo en tu mostrador. Tus clientes acercan el celular, se registran una vez y guardan su tarjeta.</p><div className="m-join-promises"><span><Check size={16} /> Sin app para descargar</span><span><Wallet size={16} /> Apple Wallet y Google Wallet</span></div></div></div>
      <div className="m-join-route">
        <svg className="m-route-desktop" viewBox="0 0 1200 280" preserveAspectRatio="none" aria-hidden="true"><motion.path d="M20 160C190 310 265 0 420 95S625 290 775 165 1040 50 1180 130" fill="none" stroke="currentColor" strokeWidth="18" strokeLinecap="round" initial={false} whileInView={reduced ? {} : { pathLength: [0, 1] }} viewport={{once:true,amount:.3}} transition={{duration:2.4,ease:"easeOut"}} /></svg>
        <svg className="m-route-mobile" viewBox="0 0 350 660" preserveAspectRatio="none" aria-hidden="true"><motion.path d="M58 72C-70 258 368 81 279 277S-39 282 65 462 409 484 285 636" fill="none" stroke="currentColor" strokeWidth="15" strokeLinecap="round" initial={false} whileInView={reduced ? {} : { pathLength: [0, 1] }} viewport={{once:true,amount:.25}} transition={{duration:2.4,ease:"easeOut"}} /></svg>
        <article className="m-join-step"><div className="m-join-object"><NfcStand /></div><h3><span>01</span> Acercan</h3><p>El cliente acerca su celular al soporte mimo.</p></article>
        <article className="m-join-step"><div className="m-join-object"><div className="m-registration-slip"><Brand /><strong>Tu primer mimo<br />empieza acá.</strong><span>Tu nombre</span><div>Sofía López <Check size={14} /></div><span className="m-registration-done">¡Ya sos parte! <Heart size={13} fill="currentColor" /></span></div></div><h3><span>02</span> Se suman</h3><p>Se registra una sola vez.</p></article>
        <article className="m-join-step"><div className="m-join-object"><div className="m-join-phone"><span className="m-join-island" /><span className="m-join-wallet"><Wallet size={13} /> Wallet</span><DemoLoyaltyCard mini /><span className="m-join-saved"><Check size={12} /> Siempre a mano</span></div></div><h3><span>03</span> Guardan</h3><p>Su tarjeta queda en Apple Wallet o Google Wallet.</p></article>
        <article className="m-join-step"><div className="m-join-object m-join-return"><BrandHeart /><span>Nos vemos<br />pronto.</span></div><h3><span>04</span> Vuelven</h3><p>Cada compra puede acercarlos a su próximo mimo.</p></article>
      </div>
    </div>
  </section>;
}
