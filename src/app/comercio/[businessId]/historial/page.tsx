import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import MerchantHistoryClient, {
  type LogItem,
} from "@/components/merchant/MerchantHistoryClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ businessId: string }>;
}

export default async function MerchantHistoryPage({ params }: PageProps) {
  const { businessId } = await params;
  const supabase: any = createAdminClient();

  const [
    { data: business },
    { data: logsData, error: logsError },
    { data: allStampsData },
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name, reward_description, created_at")
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("stamp_logs")
      .select(`
        id,
        created_at,
        method,
        metadata,
        customer_id,
        customers (
          first_name,
          last_name,
          phone,
          unique_code
        )
      `)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("stamp_logs")
      .select("created_at")
      .eq("business_id", businessId)
      .neq("method", "REDEEM"),
  ]);

  if (!business) {
    notFound();
  }

  if (logsError) {
    console.error("Error fetching stamp logs:", logsError);
  }

  const logs: LogItem[] = (logsData || []).map((l: any) => {
    const customer = l.customers;
    const name = customer
      ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
        customer.phone ||
        "Cliente"
      : "Cliente";

    return {
      id: l.id,
      created_at: l.created_at,
      method: l.method || "MANUAL",
      customer_id: l.customer_id,
      metadata: l.metadata,
      customer_name: name,
      customer_phone: customer?.phone || null,
      customer_code: customer?.unique_code || null,
    };
  });

  return (
    <MerchantHistoryClient
      businessId={businessId}
      businessName={business.name}
      rewardDescription={
        business.reward_description || "Café o recompensa disponible"
      }
      initialLogs={logs}
      businessCreatedAt={business.created_at}
      allStampDates={(allStampsData || []).map((s: any) => s.created_at)}
    />
  );
}
