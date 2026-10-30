import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculatePushQuota } from "@/lib/push-quota";
import MerchantAutomationsClient, {
  type BusinessData,
  type AudienceData,
  type AutomationsState,
  type CampaignLogItem,
} from "@/components/merchant/MerchantAutomationsClient";
import PlanLockedScreen from "@/components/merchant/PlanLockedScreen";

export default async function Page({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const supabase: any = createAdminClient();

  const [
    { data: business, error: bError },
    { count: appleCount },
    { count: googleCount },
    { count: totalCustomers },
    { data: automationsRows, error: autoError },
    { data: historyData, error: historyError },
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select(
        "id, name, plan_type, stamp_multiplier, active_campaign_name, active_campaign_message, campaign_expires_at, google_wallet_class_id"
      )
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("wallet_registrations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .or("wallet_platform.eq.GOOGLE,wallet_platform.eq.BOTH,google_wallet_object_id.not.is.null"),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("automations")
      .select("id, type, enabled, channel, trigger_config, message_template, updated_at")
      .eq("business_id", businessId),
    supabase
      .from("push_campaigns_log")
      .select("id, campaign_type, message, apple_devices_notified, google_passes_notified, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (bError || !business) {
    notFound();
  }

  const planType = (business.plan_type ?? "inicial").toLowerCase();
  if (planType !== "black" && planType !== "premium") {
    return (
      <PlanLockedScreen
        title="⭐ Exclusivo Plan Premium"
        message="⭐ Exclusivo Plan Premium: Habilitá notificaciones Push y reseñas automáticas"
      />
    );
  }

  if (autoError) {
    console.error("Error fetching automations in page:", autoError);
  }

  if (historyError) {
    console.error("Error fetching push campaigns history:", historyError);
  }

  const isCampaignActive = Boolean(
    business.campaign_expires_at &&
    new Date(business.campaign_expires_at) > new Date() &&
    business.active_campaign_name
  );

  const businessData: BusinessData = {
    id: business.id,
    name: business.name,
    stampMultiplier: isCampaignActive ? (business.stamp_multiplier || 1) : 1,
    activeCampaignName: isCampaignActive ? business.active_campaign_name : null,
    activeCampaignMessage: isCampaignActive ? business.active_campaign_message : null,
    campaignExpiresAt: isCampaignActive ? business.campaign_expires_at : null,
    isCampaignActive,
  };

  const audienceData: AudienceData = {
    appleDevices: appleCount || 0,
    googlePasses: googleCount || 0,
    totalCustomers: totalCustomers || 0,
  };

  const automationsState: AutomationsState = {
    inactive_customer: false,
    near_reward: false,
  };

  (automationsRows || []).forEach((row: any) => {
    if (row.type === "inactive_customer") {
      automationsState.inactive_customer = Boolean(row.enabled);
    } else if (row.type === "near_reward") {
      automationsState.near_reward = Boolean(row.enabled);
    }
  });

  const history: CampaignLogItem[] = (historyData || []).map((h: any) => ({
    id: h.id,
    campaign_type: h.campaign_type || "PROMO",
    message: h.message || "",
    apple_devices_notified: h.apple_devices_notified || 0,
    google_passes_notified: h.google_passes_notified || 0,
    created_at: h.created_at,
  }));

  const quota = calculatePushQuota(history);

  return (
    <MerchantAutomationsClient
      businessId={businessId}
      businessName={business.name}
      initialBusiness={businessData}
      initialAudience={audienceData}
      initialAutomations={automationsState}
      initialQuota={quota}
      initialHistory={history}
    />
  );
}
