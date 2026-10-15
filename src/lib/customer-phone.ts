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

/** Search existing customers without requiring a database migration. */
export async function findCustomersByMobile(supabase: any, businessId: string, normalizedPhone: string): Promise<any[]> {
  const pageSize = 500;
  const matches: any[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, unique_code, first_name, last_name, phone, birthdate, current_stamps, total_visits")
      .eq("business_id", businessId)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const customers = Array.isArray(data) ? data : [];
    for (const customer of customers) {
      if (normalizeUruguayMobile(customer.phone) === normalizedPhone) matches.push(customer);
      if (matches.length > 1) return matches;
    }
    if (customers.length < pageSize) return matches;
  }
}
