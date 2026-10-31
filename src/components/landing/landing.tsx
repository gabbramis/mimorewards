"use client";

import { useState } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { Eyebrow, Reveal } from "./ui";
import IntroScrollStory from "./IntroScrollStory";
import { JoinJourney } from "./BrandStory";
import RewardsStory from "./RewardsStory";
import MerchantStory from "./MerchantStory";
import KitStory from "./KitStory";
import PlansStory from "./PlansStory";
import DemoStory from "./DemoStory";
import { demoHref } from "./demo-link";
import { SectionWave } from "./StoryArt";
import { LegalDialog } from "./contact";
import LandingFrame from "./LandingFrame";


const faq = [
  ["¿Mis clientes necesitan una app o un celular especial?", "No necesitan descargar una app. Pueden escanear el QR con la cámara del celular y abrir su tarjeta en el navegador. Si su equipo tiene NFC, también pueden acercarlo al soporte. Guardar la tarjeta en Apple Wallet o Google Wallet es opcional."],
  ["¿Tengo que cambiar mi sistema de caja?", "No. mimo funciona por separado. Tu equipo sigue cobrando como siempre y usa el programa después de cada compra válida."],
  ["¿Quién elige los sellos y la recompensa?", "Vos definís qué compra suma un sello, cuántos sellos completan la tarjeta y qué premio ofrecés. Te ayudamos a configurarlo con el logo y los colores de tu local."],
  ["¿Cómo se controla que haya una compra?", "Tu equipo valida la compra antes de presentar el QR o el soporte. mimo aplica un tiempo entre sellos para evitar repeticiones inmediatas y registra las visitas y los canjes en el panel."],
  ["¿Puedo empezar sin comprar un kit?", "Sí. Inicial no tiene mensualidad e incluye un QR en PDF para imprimir o mostrar en la caja. Los planes Pro y Premium suman el soporte físico y otras opciones, con los costos indicados arriba."],
  ["¿Cómo empiezo?", "Completá el formulario y te escribimos por WhatsApp. Conversamos sobre tu negocio, elegimos el plan y coordinamos la configuración. Si pedís un kit, confirmamos disponibilidad y entrega antes de empezar."],
];


export default function Landing() {
  const [selectedPlan, setSelectedPlan] = useState("");
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(null);
  return <LandingFrame isHome>


    <main id="contenido">
      <IntroScrollStory />
      <div className="m-after-hero">
        <div id="valor"><JoinJourney /></div>
        <MerchantStory />
        <SectionWave from="cream" />
        <RewardsStory />
        <SectionWave from="red" />
        <KitStory />
        <PlansStory onSelectPlan={setSelectedPlan} />
        <div className="m-contact-wave"><SectionWave from="cream" /></div>
        <DemoStory onPrivacy={() => setLegal("privacy")} selectedPlan={selectedPlan} />
        <div className="m-contact-wave"><SectionWave from="red" /></div>
<section id="preguntas" className="m-section m-faq"><div className="m-container m-faq-grid"><Reveal className="m-section-heading"><Eyebrow>TE LO HACEMOS SIMPLE</Eyebrow><h2>Quizás te estés<br />preguntando…</h2><p>Todo lo que necesitás saber<br />antes del primer mimo.</p><a className="m-text-link" href={demoHref}>Hablemos de tu negocio <MessageCircle size={18} /></a></Reveal><div className="m-faq-list">{faq.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={19} /></summary><p>{answer}</p></details>)}</div></div></section>
      </div>
    </main>

    {legal && <LegalDialog type={legal} close={() => setLegal(null)} />}
  </LandingFrame>;
}
