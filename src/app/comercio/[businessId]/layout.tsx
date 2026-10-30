import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { canAccessBusiness, getCurrentAccess } from "@/lib/authz";
import MerchantShell from "@/components/merchant/MerchantShell";
import { createAdminClient } from "@/lib/supabase/admin";
import { BusinessProvider } from "@/contexts/BusinessContext";
import { getWalletLocationAccess } from "@/lib/wallet/location-store";

export default async function MerchantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const access = await getCurrentAccess();

  if (!access.user) redirect("/login");
  if (!(await canAccessBusiness(businessId))) redirect("/login");

  const supabase: any = createAdminClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, name, active, logo_url, primary_color, slug, plan_type")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    console.error("Layout Supabase Error:", error.message || error);
  }

  if (!business) redirect("/login");
  const locationAccess = await getWalletLocationAccess(businessId);
  const { data: pilot } = locationAccess.allowed
    ? await supabase.from("businesses").select("wallet_locations_enabled").eq("id", businessId).maybeSingle()
    : { data: null };

  const cookieStore = await cookies();
  const impersonatedBusinessId = cookieStore.get("mimo_impersonated_business_id")?.value;
  const isImpersonating = Boolean(impersonatedBusinessId);

  return (
    <BusinessProvider
      initialName={business.name}
      initialLogo={business.logo_url}
      initialPrimaryColor={business.primary_color || null}
      initialPlanType={business.plan_type}
    >
      <MerchantShell
        businessId={business.id}
        businessName={business.name}
        businessSlug={business.slug}
        businessLogo={business.logo_url}
        isActive={business.active}
        planType={business.plan_type}
        isImpersonating={isImpersonating}
        showCommunications={
          locationAccess.allowed && (locationAccess.superadmin || pilot?.wallet_locations_enabled === true)
        }
      >
        {children}
      </MerchantShell>
    </BusinessProvider>
  );
}
