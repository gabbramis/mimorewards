import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { canAccessBusiness, getCurrentAccess } from "@/lib/authz";
import AdminShell from "@/app/admin/admin-shell";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const { data: business } = await supabase
    .from("businesses")
    .select("name, active")
    .eq("id", businessId)
    .maybeSingle();

  if (!business) redirect("/login");

  return (
    <AdminShell mode="merchant" businessId={businessId} businessName={business.name}>
      {children}
    </AdminShell>
  );
}
