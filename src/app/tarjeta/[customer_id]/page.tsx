import { notFound } from "next/navigation";
import Link from "next/link";
import { Heart } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { appleWalletConfigured } from "@/lib/wallet/appleWallet";
import MobileCard from "./MobileCard";

export const runtime = "nodejs";

function stampNotice(status: string | null): string | null {
  if (status === "success") return "¡Sello sumado! Gracias por volver.";
  if (status === "cooldown") return "Ya registraste tu visita recientemente.";
  if (status === "reward_pending") return "Tu recompensa ya está disponible para canjear.";
  if (status === "program_inactive") return "Este programa está pausado por ahora.";
  if (status === "error") return "No pudimos registrar la visita. Probá de nuevo en un momento.";
  return null;
}

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

  // Vincular relación en el objeto del cliente
  customer.businesses = business;

  // 3. Manejo de pantalla especial de cooldown (tiempo de espera entre sellos)
  if (stampStatus === "cooldown") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FBECE0] p-4 text-[#1F1F1F]">
        <div className="flex w-full max-w-sm flex-col items-center rounded-3xl bg-white p-8 text-center shadow-lg shadow-black/[0.04] ring-2 ring-[#FF1F2D] ring-offset-4 ring-offset-[#FBECE0]">
          <div className="mb-6 mt-2 rounded-full bg-[#FFF6EE] p-4">
            <Heart className="h-8 w-8 text-[#FF1F2D]" fill="currentColor" />
          </div>
          <h1 className="mb-4 text-2xl font-bold tracking-tight">
            ¡Qué lindo verte de nuevo en {business.name}!
          </h1>
          <p className="mb-8 font-medium leading-relaxed text-[#1F1F1F] opacity-90">
            Tu visita de hoy ya fue registrada con éxito. Para cuidar tus sellos, hay un tiempo de espera de 3 horas entre cada visita. ¡Te esperamos pronto!
          </p>
          <Link
            href={`/tarjeta/${customer.id}`}
            className="block w-full rounded-2xl bg-[#FF1F2D] px-6 py-4 font-bold text-white shadow-sm transition-colors hover:bg-[#E01724]"
          >
            Ver mi tarjeta actual
          </Link>
        </div>
      </main>
    );
  }

  // 4. Generación opcional de enlace a Google Wallet
  let googleWalletUrl: string | undefined = undefined;
  try {
    const { generateSavePassUrl, createOrUpdateLoyaltyClass } = await import("@/lib/wallet/googleWallet");

    await createOrUpdateLoyaltyClass(
      customer.business_id,
      business.name,
      "#10B981",
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

  // 5. Renderizar el componente cliente MobileCard
  return (
    <MobileCard
      initialCustomer={customer}
      business={business}
      notice={stampNotice(stampStatus)}
      googleWalletUrl={googleWalletUrl}
      appleWalletReady={appleWalletConfigured()}
    />
  );
}
