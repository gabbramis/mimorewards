export const LEAD_PLAN_NAMES: Record<string, string> = {
  inicial: "Inicial", profesional: "Pro", pro: "Pro", premium: "Premium",
};

export type LandingLeadInput = {
  name: string;
  business: string;
  phone: string;
  plan: string;
};

export function normalizeLeadPhone(value: string): string | null {
  if (value.length > 30 || !/^\+?[\d\s().-]+$/.test(value.trim())) return null;
  const digits = value.replace(/\D/g, "");
  if (/^09\d{7}$/.test(digits)) return `+598${digits.slice(1)}`;
  if (/^9\d{7}$/.test(digits)) return `+598${digits}`;
  const international = value.trim().startsWith("+") || digits.startsWith("598");
  return international && /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

export function parseLandingLead(body: unknown): { lead: LandingLeadInput; error?: never } | { error: string; lead?: never } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Revisá los datos del formulario." };
  const data = body as Record<string, unknown>;
  const field = (key: string) => typeof data[key] === "string" ? data[key].trim() : "";
  const name = field("name");
  const business = field("business");
  if (name.length < 2 || name.length > 100 || /[\u0000-\u001f]/.test(name)) return { error: "Escribí tu nombre (entre 2 y 100 caracteres)." };
  if (business.length < 2 || business.length > 150 || /[\u0000-\u001f]/.test(business)) return { error: "Escribí el nombre de tu negocio (entre 2 y 150 caracteres)." };
  const phone = normalizeLeadPhone(field("phone"));
  if (!phone) return { error: "Revisá tu WhatsApp. Por ejemplo: 099 123 456 o +598 99 123 456." };
  if (data.consent !== true) return { error: "Necesitamos tu autorización para contactarte por WhatsApp." };
  const plan = field("plan");
  if (plan && !Object.hasOwn(LEAD_PLAN_NAMES, plan)) return { error: "Elegí un plan válido o dejalo sin seleccionar." };
  return { lead: { name, business, phone, plan } };
}
