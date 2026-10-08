import { ArrowDown, ArrowUpRight } from "lucide-react";
import { CTA } from "./ui";

export default function Hero() {
  return <div className="m-story-hero-copy">
    <h1>Dales una razón<br />para <em>volver.</em></h1>
    <p className="mt-4">Una tarjeta que acompaña a tus clientes. Un pequeño motivo para elegirte otra vez.</p>
    <div className="m-story-actions mt-6 relative z-10 pointer-events-auto">
      <CTA>Quiero mimo en mi local</CTA>
    </div>
    <span className="m-story-scroll-cue" aria-hidden="true"><ArrowDown size={16} /> Deslizá para descubrir</span>
  </div>;
}
