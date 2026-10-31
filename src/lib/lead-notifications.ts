import "server-only";
import nodemailer from "nodemailer";
import { LEAD_PLAN_NAMES, type LandingLeadInput } from "./landing-leads";

export async function notifyLandingLead(lead: LandingLeadInput): Promise<boolean> {
  const { MAIL_HOST, MAIL_USER, MAIL_PASS } = process.env;
  if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS) return false;
  const port = Number(process.env.MAIL_PORT || 587);
  const transport = nodemailer.createTransport({
    host: MAIL_HOST, port, secure: port === 465, requireTLS: true,
    auth: { user: MAIL_USER, pass: MAIL_PASS },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  try {
    const result = await transport.sendMail({
      from: { name: "mimo rewards", address: MAIL_USER },
      to: process.env.MAIL_TO || "contactomimorewards@gmail.com",
      subject: "Nueva consulta · mimo rewards",
      text: `Nombre: ${lead.name}\nNegocio: ${lead.business}\nWhatsApp: ${lead.phone}\n${lead.email ? `Email: ${lead.email}\n` : ""}Plan: ${LEAD_PLAN_NAMES[lead.plan] || "A definir"}\n\nContactar: https://wa.me/${lead.phone.slice(1)}\n\nEnviado desde el formulario de mimo con autorización para responder por WhatsApp.`,
    });
    return result.accepted.length > 0;
  } catch {
    console.error("[landing-leads] No se pudo enviar la consulta por correo.");
    return false;
  } finally {
    transport.close();
  }
}
