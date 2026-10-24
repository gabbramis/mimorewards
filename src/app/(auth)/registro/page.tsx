import { createAdminClient } from "@/lib/supabase/admin";
import CustomerExperience from "@/components/customer/CustomerExperience";
import type { NfcContext } from "@/lib/mimo-nfc";

export const dynamic = "force-dynamic";

interface RegistroPageProps {
  searchParams: Promise<{ businessId?: string; nfcId?: string }>;
}

export default async function CustomerRegisterPage({ searchParams }: RegistroPageProps) {
  const { businessId, nfcId } = await searchParams;
  const supabase: any = createAdminClient();

  let business: any = null;
  if (businessId) {
    const { data } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();
    business = data;
  }

  if (!business) {
    const { data } = await supabase
      .from("businesses")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    business = data;
  }

  const initialContext: NfcContext = business
    ? {
        nfcId: nfcId || "",
        businessId: business.id,
        businessName: business.name,
        businessLogo: business.logo_url || "",
        active: business.active !== false,
        rewardTarget: business.reward_target || 10,
        rewardDescription: business.reward_description || "Café o recompensa disponible",
        primaryColor: business.primary_color || "#FF1F2D",
        accentColor: business.accent_color || "#FFFFFF",
        textColor: business.text_color || "#FFFFFF",
        stampPendingUrl: business.stamp_pending_url || "",
        stampCompletedUrl: business.stamp_completed_url || "",
      }
    : {
        nfcId: nfcId || "",
        businessId: "demo",
        businessName: "mimo rewards",
        businessLogo: "/images/mimo-logo.png",
        active: true,
        rewardTarget: 10,
        rewardDescription: "Tu próxima recompensa",
        primaryColor: "#FF1F2D",
        accentColor: "#FFFFFF",
        textColor: "#FFFFFF",
        stampPendingUrl: "",
        stampCompletedUrl: "",
      };

  return <CustomerExperience nfcId={nfcId || ""} initialContext={initialContext} />;
}
