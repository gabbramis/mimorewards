import { ArrowDown } from "lucide-react";
import { CTA } from "./ui";
import { demoHref } from "./demo-link";

export default function Hero() {
  return (
    <div className="m-story-hero-copy">
      <span className="m-story-kicker">MIMO REWARDS</span>
      <h1>Dales un motivo<br /><em>para volver.</em></h1>
      <p>Convertí las compras de tus clientes en sellos y recompensas, con una tarjeta digital de tu local. Empezá gratis con QR. Sin descargar una app.</p>
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
