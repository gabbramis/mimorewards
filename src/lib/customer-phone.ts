/**
 * Códigos de país soportados para el selector de área internacional
 */
export const COUNTRY_CODES = [
  { code: "+598", flag: "🇺🇾", name: "Uruguay (+598)" },
  { code: "+54", flag: "🇦🇷", name: "Argentina (+54)" },
  { code: "+55", flag: "🇧🇷", name: "Brasil (+55)" },
  { code: "+56", flag: "🇨🇱", name: "Chile (+56)" },
  { code: "+1", flag: "🇺🇸", name: "Estados Unidos (+1)" },
  { code: "+595", flag: "🇵🇾", name: "Paraguay (+595)" },
  { code: "+57", flag: "🇨🇴", name: "Colombia (+57)" },
  { code: "+52", flag: "🇲🇽", name: "México (+52)" },
  { code: "+34", flag: "🇪🇸", name: "España (+34)" },
] as const;

/**
 * Normaliza un número ingresado en el formulario según el código de país seleccionado.
 * - Concatena el código de país con el número ingresado.
 * - REGLA CLAVE: Si el código es +598 y el usuario digitó su número empezando con 0 (ej. 095123456),
 *   elimina ese 0 inicial de la cadena para que quede +59895123456.
 * - Devuelve siempre el número completo con el '+' inicial.
 */
export function formatCustomerSubmitPhone(rawNumber: string, countryCode: string = "+598"): string {
  if (!rawNumber) return "";
  let cleaned = rawNumber.replace(/[\s().-]/g, "").trim();

  // Si el usuario ya pegó o escribió el código de país con +
  if (cleaned.startsWith("+")) {
    if (cleaned.startsWith("+5980")) {
      return "+598" + cleaned.slice(5);
    }
    return cleaned;
  }

  // Si eligió +598 (Uruguay)
  if (countryCode === "+598") {
    // Si escribió 598 al inicio
    if (cleaned.startsWith("598")) {
      cleaned = cleaned.slice(3);
    }
    // REGLA CLAVE: Si empieza con 0, eliminar ese 0 inicial
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.slice(1);
    }
    return `+598${cleaned}`;
  }

  // Para otros países (ej. +54, +55, +56, +1)
  const code = countryCode.startsWith("+") ? countryCode : `+${countryCode}`;
  const codeDigits = code.replace(/\D/g, "");

  // Si escribió el código de país en el campo
  if (cleaned.startsWith(codeDigits)) {
    cleaned = cleaned.slice(codeDigits.length);
  }
  // Si empieza con 0 nacional, removerlo
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
  }

  return `${code}${cleaned}`;
}

/**
 * Limpia y normaliza un número de celular al formato canónico internacional con '+'.
 * - Limpia cualquier espacio en blanco o guión.
 * - Si es uruguayo, devuelve +5989XXXXXXX (eliminando el 0 inicial si vino como 09X).
 * - Si es internacional, preserva el formato con '+'.
 */
export function cleanUruguayPhone(value: unknown): string {
  if (typeof value !== "string") return "";
  let cleaned = value.replace(/[\s-]/g, "").trim();

  // Si ya tiene +, verificar si es +5980
  if (cleaned.startsWith("+5980")) {
    cleaned = "+598" + cleaned.slice(5);
  } else if (cleaned.startsWith("+")) {
    return cleaned;
  } else if (cleaned.startsWith("598")) {
    cleaned = "+598" + cleaned.slice(3).replace(/^0+/, "");
  } else if (cleaned.startsWith("00598")) {
    cleaned = "+598" + cleaned.slice(5).replace(/^0+/, "");
  } else if (cleaned.startsWith("09")) {
    cleaned = "+598" + cleaned.slice(1);
  } else if (/^9\d{7}$/.test(cleaned)) {
    cleaned = "+598" + cleaned;
  } else {
    cleaned = "+" + cleaned;
  }

  return cleaned;
}

/** 
 * Un número de celular uruguayo normalizado en formato internacional (+598 9X XXXXXX).
 * Retorna null si no es un número celular uruguayo válido.
 */
export function normalizeUruguayMobile(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (!input || /[^\d+\s().-]/.test(input) || (input.match(/\+/g) || []).length > 1 || (input.includes("+") && !input.startsWith("+"))) return null;

  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  let mobile: string;
  if (/^5989\d{7}$/.test(digits)) mobile = digits.slice(3);
  else if (/^59809\d{7}$/.test(digits)) mobile = digits.slice(4);
  else if (/^09\d{7}$/.test(digits)) mobile = digits.slice(1);
  else if (/^9\d{7}$/.test(digits)) mobile = digits;
  else return null;

  return `+598${mobile}`;
}

/**
 * Normaliza cualquier número de cliente soportado (Uruguay o Internacional E.164 con '+').
 */
export function normalizeCustomerPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (!input) return null;

  // 1. Probar como número uruguayo
  const uruguay = normalizeUruguayMobile(input);
  if (uruguay) return uruguay;

  // 2. Probar como número internacional estándar E.164 con '+'
  const cleaned = input.replace(/[\s().-]/g, "");
  if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
    return cleaned;
  }

  // 3. Si viene sin '+' pero coincide con códigos de área conocidos
  if (/^54\d{10,11}$/.test(cleaned)) return `+${cleaned}`; // Argentina
  if (/^55\d{10,11}$/.test(cleaned)) return `+${cleaned}`; // Brasil
  if (/^56\d{9}$/.test(cleaned)) return `+${cleaned}`;     // Chile
  if (/^1\d{10}$/.test(cleaned)) return `+${cleaned}`;      // USA

  return null;
}

/**
 * Genera todas las variantes textuales usuales con las que un número puede existir en la base de datos
 * (asegura encontrar clientes existentes guardados con 09..., 9..., +598... o 598...).
 */
export function getUruguayMobileVariants(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  const variants = new Set<string>();
  variants.add(trimmed);

  const cleaned = cleanUruguayPhone(trimmed);
  if (cleaned) {
    variants.add(cleaned);
  }

  const normalized = normalizeCustomerPhone(trimmed) || normalizeUruguayMobile(trimmed);
  if (normalized) {
    variants.add(normalized); // Ej: +59895063978
    const digitsOnly = normalized.replace(/\D/g, "");
    if (normalized.startsWith("+598")) {
      const local8 = digitsOnly.slice(3); // 95063978
      variants.add(`0${local8}`); // 095063978 (para retrocompatibilidad con registros antiguos)
      variants.add(local8); // 95063978
      variants.add(`+598${local8}`); // +59895063978
      variants.add(`598${local8}`); // 59895063978
    } else {
      variants.add(digitsOnly);
      variants.add(`+${digitsOnly}`);
    }
  }

  return Array.from(variants).filter(Boolean);
}

/** 
 * Busca clientes existentes en un comercio por celular.
 * Prioriza primero por la cantidad de sellos acumulados (current_stamps DESC)
 * y en caso de empate por la última actividad (updated_at DESC, created_at DESC).
 */
export async function findCustomersByMobile(supabase: any, businessId: string, searchPhone: string): Promise<any[]> {
  const variants = getUruguayMobileVariants(searchPhone);
  const normalizedTarget = normalizeCustomerPhone(searchPhone) || normalizeUruguayMobile(searchPhone) || cleanUruguayPhone(searchPhone);

  // 1. Consulta directa por variantes aprovechando índices
  const { data: directData, error: directError } = await supabase
    .from("customers")
    .select("id, unique_code, first_name, last_name, phone, birthdate, current_stamps, total_visits, created_at, updated_at")
    .eq("business_id", businessId)
    .in("phone", variants)
    .order("current_stamps", { ascending: false })
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!directError && Array.isArray(directData) && directData.length > 0) {
    return directData;
  }

  // 2. Fallback escaneando registros para detectar números guardados con espacios o formatos irregulares
  const pageSize = 500;
  const matches: any[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, unique_code, first_name, last_name, phone, birthdate, current_stamps, total_visits, created_at, updated_at")
      .eq("business_id", businessId)
      .order("current_stamps", { ascending: false })
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const customers = Array.isArray(data) ? data : [];
    for (const customer of customers) {
      const customerNorm = normalizeCustomerPhone(customer.phone) || normalizeUruguayMobile(customer.phone) || cleanUruguayPhone(customer.phone);
      if (customerNorm === normalizedTarget) {
        matches.push(customer);
      }
    }
    if (customers.length < pageSize) break;
  }

  // Ordenar los matches filtrados por sellos descendente y luego última actividad
  matches.sort((a, b) => {
    const stampsDiff = (b.current_stamps || 0) - (a.current_stamps || 0);
    if (stampsDiff !== 0) return stampsDiff;
    const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
    const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });

  return matches;
}
