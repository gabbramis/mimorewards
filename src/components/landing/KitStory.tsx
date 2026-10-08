import Image from "next/image";
import { Check } from "lucide-react";
import { CTA, Eyebrow, Reveal } from "./ui";
import { BrandHeart } from "./StoryArt";
import { demoHref } from "./demo-link";

export default function KitStory() {
  return <section id="kit" className="m-kit-story m-story-section">
    <BrandHeart className="m-kit-story-heart" />
    <div className="m-kit-story-layout">
      <Reveal className="m-kit-story-photo"><Image src="/images/mimo-identity-kit.webp" fill sizes="(max-width: 760px) 100vw, 58vw" alt="Ilustración conceptual del kit mimo en una cafetería: soporte NFC rojo, sticker y tarjeta digital" /><span>Una vista conceptual del kit mimo.</span></Reveal>
      <div className="m-kit-story-copy">
        <Eyebrow>UNA CAJA MUY TUYA</Eyebrow>
        <h2>Abrís el kit.<br /><em>Ya está configurado.</em></h2>
        <p>Nos pasás el logo, los colores y la recompensa de tu local. Preparamos la tarjeta digital y los soportes NFC antes de entregarte la caja mimo. Tu equipo solo tiene que presentarlos después de cada compra válida.</p>
        <ul>
          {["2 soportes NFC personalizados para el mostrador", "Tarjeta digital con el logo y los colores de tu local", "Programa de sellos y recompensa configurados", "Acceso al panel de clientes, visitas y canjes", "Acompañamiento para empezar a usarlo"].map(item => <li key={item}><Check size={16} />{item}</li>)}
        </ul>
        <div id="precio" className="m-kit-price"><span>PLAN MIMO</span><div><strong>$1.290</strong><small>/ mes</small></div><p>El kit físico se cobra aparte. Te confirmamos su precio antes de comenzar.</p></div>
        <CTA href={demoHref}>Agendar una demo</CTA>
      </div>
    </div>
  </section>;
}
