import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { canAccessBusiness, getCurrentAccess } from "@/lib/authz";
import MerchantShell from "@/components/merchant/MerchantShell";
import { createAdminClient } from "@/lib/supabase/admin";
import { BusinessProvider } from "@/contexts/BusinessContext";

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
    .select("id, name, active, logo_url, primary_color, slug")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    console.error("Layout Supabase Error:", error.message || error);
  }

  if (!business) redirect("/login");

  return (
    <BusinessProvider
      initialName={business.name}
      initialLogo={business.logo_url}
      initialPrimaryColor={business.primary_color || null}
    >
      <MerchantShell
        businessId={business.id}
        businessName={business.name}
        businessSlug={business.slug}
        businessLogo={business.logo_url}
        isActive={business.active}
      >
        {children}
      </MerchantShell>
    </BusinessProvider>
  );
}
