import { ArrowDown } from "lucide-react";
import { CTA } from "./ui";
import { demoHref } from "./demo-link";

export default function Hero() {
  return (
    <div className="m-story-hero-copy">
      <span className="m-story-kicker">MIMO REWARDS</span>
      <h1>Programa de sellos<br /><em>con NFC.</em></h1>
      <p>Tu kit NFC, listo para el mostrador. Tus clientes suman sellos con un toque y vos seguís cada visita desde tu panel.</p>
      <div className="m-story-actions">
        <CTA href={demoHref}>Agendar una demo</CTA>
        <a className="m-story-secondary-link" href="#sumarse">Ver cómo funciona</a>
      </div>
      <span className="m-story-scroll-cue" aria-hidden="true">
        <ArrowDown size={16} /> Deslizá para descubrir
      </span>
    </div>
  );
}
