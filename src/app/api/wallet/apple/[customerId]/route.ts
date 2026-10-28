import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { customerCookieName, readCustomerSession } from "@/lib/mimo-customer-session";
import { appleWalletConfigured, createAppleWalletPass, storedImage } from "@/lib/wallet/appleWallet";
import { readWalletLocations } from '@/lib/wallet/location-store';
import { resolveAppleWebServiceURL } from '@/lib/wallet/apple-web-service';

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await params;
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(customerId)) {
    return NextResponse.json({ error: "Tarjeta no encontrada." }, { status: 404 });
  }

  if (!appleWalletConfigured()) {
    return NextResponse.json({ error: "Apple Wallet todavía no está configurado." }, { status: 503 });
  }

  try {
    const supabase: any = createAdminClient();
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, business_id, first_name, last_name, unique_code, current_stamps, wallet_platform")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError) throw customerError;
    if (!customer) return NextResponse.json({ error: "Tarjeta no encontrada." }, { status: 404 });

    const cookieStore = await cookies();
    const sessionCustomerId = readCustomerSession(cookieStore.get(customerCookieName(customer.business_id))?.value);
    if (sessionCustomerId !== customer.id) {
      return NextResponse.json({ error: "Abrí primero tu tarjeta en este celular." }, { status: 403 });
    }

    const [{ data: business, error: businessError }, { data: card, error: cardError }] = await Promise.all([
      supabase.from("businesses")
        .select("id, name, logo_url, reward_target, reward_description, primary_color, card_text_color, card_accent_color, stamp_completed_url, stamp_pending_url, active, active_campaign_message, wallet_config")
        .eq("id", customer.business_id)
        .maybeSingle(),
      supabase.from("loyalty_cards")
        .select("id, wallet_platform")
        .eq("customer_id", customer.id)
        .eq("business_id", customer.business_id)
        .maybeSingle(),
    ]);

    if (businessError) throw businessError;
    if (cardError) throw cardError;
    if (!business || !card || business.active === false) {
      return NextResponse.json({ error: "Esta tarjeta no está disponible." }, { status: 404 });
    }

    // Actualizar wallet_platform en segundo plano
    Promise.all([
      supabase.from("customers").update({
        wallet_platform: customer.wallet_platform === "GOOGLE" ? "BOTH" : "APPLE",
      }).eq("id", customer.id),
      supabase.from("loyalty_cards").update({
        wallet_platform: card.wallet_platform === "GOOGLE" ? "BOTH" : "APPLE",
        wallet_status: "ACTIVE",
      }).eq("id", card.id),
    ]).catch((err) => console.warn("[Apple Wallet] Error actualizando wallet_platform:", err));

    const [logoImage, completedStampImage, pendingStampImage] = await Promise.all([
      storedImage(supabase, business.logo_url),
      storedImage(supabase, business.stamp_completed_url),
      storedImage(supabase, business.stamp_pending_url),
    ]);

    const pass = await createAppleWalletPass({
      webServiceURL: resolveAppleWebServiceURL(request.url, process.env.APPLE_WALLET_WEB_SERVICE_URL),
      locations: await readWalletLocations(customer.business_id),
      id: card.id,
      customerName: `${customer.first_name} ${customer.last_name || ""}`.trim(),
      customerCode: customer.unique_code,
      businessName: business.name,
      currentStamps: customer.current_stamps || 0,
      targetStamps: business.reward_target || 10,
      rewardDescription: business.reward_description || "Tu próxima recompensa",
      primaryColor: business.primary_color,
      textColor: business.card_text_color,
      accentColor: business.card_accent_color,
      logoImage,
      completedStampImage,
      pendingStampImage,
      activeCampaignMessage: business.active_campaign_message,
      wallet: business.wallet_config,
    });

    return new Response(new Uint8Array(pass), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": 'attachment; filename="mimo-rewards.pkpass"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Apple Wallet pass generation failed:", error);
    return NextResponse.json({ error: "No pudimos generar la tarjeta de Apple Wallet." }, { status: 500 });
  }
}
