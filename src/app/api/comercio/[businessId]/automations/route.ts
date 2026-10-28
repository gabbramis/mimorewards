import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessBusiness } from "@/lib/authz";
import { cancelActiveCampaign } from "@/lib/wallet-notifications";
import { calculatePushQuota } from "@/lib/push-quota";

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

    // 1. Obtener datos del comercio
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

    // 2. Métricas de audiencia, automatizaciones e historial
    const [
      { count: appleCount },
      { count: googleCount },
      { count: totalCustomers },
      { data: automationsRows },
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
        .from("automations")
        .select("id, type, enabled, channel, trigger_config, message_template, updated_at")
        .eq("business_id", businessId),
      supabase
        .from("push_campaigns_log")
        .select("id, campaign_type, message, apple_devices_notified, google_passes_notified, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const automationsMap: Record<string, boolean> = {
      inactive_customer: false,
      near_reward: false,
    };

    (automationsRows || []).forEach((row: any) => {
      if (row.type in automationsMap) {
        automationsMap[row.type] = Boolean(row.enabled);
      }
    });

    const quota = calculatePushQuota(history || []);

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
      automations: {
        inactive_customer: automationsMap.inactive_customer,
        near_reward: automationsMap.near_reward,
        rows: automationsRows || [],
      },
      quota,
      history: history || [],
    });
  } catch (error: any) {
    console.error("Error fetching automations state:", error);
    return NextResponse.json({ error: "Error obteniendo datos de automatizaciones." }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  if (!(await canAccessBusiness(businessId))) {
    return NextResponse.json({ error: "No tenés permiso para este comercio." }, { status: 403 });
  }
  return NextResponse.json({ error: "Los envíos promocionales y las automatizaciones están deshabilitados durante el piloto de Wallet." }, { status: 409 });
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
      message: "Campaña finalizada correctamente. El conteo volvió a 1 sello por visita.",
    });
  } catch (error: any) {
    console.error("Error canceling campaign in automations route:", error);
    return NextResponse.json({ error: error?.message || "No se pudo finalizar la campaña." }, { status: 500 });
  }
}
