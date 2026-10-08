import { CTA, Eyebrow } from "./ui";
import { BrandHeart } from "./StoryArt";
import { demoHref } from "./demo-link";

export default function DemoStory() {
  return <section id="demo" className="m-demo-story m-story-section" aria-labelledby="m-demo-title">
    <BrandHeart className="m-demo-heart" />
    <div className="m-container m-demo-inner">
      <div><Eyebrow light>EL SIGUIENTE PASO</Eyebrow><h2 id="m-demo-title">Mirá cómo funcionaría<br /><em>mimo en tu local.</em></h2><p>Te mostramos el toque NFC, la tarjeta con tu identidad, cómo se suman los sellos y qué podés ver desde el panel. También conversamos sobre la recompensa que querés ofrecer.</p></div>
      <div className="m-demo-action"><span>DEMO PARA LOCALES GASTRONÓMICOS</span><CTA href={demoHref}>Agendar una demo</CTA><small>Se abre tu correo para coordinar un horario con nosotros.<br />contactomimorewards@gmail.com</small></div>
    </div>
  </section>;
}
