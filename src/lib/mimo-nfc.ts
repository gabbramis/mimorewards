export const DEFAULT_BUSINESS_ID = "ea6ae0d6-c8db-4b15-a09d-9726f93b7119";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type NfcContext = {
  nfcId: string;
  businessId: string;
  businessName: string;
  businessLogo: string;
  rewardTarget: number;
  rewardDescription: string;
};

export async function resolveNfcContext(supabase: any, rawNfcId: string): Promise<NfcContext> {
  let nfcId = rawNfcId || "";
  try {
    nfcId = decodeURIComponent(nfcId);
  } catch {
    // Keep the raw token so a malformed URL can still show the fallback flow.
  }
  nfcId = nfcId.trim().toUpperCase();
  let businessId = UUID_PATTERN.test(nfcId)
    ? nfcId
    : process.env.MIMO_DEFAULT_BUSINESS_ID || DEFAULT_BUSINESS_ID;

  // The nfc_tags table is optional while the NFC inventory is being prepared.
  // When it exists, it takes precedence over the development fallback above.
  if (!UUID_PATTERN.test(nfcId) && process.env.MIMO_NFC_DIRECTORY_ENABLED === "true") {
    const { data: tag } = await supabase
      .from("nfc_tags")
      .select("business_id, active")
      .eq("nfc_id", nfcId)
      .maybeSingle();

    if (tag?.active !== false && tag?.business_id) {
      businessId = tag.business_id;
    }
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, logo_url, reward_target, reward_description")
    .eq("id", businessId)
    .maybeSingle();

  return {
    nfcId,
    businessId,
    businessName: business?.name || "El Gran Café",
    businessLogo: business?.logo_url || "",
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
