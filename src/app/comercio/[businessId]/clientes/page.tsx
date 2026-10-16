import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import MerchantCustomersClient, {
  type CustomerItem,
} from "@/components/merchant/MerchantCustomersClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ businessId: string }>;
}

export default async function MerchantCustomersPage({ params }: PageProps) {
  const { businessId } = await params;
  const supabase: any = createAdminClient();

  const [
    { data: business },
    { data: customersData, error: customersError },
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name, reward_target, reward_description")
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("customers")
      .select(
        "id, unique_code, first_name, last_name, phone, current_stamps, total_visits, last_visit_at, created_at"
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
  ]);

  if (!business) {
    notFound();
  }

  if (customersError) {
    console.error("Error fetching customers:", customersError);
  }

  const customers: CustomerItem[] = (customersData || []).map((c: any) => ({
    id: c.id,
    unique_code: c.unique_code || "",
    first_name: c.first_name || null,
    last_name: c.last_name || null,
    phone: c.phone || null,
    current_stamps: c.current_stamps || 0,
    total_visits: c.total_visits || 1,
    last_visit_at: c.last_visit_at || null,
    created_at: c.created_at,
  }));

  return (
    <MerchantCustomersClient
      businessId={businessId}
      initialCustomers={customers}
      rewardTarget={business.reward_target || 10}
      rewardDescription={
        business.reward_description || "Café o recompensa disponible"
      }
    />
  );
}
