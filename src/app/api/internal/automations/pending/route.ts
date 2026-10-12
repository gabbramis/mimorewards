import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAutomationAuth } from "@/lib/automation-auth";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

/**
 * GET /api/internal/automations/pending
 * Consumido por n8n (server-to-server) para obtener automation_events pendientes.
 *
 * Esquema real verificado contra Supabase (migración 010_automations.sql):
 * - automation_events(id, automation_id, business_id, customer_id, channel,
 *   status, triggered_at, provider_message_id, error_message, metadata)
 * - automations(id, business_id, type, channel, trigger_config, message_template,
 *   reward_id, ...)
 * - customers(id, first_name, last_name, phone, email, current_stamps, ...)
 * - businesses(id, name, ...) — ver NOTA-2 abajo.
 * - rewards(id, business_id, name, stamps_required, ...)
 *
 * NOTA-1 (embed de businesses): PostgREST no resuelve la relación
 * automation_events → businesses (FK ausente en la caché del esquema), por lo
 * que los comercios se consultan en un segundo query por IDs. Los embeds de
 * automations y customers sí funcionan y se mantienen.
 *
 * NOTA-2 (businesses): la tabla remota solo tiene (id, slug, name, user_id,
 * created_at). NO existen reward_target ni reward_description, así que el
 * cálculo de remaining_stamps usa rewards.stamps_required y el fallback de
 * reward_name termina en metadata.reward_name.
 */

// ---------------------------------------------------------------------------
// CONSENTIMIENTO
// ---------------------------------------------------------------------------
// El esquema actual NO tiene campos de consentimiento (opt-in WhatsApp / email).
// customers tiene phone y email pero ningún flag de aceptación, y
// loyalty_cards.wallet_status es un estado genérico de tarjeta, no un opt-in.
// Por eso NO se filtra nada aquí: inventar una validación sería lógica falsa.
// Punto de extensión: cuando exista p.ej. customers.whatsapp_opt_in /
// customers.email_opt_in, implementar canContactForChannel() y filtrar o
// marcar skipped antes de devolver el evento.
// Ver: automatizaciones/page.tsx ("Solo se contactará a clientes que hayan
// aceptado...") — hoy es solo texto UI, sin columnas que lo respalden.
// ---------------------------------------------------------------------------
function canContactForChannel(_channel: string): boolean {
  // TODO(consent): validar opt-in real cuando el esquema lo soporte.
  return true;
}

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return null;
}

export async function GET(request: Request) {
  const unauthorized = requireAutomationAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    const rawLimit = url.searchParams.get("limit");
    const parsedLimit = toInt(rawLimit) ?? DEFAULT_LIMIT;
    const limit = Math.min(Math.max(parsedLimit, 1), MAX_LIMIT);

    // Bypass RLS a propósito: endpoint interno server-to-server con
    // service_role. Nunca exponer este cliente al navegador.
    const supabase: any = createAdminClient();

    const { data: rows, error } = await supabase
      .from("automation_events")
      .select(
        `
        id, automation_id, business_id, customer_id, channel, status,
        triggered_at, metadata,
        automations (id, type, channel, message_template, trigger_config, reward_id),
        customers (id, first_name, last_name, phone, email, current_stamps)
      `,
      )
      .eq("status", "pending")
      .order("triggered_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    const events: any[] = Array.isArray(rows) ? rows : [];

    // Comercios por separado (ver NOTA-1).
    const businessIds = Array.from(
      new Set(
        events
          .map((e) => e?.business_id)
          .filter((v: unknown): v is string => typeof v === "string" && v.length > 0),
      ),
    );
    let businessesById = new Map<string, { name: string | null }>();
    if (businessIds.length > 0) {
      const { data: businesses, error: businessesError } = await supabase
        .from("businesses")
        .select("id, name")
        .in("id", businessIds);
      if (businessesError) throw businessesError;
      businessesById = new Map(
        ((businesses ?? []) as any[]).map((b) => [b.id, { name: b.name ?? null }]),
      );
    }

    // Recompensas para variables {{reward_name}} / {{remaining_stamps}}.
    const rewardIds = Array.from(
      new Set(
        events
          .map((e) => e?.automations?.reward_id)
          .filter((v: unknown): v is string => typeof v === "string" && v.length > 0),
      ),
    );
    let rewardsById = new Map<string, { name: string; stamps_required: number }>();
    if (rewardIds.length > 0) {
      const { data: rewards, error: rewardsError } = await supabase
        .from("rewards")
        .select("id, name, stamps_required")
        .in("id", rewardIds);
      if (rewardsError) throw rewardsError;
      rewardsById = new Map(
        ((rewards ?? []) as any[]).map((r) => [
          r.id,
          { name: r.name, stamps_required: r.stamps_required },
        ]),
      );
    }

    const items = events
      .filter((event) => {
        const channel: string =
          event?.channel ?? event?.automations?.channel ?? "whatsapp";
        return canContactForChannel(channel);
      })
      .map((event) => {
        const automation = event?.automations ?? null;
        const customer = event?.customers ?? null;
        const business = event?.business_id
          ? businessesById.get(event.business_id) ?? null
          : null;
        const metadata =
          event?.metadata && typeof event.metadata === "object"
            ? event.metadata
            : {};
        const triggerConfig =
          automation?.trigger_config && typeof automation.trigger_config === "object"
            ? automation.trigger_config
            : {};

        const channel: string =
          event?.channel ?? automation?.channel ?? "whatsapp";
        const reward = automation?.reward_id
          ? rewardsById.get(automation.reward_id)
          : undefined;
        const targetStamps: number | null = toInt(reward?.stamps_required);
        const currentStamps: number | null = toInt(customer?.current_stamps);
        const remainingFromMeta: number | null =
          toInt((metadata as any)?.remaining_stamps) ??
          toInt(triggerConfig?.remaining_stamps);
        const remainingStamps: number | null =
          remainingFromMeta ??
          (targetStamps !== null && currentStamps !== null
            ? Math.max(targetStamps - currentStamps, 0)
            : null);

        return {
          event_id: event.id,
          automation_id: event.automation_id,
          business_id: event.business_id,
          customer_id: event.customer_id,
          type: automation?.type ?? (metadata as any)?.type ?? null,
          channel,
          message_template: automation?.message_template ?? "",
          triggered_at: event.triggered_at,
          customer: customer
            ? {
                first_name: customer.first_name ?? null,
                last_name: customer.last_name ?? null,
                phone: customer.phone ?? null,
                email: customer.email ?? null,
                current_stamps: currentStamps,
              }
            : null,
          business: business
            ? {
                name: business.name,
              }
            : null,
          variables: {
            first_name: customer?.first_name ?? null,
            business_name: business?.name ?? null,
            remaining_stamps: remainingStamps,
            reward_name:
              reward?.name ?? (metadata as any)?.reward_name ?? null,
          },
          // Passthrough para que n8n use datos del trigger sin consultas extra.
          metadata,
        };
      });

    return NextResponse.json({ events: items });
  } catch (error) {
    console.error("[internal-automation] Error listando eventos pendientes:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los eventos pendientes." },
      { status: 500 },
    );
  }
}
