import Link from "next/link";
import { CUSTOMER_CONSENT_VERSION } from "@/lib/customer-consent";
import "../../customer-legal.css";

export const metadata = { title: "Términos de uso de la tarjeta | mimo rewards" };

export default function TermsPage() {
  return <main className="customer-legal">
    <div className="customer-legal-card">
      <Link className="customer-legal-back" href="/">← Volver a mimo</Link>
      <p className="customer-legal-eyebrow">MIMO REWARDS</p>
      <h1>Términos de uso de la tarjeta</h1>
      <p className="customer-legal-date">Versión {CUSTOMER_CONSENT_VERSION}</p>
      <p>Al crear una tarjeta te sumás al programa de beneficios del comercio identificado en el registro. mimo rewards proporciona la tarjeta digital y las herramientas para gestionar sellos y canjes.</p>

      <h2>Cómo funciona</h2>
      <p>El comercio define qué compra válida suma un sello, cuántos sellos hacen falta para un premio y cuál es ese premio. Esa información se muestra en tu tarjeta o en el comercio. Los sellos se registran después de una compra válida; el sistema puede aplicar un intervalo mínimo entre sellos para evitar duplicados.</p>

      <h2>Premios y canjes</h2>
      <p>El comercio entrega los premios y confirma los canjes. Los sellos y premios no equivalen a dinero, no se pueden transferir ni cambiar por efectivo. Si una compra se anula o un sello se registró por error, el comercio puede solicitar una corrección justificada. Los detalles de disponibilidad o exclusiones de cada premio deben informarse en el local.</p>

      <h2>Uso de tu tarjeta</h2>
      <p>Usá tus propios datos y cuidá el acceso al celular o enlace de tu tarjeta. Si perdés el acceso, podés intentar recuperarla con el número registrado o pedir ayuda al comercio. Si hay un problema técnico, el comercio podrá ayudarte a revisar el sello o canje.</p>

      <h2>Datos y comunicaciones</h2>
      <p>Para prestar el servicio tratamos tus datos como se explica en la <Link href="/privacidad">Política de privacidad</Link>. Recibir promociones por WhatsApp es opcional y depende de una casilla separada en el registro; podés retirar esa autorización cuando quieras.</p>

      <h2>Consultas</h2>
      <p>Para dudas sobre compras, sellos y premios, consultá al comercio de tu tarjeta. Para dudas sobre la plataforma o tus datos, escribí a <a href="mailto:contactomimorewards@gmail.com">contactomimorewards@gmail.com</a>.</p>
      <Link className="customer-legal-back" href="/privacidad">Leer la política de privacidad →</Link>
    </div>
  </main>;
}
