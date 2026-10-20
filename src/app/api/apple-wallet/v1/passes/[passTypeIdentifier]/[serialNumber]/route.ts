import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  appleWalletConfigured,
  createAppleWalletPass,
  storedImage,
  verifyPassAuthToken,
} from "@/lib/wallet/appleWallet";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      passTypeIdentifier: string;
      serialNumber: string;
    }>;
  },
) {
  try {
    const { passTypeIdentifier, serialNumber } = await params;

    // 1. Validar cabecera Authorization: ApplePass <token>
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("ApplePass ")) {
      return new Response(null, { status: 401 });
    }

    const token = authHeader.replace(/^ApplePass\s+/, "").trim();
    if (!verifyPassAuthToken(serialNumber, token)) {
      console.warn(`[Apple Wallet] Invalid auth token for pass serial: ${serialNumber}`);
      return new Response(null, { status: 401 });
    }

    if (!appleWalletConfigured()) {
      console.error("[Apple Wallet] Certificates not configured.");
      return new Response(null, { status: 503 });
    }

    const supabase: any = createAdminClient();

    // 2. Obtener la tarjeta de fidelización (serialNumber = loyalty_cards.id)
    const { data: card, error: cardError } = await supabase
      .from("loyalty_cards")
      .select("id, customer_id, business_id, current_stamps, updated_at, created_at")
      .eq("id", serialNumber)
      .maybeSingle();

    if (cardError) {
      console.error("[Apple Wallet] Error fetching loyalty card:", cardError);
      return new Response(null, { status: 500 });
    }

    if (!card) {
      return new Response(null, { status: 404 });
    }

    // 3. Manejo de cabecera If-Modified-Since
    const ifModifiedSince = request.headers.get("if-modified-since") || request.headers.get("If-Modified-Since");
    const lastModifiedDate = new Date((card as any).updated_at || (card as any).created_at || Date.now());

    if (ifModifiedSince) {
      const ifModifiedDate = new Date(ifModifiedSince);
      if (!isNaN(ifModifiedDate.getTime())) {
        const ifModifiedSeconds = Math.floor(ifModifiedDate.getTime() / 1000);
        const lastModifiedSeconds = Math.floor(lastModifiedDate.getTime() / 1000);

        if (lastModifiedSeconds <= ifModifiedSeconds) {
          return new Response(null, { status: 304 });
        }
      }
    }

    // 4. Obtener datos de cliente y negocio (incluyendo active_campaign_message)
    const [{ data: customer, error: customerError }, { data: business, error: businessError }] = await Promise.all([
      supabase
        .from("customers")
        .select("id, first_name, last_name, unique_code, current_stamps")
        .eq("id", card.customer_id)
        .eq("business_id", card.business_id)
        .maybeSingle(),
      supabase
        .from("businesses")
        .select("id, name, logo_url, reward_target, reward_description, primary_color, card_text_color, card_accent_color, stamp_completed_url, stamp_pending_url, active, active_campaign_message, wallet_config")
        .eq("id", card.business_id)
        .maybeSingle(),
    ]);

    if (customerError || businessError) {
      console.error("[Apple Wallet] Error fetching customer or business:", { customerError, businessError });
      return new Response(null, { status: 500 });
    }

    if (!customer || !business || business.active === false) {
      return new Response(null, { status: 404 });
    }

    // 5. Descargar imágenes de marca si están configuradas
    const [logoImage, completedStampImage, pendingStampImage] = await Promise.all([
      storedImage(supabase, business.logo_url),
      storedImage(supabase, business.stamp_completed_url),
      storedImage(supabase, business.stamp_pending_url),
    ]);

    const currentStamps = customer.current_stamps ?? card.current_stamps ?? 0;

    // 6. Generar el pase .pkpass actualizado con activeCampaignMessage
    const passBuffer = await createAppleWalletPass({
      id: card.id,
      customerName: `${customer.first_name} ${customer.last_name || ""}`.trim(),
      customerCode: customer.unique_code,
      businessName: business.name,
      currentStamps,
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

    return new Response(new Uint8Array(passBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Last-Modified": lastModifiedDate.toUTCString(),
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    console.error("[Apple Wallet] Error generating updated pass:", error);
    return new Response(null, { status: 500 });
  }
}
