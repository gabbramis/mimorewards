import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessBusiness } from "@/lib/authz";
import { broadcastWalletCampaign, cancelActiveCampaign } from "@/lib/wallet-notifications";
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
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    if (!(await canAccessBusiness(businessId))) {
      return NextResponse.json({ error: "No tenés permiso para este comercio." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const supabase: any = createAdminClient();

    // Caso 1: Toggle Switch de Regla de Automatización Condicional
    if (body.action === "toggle_automation") {
      const type = String(body.type);
      if (type !== "inactive_customer" && type !== "near_reward") {
        return NextResponse.json({ error: "Tipo de automatización no válido." }, { status: 400 });
      }

      const enabled = Boolean(body.enabled);
      const { data: business } = await supabase
        .from("businesses")
        .select("name")
        .eq("id", businessId)
        .maybeSingle();

      const bizName = business?.name || "nuestro local";
      const trigger_config = type === "inactive_customer" ? { days: 30 } : { remaining_stamps: 1 };
      const defaultTemplate = type === "inactive_customer"
        ? `¡Te extrañamos en ${bizName}! Pasate a sumar sellos y aprovechá tus beneficios exclusivos.`
        : `¡Estás a solo 1 sello de tu recompensa en ${bizName}! Pasá hoy a completar tu tarjeta.`;

      const { data: updated, error: upsertErr } = await supabase
        .from("automations")
        .upsert(
          {
            business_id: businessId,
            type,
            enabled,
            channel: "wallet",
            trigger_config,
            message_template: body.messageTemplate || defaultTemplate,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "business_id,type" }
        )
        .select()
        .single();

      if (upsertErr) {
        console.error("Error toggling automation rule:", upsertErr);
        return NextResponse.json({ error: "No se pudo actualizar la automatización." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        type,
        enabled,
        automation: updated,
        message: enabled ? "Automatización activada correctamente." : "Automatización pausada.",
      });
    }

    // Caso 2: Disparo de Campaña o Mensaje Manual (Aplica Límite Anti-spam: máx 2/semana, mín 72hs)
    const { data: recentLogs } = await supabase
      .from("push_campaigns_log")
      .select("id, created_at, campaign_type")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(20);

    const quota = calculatePushQuota(recentLogs || []);
    if (!quota.canSendNow) {
      let errorMsg = "Has alcanzado el límite de 2 avisos manuales por semana.";
      if (quota.cooldownHoursRemaining > 0) {
        errorMsg = `Debes esperar al menos 72 horas (3 días) entre cada envío masivo. Próximo envío disponible en aprox. ${quota.cooldownHoursRemaining} horas.`;
      }
      return NextResponse.json({ error: errorMsg, quota }, { status: 429 });
    }

    const type = String(body.campaignType || "CUSTOM").toUpperCase();
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
    const targetChannels: "all" | "google_only" = body.targetChannels === "google_only" ? "google_only" : "all";

    if (type === "2X_WEEKEND" || type === "FINDE_2X1") {
      campaignName = campaignName || "Finde de 2x1 en Sellos";
      stampMultiplier = 2;
      expiresAt = getNextSundayEnd();
      message = message || `¡Finde 2x1 en ${business.name}! Todas tus visitas de este fin de semana suman doble sello.`;
    } else if (type === "HAPPY_HOUR") {
      campaignName = campaignName || "Happy Hour de Sellos (4 horas)";
      stampMultiplier = 2;
      expiresAt = getFourHoursLater();
      message = message || `¡Happy Hour en ${business.name}! Pasate en las próximas 4 horas y sumá doble sello.`;
    } else if (type === "QUICK_PROMO" || type === "AVISO_RAPIDO") {
      campaignName = campaignName || "Aviso Rápido";
      stampMultiplier = 1;
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
      targetChannels,
    });

    return NextResponse.json({
      success: true,
      result,
      message: "Notificación push transmitida con éxito.",
    });
  } catch (error: any) {
    console.error("Error activating campaign in automations route:", error);
    return NextResponse.json({ error: error?.message || "No se pudo procesar la solicitud." }, { status: 500 });
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
      message: "Campaña finalizada correctamente. El conteo volvió a 1 sello por visita.",
    });
  } catch (error: any) {
    console.error("Error canceling campaign in automations route:", error);
    return NextResponse.json({ error: error?.message || "No se pudo finalizar la campaña." }, { status: 500 });
  }
}
