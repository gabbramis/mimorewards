import { ArrowUpRight, Check } from "lucide-react";
import { Eyebrow } from "./ui";


const chapters = [
  {
    number: "01",
    label: "LISTO PARA TU LOCAL",
    title: "Recibís mimo configurado para tu comercio.",
    body: "Preparamos tu tarjeta digital y definimos la recompensa inicial. Empezá con un QR para imprimir o elegí un plan con tótem NFC listo para el mostrador.",
  },
  {
    number: "02",
    label: "EN CADA COMPRA",
    title: "Acercan el celular y suman un sello.",
    body: "La primera vez, el cliente se registra. Después, en cada compra válida, acerca el mismo celular al soporte NFC y el sello se suma a su tarjeta.",
  },
  {
    number: "03",
    label: "DEL LADO DEL NEGOCIO",
    title: "Seguís clientes, visitas, sellos y canjes.",
    body: "Desde el panel podés ver quién volvió, cuántos sellos tiene cada cliente, qué recompensas se canjearon y quiénes están cerca de completar su tarjeta.",
  },
];

export default function ValueStory() {
  return (
    <section id="valor" className="m-value-story m-story-section" aria-labelledby="m-value-title">
      <div className="m-container">
        <div className="m-value-heading">
          <div>
            <Eyebrow>ESTO ES MIMO</Eyebrow>
            <h2 id="m-value-title">
              Tu primer mimo.<br />
              <em>El comienzo de muchas visitas.</em>
            </h2>
          </div>

          <p>
            Empezá gratis con QR o sumá un tótem NFC con los planes Profesional y Premium.
            Tus clientes usan el celular para sumar sellos y vos seguís visitas,
            progreso y canjes desde el panel.
          </p>
        </div>

        <div className="m-value-chapters">
          {chapters.map(({ number, label, title, body }) => (
            <article className="m-value-chapter" key={number}>
              <span className="m-value-number" aria-hidden="true">{number}</span>
              <div>
                <span className="m-value-label">{label}</span>
                <h3>{title}</h3>
              </div>
              <p>{body}</p>
            </article>
          ))}
        </div>

        <div className="m-value-example">
          <div>
            <span>ASÍ SE VERÍA EN UNA CAFETERÍA</span>
            <strong>Diez cafés, uno de regalo.</strong>
            <p>
              Después de cada compra, el cliente acerca el celular al soporte NFC.
              El sello se suma a su tarjeta y el comercio registra el progreso y los canjes.
            </p>
          </div>

          <div className="m-value-example-detail">
            <span><Check size={16} /> Tarjeta digital con el logo y colores del café</span>
            <span><Check size={16} /> Sellos que se suman con NFC</span>
            <span><Check size={16} /> Visitas y canjes visibles desde el panel</span>
          </div>

          <a href="#kit" className="m-text-link">
            Conocé el kit <ArrowUpRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}

