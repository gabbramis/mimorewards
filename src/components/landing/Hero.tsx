import { ArrowDown } from "lucide-react";
import { CTA } from "./ui";
import { demoHref } from "./demo-link";

export default function Hero() {
  return (
    <div className="m-story-hero-copy">
      <span className="m-story-kicker">MIMO REWARDS</span>
      <h1>Programa de sellos<br /><em>con NFC.</em></h1>
      <p>Una tarjeta digital, sellos y motivos para volver. Empezá gratis con QR o elegí un plan con tótem NFC. Tus clientes suman visitas y avanzan hacia su próxima recompensa.</p>
      <div className="m-story-actions">
        <CTA href={demoHref}>Quiero conocer mimo</CTA>
        <a className="m-story-secondary-link" href="#sumarse">Ver cómo funciona</a>
      </div>
      <span className="m-story-scroll-cue" aria-hidden="true">
        <ArrowDown size={16} /> Deslizá para descubrir
      </span>
    </div>
  );
}
