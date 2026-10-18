import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessBusiness } from "@/lib/authz";
import { broadcastWalletCampaign, cancelActiveCampaign } from "@/lib/wallet-notifications";

export const runtime = "nodejs";

function getNextSundayEnd(): string {
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday
  const daysUntilSunday = (7 - day) % 7;
  const sunday = new Date(now.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000);
  sunday.setHours(23, 59, 59, 999);
  return sunday.toISOString();
}

function getFourHoursLater(): string {
  return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    if (!(await canAccessBusiness(businessId))) {
      return NextResponse.json({ error: "No tenés permiso para este comercio." }, { status: 403 });
    }

    const supabase: any = createAdminClient();

    // 1. Obtener datos de la campaña actual en el comercio
    const { data: business, error: bErr } = await supabase
      .from("businesses")
      .select("id, name, stamp_multiplier, active_campaign_name, active_campaign_message, campaign_expires_at, google_wallet_class_id")
      .eq("id", businessId)
      .maybeSingle();

    if (bErr || !business) {
      return NextResponse.json({ error: "Comercio no encontrado." }, { status: 404 });
    }

    const isCampaignActive = Boolean(
      business.campaign_expires_at &&
      new Date(business.campaign_expires_at) > new Date() &&
      business.active_campaign_name
    );

    // 2. Métricas de audiencia (pases en Apple Wallet y Google Wallet)
    const [
      { count: appleCount },
      { count: googleCount },
      { count: totalCustomers },
      { data: history },
    ] = await Promise.all([
      supabase
        .from("wallet_registrations")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .or("wallet_platform.eq.GOOGLE,wallet_platform.eq.BOTH,google_wallet_object_id.not.is.null"),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId),
      supabase
        .from("push_campaigns_log")
        .select("id, campaign_type, message, apple_devices_notified, google_passes_notified, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    return NextResponse.json({
      business: {
        id: business.id,
        name: business.name,
        stampMultiplier: isCampaignActive ? (business.stamp_multiplier || 1) : 1,
        activeCampaignName: isCampaignActive ? business.active_campaign_name : null,
        activeCampaignMessage: isCampaignActive ? business.active_campaign_message : null,
        campaignExpiresAt: isCampaignActive ? business.campaign_expires_at : null,
        isCampaignActive,
      },
      audience: {
        appleDevices: appleCount || 0,
        googlePasses: googleCount || 0,
        totalCustomers: totalCustomers || 0,
      },
      history: history || [],
    });
  } catch (error: any) {
    console.error("Error fetching campaigns state:", error);
    return NextResponse.json({ error: "Error obteniendo datos de campañas." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    if (!(await canAccessBusiness(businessId))) {
      return NextResponse.json({ error: "No tenés permiso para este comercio." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const type = String(body.campaignType || "CUSTOM").toUpperCase();

    const supabase: any = createAdminClient();
    const { data: business } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .maybeSingle();

    if (!business) {
      return NextResponse.json({ error: "Comercio no encontrado." }, { status: 404 });
    }

    let campaignName = String(body.campaignName || "").trim();
    let message = String(body.message || "").trim();
    let stampMultiplier = 1;
    let expiresAt: string | null = null;

    if (type === "2X_WEEKEND" || type === "FINDE_2X1") {
      campaignName = campaignName || "Finde 2x1 en Sellos";
      stampMultiplier = 2;
      expiresAt = getNextSundayEnd();
      message = message || `¡Finde 2x1 en ${business.name}! Todas tus visitas de este fin de semana suman doble sello.`;
    } else if (type === "HAPPY_HOUR") {
      campaignName = campaignName || "Happy Hour de Sellos (4 horas)";
      stampMultiplier = 2;
      expiresAt = getFourHoursLater();
      message = message || `¡Happy Hour en ${business.name}! Pasate en las próximas 4 horas y sumá doble sello.`;
    } else if (type === "QUICK_PROMO" || type === "AVISO_RAPIDO") {
      campaignName = campaignName || "Aviso / Promo Rápida";
      stampMultiplier = 1;
      // Expira en 24 horas para que el mensaje no quede permanente en pass.json
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      if (!message) {
        return NextResponse.json({ error: "Debes escribir o seleccionar un mensaje para la notificación." }, { status: 400 });
      }
    } else {
      campaignName = campaignName || "Promoción Especial";
      stampMultiplier = Number(body.stampMultiplier || 1);
      expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;
      if (!message) {
        return NextResponse.json({ error: "Falta el mensaje de la notificación push." }, { status: 400 });
      }
    }

    const result = await broadcastWalletCampaign({
      businessId,
      campaignName,
      campaignType: type,
      message,
      stampMultiplier,
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      result,
      message: "Campaña activada y notificación push enviada a Apple Wallet y Google Wallet.",
    });
  } catch (error: any) {
    console.error("Error activating campaign:", error);
    return NextResponse.json({ error: error?.message || "No se pudo activar la campaña." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    if (!(await canAccessBusiness(businessId))) {
      return NextResponse.json({ error: "No tenés permiso para este comercio." }, { status: 403 });
    }

    await cancelActiveCampaign(businessId);

    return NextResponse.json({
      success: true,
      message: "Campaña finalizada correctamente. El multiplicador regresó a 1.",
    });
  } catch (error: any) {
    console.error("Error canceling campaign:", error);
    return NextResponse.json({ error: error?.message || "No se pudo finalizar la campaña." }, { status: 500 });
  }
}
