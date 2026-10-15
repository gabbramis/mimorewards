export type NfcContext = {
  nfcId: string;
  businessId: string;
  businessName: string;
  businessLogo: string;
  active: boolean;
  rewardTarget: number;
  rewardDescription: string;
  primaryColor: string;
  textColor: string;
  accentColor: string;
  stampCompletedUrl: string;
  stampPendingUrl: string;
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

  // Fallback: si el parámetro recibido es el slug del comercio en lugar del nfc_id directo
  for (const candidate of candidates) {
    const { data: biz } = await supabase
      .from("businesses")
      .select("id")
      .or(`slug.eq.${candidate},slug.ilike.${candidate}`)
      .maybeSingle();
    if (biz) {
      const { data: tag } = await supabase
        .from("nfc_tags")
        .select("nfc_id, business_id, active")
        .eq("business_id", biz.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (tag) return tag;
    }
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
      primaryColor: "#FF1F2D",
      textColor: "#FFFFFF",
      accentColor: "#FFFFFF",
      stampCompletedUrl: "",
      stampPendingUrl: "",
    };
  }

  let { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name, logo_url, reward_target, reward_description, active, primary_color, card_text_color, card_accent_color, stamp_completed_url, stamp_pending_url")
    .eq("id", businessId)
    .maybeSingle();
  if (businessError) {
    const fallback = await supabase.from("businesses")
      .select("id, name, logo_url, reward_target, reward_description, active")
      .eq("id", businessId).maybeSingle();
    business = fallback.data;
    businessError = fallback.error;
  }

  return {
    nfcId,
    businessId,
    businessName: business?.name || nfcId || "Tu negocio",
    businessLogo: business?.logo_url || "",
    active: Boolean(business) && !businessError && tagActive && business?.active !== false,
    rewardTarget: business?.reward_target || 10,
    rewardDescription: business?.reward_description || "Un café gratis",
    primaryColor: business?.primary_color || "#FF1F2D",
    textColor: business?.card_text_color || "#FFFFFF",
    accentColor: business?.card_accent_color || "#FFFFFF",
    stampCompletedUrl: business?.stamp_completed_url || "",
    stampPendingUrl: business?.stamp_pending_url || "",
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
