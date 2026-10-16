import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import MerchantSettingsClient from "@/components/merchant/MerchantSettingsClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ businessId: string }>;
}

export default async function MerchantSettingsPage({ params }: PageProps) {
  const { businessId } = await params;
  const supabase: any = createAdminClient();

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, name, logo_url, primary_color, reward_target, reward_description, active")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching business for settings:", error);
  }

  if (!business) {
    notFound();
  }

  return (
    <MerchantSettingsClient
      businessId={business.id}
      initialBusiness={{
        name: business.name,
        logo_url: business.logo_url,
        primary_color: business.primary_color,
        reward_target: business.reward_target || 10,
        reward_description:
          business.reward_description ||
          "1 Café de especialidad + Alfajor artesanal",
        active: business.active,
      }}
    />
  );
}
