/** A Uruguayan mobile number in one stable format, regardless of how it was entered. */
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

/** Genera todas las variantes textuales usuales con las que un número puede existir en la base de datos */
export function getUruguayMobileVariants(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  const variants = new Set<string>();
  variants.add(trimmed);

  const normalized = normalizeUruguayMobile(trimmed);
  if (normalized) {
    variants.add(normalized); // Ej: +59895063978
    const digitsOnly = normalized.replace(/\D/g, ""); // 59895063978
    const local8 = digitsOnly.slice(3); // 95063978
    variants.add(`0${local8}`); // 095063978
    variants.add(local8); // 95063978
    variants.add(digitsOnly); // 59895063978
  }

  return Array.from(variants).filter(Boolean);
}

/** 
 * Busca clientes existentes en un comercio por celular.
 * Prioriza primero por la cantidad de sellos acumulados (current_stamps DESC)
 * y en caso de empate por la última actividad (updated_at DESC, created_at DESC).
 */
export async function findCustomersByMobile(supabase: any, businessId: string, normalizedPhone: string): Promise<any[]> {
  const variants = getUruguayMobileVariants(normalizedPhone);

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
      if (normalizeUruguayMobile(customer.phone) === normalizedPhone) {
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
