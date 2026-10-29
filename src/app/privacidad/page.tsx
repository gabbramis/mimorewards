import Link from "next/link";
import { CUSTOMER_CONSENT_VERSION } from "@/lib/customer-consent";
import "../customer-legal.css";

export const metadata = { title: "Política de privacidad | mimo rewards" };

export default function PrivacyPage() {
  return <main className="customer-legal">
    <div className="customer-legal-card">
      <Link className="customer-legal-back" href="/">← Volver a mimo</Link>
      <p className="customer-legal-eyebrow">MIMO REWARDS</p>
      <h1>Política de privacidad</h1>
      <p className="customer-legal-date">Versión {CUSTOMER_CONSENT_VERSION}</p>
      <p>Esta política explica cómo se usan tus datos cuando creás y usás una tarjeta de beneficios de un comercio en mimo rewards.</p>

      <h2>Consultas desde la página de mimo</h2>
      <p>Si completás el formulario para tu negocio, tu nombre, negocio, WhatsApp y plan de interés se envían por correo al equipo de mimo para responderte por WhatsApp. No se guardan en una base de datos ni te suscribimos a campañas. Podés pedir que dejemos de contactarte o eliminemos tu consulta escribiendo a contactomimorewards@gmail.com.</p>

      <h2>Qué datos usamos</h2>
      <p>Al registrarte pedimos nombre, apellido, celular y fecha de nacimiento. También guardamos el comercio al que te sumaste, tu tarjeta, sellos, visitas y canjes, y la fecha y versión de tu aceptación de esta política y los términos. Si autorizás promociones por WhatsApp, guardamos esa elección y cuándo la hiciste.</p>

      <h2>Para qué los usamos</h2>
      <p>Usamos estos datos para crear y recuperar tu tarjeta, registrar visitas y sellos, mostrarte el progreso, permitir canjes, atender consultas y mantener seguro el programa. El comercio puede consultar los datos de sus clientes para administrar sus beneficios. La fecha de nacimiento puede servir para beneficios de cumpleaños si el comercio los ofrece.</p>
      <p>Solo si marcás la casilla opcional, el comercio podrá enviarte promociones y novedades de su programa por WhatsApp al celular registrado. Crear una tarjeta no te obliga a aceptar promociones. Esta elección no autoriza campañas de otros comercios ni mensajes promocionales por correo electrónico.</p>

      <h2>Quiénes acceden a los datos</h2>
      <p>Acceden el comercio de tu tarjeta y el equipo de mimo rewards según lo necesario para operar y dar soporte al servicio. También usamos proveedores tecnológicos para alojar y prestar la plataforma; algunos tratamientos pueden realizarse fuera de Uruguay. No usamos tu autorización para un comercio como permiso para promocionar a otro.</p>

      <h2>Durante cuánto tiempo</h2>
      <p>Conservamos los datos mientras tu tarjeta esté activa y durante el tiempo necesario para atender solicitudes, resolver incidentes y cumplir obligaciones aplicables. Si pedís su eliminación, revisaremos la solicitud y te informaremos si algún dato debe conservarse por una obligación vigente.</p>

      <h2>Tus decisiones y derechos</h2>
      <p>Podés pedir acceso, corrección o eliminación de tus datos, o dejar de recibir promociones, escribiendo a <a href="mailto:contactomimorewards@gmail.com">contactomimorewards@gmail.com</a>. Para retirar la autorización promocional, indicá el comercio y el celular registrado; verificaremos tu solicitud antes de modificar la preferencia. También podés plantearlo al comercio que figura en tu tarjeta.</p>

      <h2>Seguridad y cambios</h2>
      <p>Aplicamos controles de acceso al panel de los comercios y medidas técnicas para proteger la información. Si cambiamos de forma importante esta política, publicaremos una nueva versión y solicitaremos una nueva aceptación cuando corresponda.</p>
      <p className="customer-legal-end">Consultas sobre privacidad: <a href="mailto:contactomimorewards@gmail.com">contactomimorewards@gmail.com</a>.</p>
      <Link className="customer-legal-back" href="/terminos">Leer los términos de uso →</Link>
    </div>
  </main>;
}
