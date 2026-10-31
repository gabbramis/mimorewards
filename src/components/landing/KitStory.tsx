import Image from "next/image";
import { Check } from "lucide-react";
import { CTA, Eyebrow, Reveal } from "./ui";
import { BrandHeart } from "./StoryArt";

export default function KitStory() {
  return <section id="kit" className="m-kit-story m-story-section">
    <BrandHeart className="m-kit-story-heart" />
    <div className="m-kit-story-layout">
      <Reveal className="m-kit-story-photo"><Image src="/images/mimo-identity-kit.webp" fill sizes="(max-width: 760px) 100vw, 58vw" alt="Ilustración conceptual del kit mimo en una cafetería: soporte NFC rojo, sticker y tarjeta digital" /><span>Una vista conceptual del kit mimo.</span></Reveal>
      <div className="m-kit-story-copy">
        <Eyebrow>UNA CAJA MUY TUYA</Eyebrow>
        <h2>Abrís el kit.<br /><em>Ya está configurado.</em></h2>
        <p>Nos pasás tu logo y elegís la recompensa. Nosotros preparamos la tarjeta digital y el kit para que puedas empezar en tu local.</p>
        <ul>
          {["Pro: soporte de acrílico con QR y NFC", "Premium: soporte personalizado y llaveros para tu equipo", "Tarjeta digital con la marca de tu negocio", "Acompañamiento para empezar a usarlo"].map(item => <li key={item}><Check size={16} />{item}</li>)}
        </ul>
        <p className="m-kit-terms">¿Preferís empezar sin kit? El plan Inicial incluye un QR en PDF para imprimir o mostrar en la caja.</p>
        <CTA href="#planes">Elegí tu plan</CTA>
      </div>
    </div>
  </section>;
}
