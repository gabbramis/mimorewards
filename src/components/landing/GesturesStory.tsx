"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Brand, Eyebrow } from "./ui";
import { BrandHeart } from "./StoryArt";

const messages = [
  {segment:"Cumpleaños",title:"🎂 ¡Feliz cumple, Gabi!",body:"Tenés 20% OFF esta semana.",note:"Un pequeño regalo en su día."},
  {segment:"Inactivos",title:"Hace 30 días que no venís 👀",body:"Tenemos algo para vos.",note:"Una buena excusa para reencontrarse."},
  {segment:"Cerca de una recompensa",title:"Te falta solo 1 ♥",body:"para tu próximo mimo.",note:"A veces, volver necesita un recordatorio."},
  {segment:"Frecuentes",title:"Qué lindo verte otra vez, Sofi.",body:"Hoy tenemos un mimo especial para vos.",note:"Reconocé a quienes siempre están."},
  {segment:"Nuevos",title:"Tu primer mimo empieza acá.",body:"Gracias por ser parte. ¡Nos vemos pronto!",note:"La primera visita puede ser el comienzo."},
];

export default function GesturesStory() {
  const [selected,setSelected]=useState(0);
  const message=messages[selected];
  return <section className="m-gestures-story m-story-section"><div className="m-container m-gestures-grid"><div className="m-gestures-copy"><Eyebrow>LO QUE PASA ENTRE UNA VISITA Y OTRA</Eyebrow><h2>Usá el historial para <em>volver a hablarles.</em></h2><p>Volvé a hablarles en el momento justo: un cumpleaños, una recompensa por desbloquear o alguien que hace tiempo no viene.</p><div className="m-gesture-segments" role="group" aria-label="Elegí un segmento para ver un mensaje de ejemplo">{messages.map((item,i)=><button type="button" key={item.segment} aria-pressed={selected===i} onClick={()=>setSelected(i)}>{item.segment}</button>)}</div></div>
    <div className="m-message-composition"><BrandHeart className="m-message-heart" /><div className="m-message-red-shape" aria-hidden="true" />
      <div className="m-message-teaser m-message-teaser-one"><span>UN PEQUEÑO RECORDATORIO</span><strong>Te falta solo 1 ♥<br />para tu próximo mimo.</strong></div>
      <div className="m-message-ticket" aria-live="polite" aria-atomic="true"><div className="m-message-ticket-top"><Brand /><span>PARA VOS <Heart size={14} fill="currentColor" /></span></div><div key={selected} className="m-message-ticket-content"><span>{message.segment}</span><h3>{message.title}</h3><p>{message.body}</p></div><span className="m-message-ticket-note">{message.note}</span></div>
      <div className="m-message-teaser m-message-teaser-two"><strong>Hace 30 días que no venís 👀</strong><span>Tenemos algo para vos.</span></div><small className="m-message-example-label">EJEMPLOS DE MENSAJES</small>
    </div>
  </div></section>;
}
