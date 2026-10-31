import { Check, Heart, QrCode, Nfc, Sparkles } from "lucide-react";
import { CTA, Eyebrow, Reveal } from "./ui";
import { demoHref } from "./demo-link";
import { launchPlans } from "./plans";

const planIcons = [QrCode, Nfc, Sparkles];

export default function PlansStory({ onSelectPlan }: { onSelectPlan: (plan: string) => void }) {
  return <section id="planes" className="m-plans-story m-story-section" aria-labelledby="m-plans-title">
    <div className="m-container">
      <div id="precio" className="m-plans-heading">
        <div><Eyebrow>UN MIMO PARA CADA ETAPA</Eyebrow><h2 id="m-plans-title">Empezá con poco.<br /><em>Hacé que vuelvan más.</em></h2></div>
        <p>Desde tu primer QR hasta una estrategia para traerlos de vuelta. Elegí el plan que acompaña el momento de tu local.</p>
      </div>
      <p className="m-plans-currency">Precios de lanzamiento en pesos uruguayos (UYU). Suscripción mensual y kit por única vez.</p>
      <div className="m-plans-grid">
        {launchPlans.map((plan, index) => {
          const Icon = planIcons[index];
          return <Reveal key={plan.id} className={`m-plan-wrap${plan.featured ? " m-plan-featured" : ""}`}>
            <article className="m-plan" aria-labelledby={`m-plan-${plan.id}`}>
              <div className="m-plan-label"><span>{plan.label}</span>{plan.featured ? <Heart size={18} fill="currentColor" aria-hidden="true" /> : <Icon size={20} aria-hidden="true" />}</div>
              <h3 id={`m-plan-${plan.id}`}>{plan.name}</h3>
              <p className="m-plan-description">{plan.description}</p>
              <div className="m-plan-price"><strong>{plan.price}</strong><span>/ mes</span></div>
              <p className="m-plan-kit-price">{plan.kitPrice ? <>+ {plan.kitPrice} de kit, por única vez</> : "Sin costo de kit. Sin mensualidad."}</p>
              <div className="m-plan-hardware"><Icon size={22} aria-hidden="true" /><p>{plan.hardware}</p></div>
              <strong className="m-plan-capacity">{plan.capacity}</strong>
              <ul>{plan.features.map(feature => <li key={feature}><Check size={16} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
              <CTA href={demoHref} onClick={() => onSelectPlan(plan.id)}>{plan.cta}</CTA>
            </article>
          </Reveal>;
        })}
      </div>
      <div className="m-plans-details">
        <div><span>CRECÉ A TU RITMO</span><p>Podés empezar con Inicial y coordinar un cambio de plan cuando tu negocio lo necesite.</p></div>
        <div><span>SIN SORPRESAS</span><p>La mensualidad y el kit se muestran por separado. Confirmamos entrega y condiciones antes de empezar.</p></div>
      </div>
    </div>
  </section>;
}
