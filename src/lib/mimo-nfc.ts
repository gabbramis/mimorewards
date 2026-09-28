export type NfcContext = {
  nfcId: string;
  businessId: string;
  businessName: string;
  businessLogo: string;
  active: boolean;
  rewardTarget: number;
  rewardDescription: string;
};

export async function findNfcTag(supabase: any, rawNfcId: string) {
  const value = rawNfcId.trim();
  const candidates = Array.from(new Set([value, value.toLowerCase(), value.toUpperCase()]));

  for (const candidate of candidates) {
    const { data: tag } = await supabase
      .from("nfc_tags")
      .select("nfc_id, business_id, active")
      .eq("nfc_id", candidate)
      .maybeSingle();
    if (tag) return tag;
  }

  return null;
}

export async function resolveNfcContext(supabase: any, rawNfcId: string): Promise<NfcContext> {
  let nfcId = rawNfcId || "";
  try {
    nfcId = decodeURIComponent(nfcId);
  } catch {
    // Keep the raw token so a malformed URL can still show the fallback flow.
  }
  nfcId = nfcId.trim();

  // Every public /t/:nfcId URL must correspond to a provisioned tag. A
  // business UUID or slug by itself is never enough to open registration.
  const tag = await findNfcTag(supabase, nfcId);

  const businessId = tag?.business_id || "";
  const tagActive = tag?.active !== false;

  if (!businessId) {
    return {
      nfcId,
      businessId: "",
      businessName: "",
      businessLogo: "",
      active: false,
      rewardTarget: 10,
      rewardDescription: "",
    };
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, logo_url, reward_target, reward_description")
    .eq("id", businessId)
    .maybeSingle();

  return {
    nfcId,
    businessId,
    businessName: business?.name || nfcId || "Tu negocio",
    businessLogo: business?.logo_url || "",
    active: Boolean(business) && tagActive && business?.active !== false,
    rewardTarget: business?.reward_target || 10,
    rewardDescription: business?.reward_description || "Un café gratis",
  };
}

export function toCustomerView(customer: any, context: NfcContext) {
  if (!customer) return null;

  return {
    id: customer.id,
    firstName: customer.first_name,
    lastName: customer.last_name,
    phone: customer.phone,
    birthdate: customer.birthdate,
    uniqueCode: customer.unique_code,
    currentStamps: customer.current_stamps || 0,
    totalVisits: customer.total_visits || 0,
    targetStamps: context.rewardTarget,
    businessId: context.businessId,
    businessName: context.businessName,
    businessLogo: context.businessLogo,
    rewardDescription: context.rewardDescription,
  };
}
