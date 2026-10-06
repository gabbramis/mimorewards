import Image from "next/image";
import { Check } from "lucide-react";
import { CTA, Eyebrow, Reveal } from "./ui";
import { BrandHeart } from "./StoryArt";

export default function KitStory() {
  return <section id="kit" className="m-kit-story m-story-section"><BrandHeart className="m-kit-story-heart" /><div className="m-kit-story-layout"><Reveal className="m-kit-story-photo"><Image src="/images/mimo-identity-kit.webp" fill sizes="(max-width: 760px) 100vw, 58vw" alt="Kit mimo en una cafetería: soporte NFC rojo, sticker, packaging y tarjeta de bienvenida junto a la tarjeta digital" /><span>Del mostrador a su próxima visita.</span></Reveal><div className="m-kit-story-copy"><Eyebrow>CHICO EN TU MOSTRADOR.<br />GRANDE EN TU NEGOCIO.</Eyebrow><h2>Todo empieza<br /><em>en el mostrador.</em></h2><p>Colocás el soporte, el cliente acerca el celular y listo. mimo conecta esa visita con todo lo demás.</p><ul>{["2 soportes NFC personalizados","Configuración inicial","Tarjeta digital para tus clientes","Panel web para tu comercio","Programa de fidelización","Soporte para acompañarte"].map(item=><li key={item}><Check size={16} />{item}</li>)}</ul><CTA>Quiero mi kit mimo</CTA></div></div></section>;
}
