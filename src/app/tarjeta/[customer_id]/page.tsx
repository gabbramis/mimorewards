import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { appleWalletConfigured } from "@/lib/wallet/appleWallet";
import { toCustomerView, type NfcContext } from "@/lib/mimo-nfc";
import CustomerExperience from "@/components/customer/CustomerExperience";

export const runtime = "nodejs";

export default async function TarjetaPage(props: {
  params: Promise<{ customer_id: string }> | { customer_id: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const resolvedParams = await Promise.resolve(props.params);
  const resolvedSearchParams = await Promise.resolve(props.searchParams || {});

  const customerIdParam = decodeURIComponent(resolvedParams?.customer_id || "").trim();
  const stampStatus = typeof resolvedSearchParams?.stamp === "string" ? resolvedSearchParams.stamp : null;

  if (!customerIdParam) {
    notFound();
  }

  const supabase: any = createAdminClient();

  // 1. Buscar cliente admitiendo tanto UUID (id) como código único (unique_code)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerIdParam);

  let query = supabase.from("customers").select("*");
  if (isUUID) {
    query = query.eq("id", customerIdParam);
  } else {
    query = query.eq("unique_code", customerIdParam);
  }

  const { data: customer, error: customerError } = await query.maybeSingle();

  if (customerError || !customer) {
    notFound();
  }

  // 2. Obtener el comercio asociado de forma directa y robusta
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", customer.business_id)
    .maybeSingle();

  if (businessError || !business) {
    notFound();
  }

  const context: NfcContext = {
    nfcId: "",
    businessId: business.id,
    businessName: business.name,
    businessLogo: business.logo_url || "",
    active: business.active !== false,
    rewardTarget: business.reward_target || 10,
    rewardDescription: business.reward_description || "Tu próxima recompensa",
    primaryColor: business.primary_color || "#FF1F2D",
    textColor: business.card_text_color || "#FFFFFF",
    accentColor: business.card_accent_color || "#FFFFFF",
    stampCompletedUrl: business.stamp_completed_url || "",
    stampPendingUrl: business.stamp_pending_url || "",
  };

  // Generación opcional de enlace a Google Wallet
  let googleWalletUrl: string | undefined = undefined;
  try {
    const { generateSavePassUrl, createOrUpdateLoyaltyClass } = await import("@/lib/wallet/googleWallet");

    await createOrUpdateLoyaltyClass(
      customer.business_id,
      business.name,
      context.primaryColor,
      business.logo_url
    );

    googleWalletUrl = generateSavePassUrl(
      customer.id,
      `${customer.first_name} ${customer.last_name || ""}`.trim(),
      customer.current_stamps || 0,
      business.reward_target || 10,
      business.id
    );
  } catch (err) {
    console.warn("No se pudo pregenerar enlace de Google Wallet:", err);
  }

  return (
    <CustomerExperience
      initialCustomer={toCustomerView(customer, context)}
      initialContext={context}
      stampStatus={stampStatus}
      googleWalletUrl={googleWalletUrl}
      appleWalletReady={appleWalletConfigured()}
    />
  );
}
