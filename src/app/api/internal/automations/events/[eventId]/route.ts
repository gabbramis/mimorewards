import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAutomationAuth } from "@/lib/automation-auth";

const ALLOWED_STATUSES = ["pending", "sent", "failed", "skipped"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/internal/automations/events/[eventId]
 * Consumido por n8n para reportar el resultado del procesamiento.
 *
 * Solo permite actualizar: status, provider_message_id, error_message.
 * NO permite modificar business_id, customer_id, automation_id ni channel.
 *
 * Nota de esquema (010_automations.sql): automation_events no tiene columna
 * de timestamp de procesamiento (solo triggered_at de creación), por lo que
 * no hay campo de tiempo que actualizar en esta fase.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const unauthorized = requireAutomationAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const { eventId } = await params;
    if (!eventId || !UUID_PATTERN.test(eventId)) {
      return NextResponse.json(
        { error: "eventId inválido." },
        { status: 400 },
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Body JSON inválido." },
        { status: 400 },
      );
    }

    const status: unknown = body?.status;
    if (
      typeof status !== "string" ||
      !(ALLOWED_STATUSES as readonly string[]).includes(status)
    ) {
      return NextResponse.json(
        { error: "Status inválido. Permitidos: pending, sent, failed, skipped." },
        { status: 400 },
      );
    }

    // Campos opcionales: aceptar string o null; cualquier otro tipo es 400.
    const hasProviderId = body?.provider_message_id !== undefined;
    const hasErrorMessage = body?.error_message !== undefined;
    const providerMessageId = hasProviderId ? body.provider_message_id : undefined;
    const errorMessage = hasErrorMessage ? body.error_message : undefined;

    if (
      (hasProviderId &&
        providerMessageId !== null &&
        typeof providerMessageId !== "string") ||
      (hasErrorMessage && errorMessage !== null && typeof errorMessage !== "string")
    ) {
      return NextResponse.json(
        { error: "provider_message_id y error_message deben ser string o null." },
        { status: 400 },
      );
    }

    const supabase: any = createAdminClient();

    const { data: existing, error: fetchError } = await supabase
      .from("automation_events")
      .select("id, status")
      .eq("id", eventId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return NextResponse.json(
        { error: "Evento no encontrado." },
        { status: 404 },
      );
    }

    const patch: Record<string, string | null> = {
      status: status as AllowedStatus,
    };
    if (hasProviderId) patch.provider_message_id = providerMessageId;
    if (hasErrorMessage) patch.error_message = errorMessage;

    const { data: updated, error: updateError } = await supabase
      .from("automation_events")
      .update(patch)
      .eq("id", eventId)
      .select("id, status")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      event: { id: updated.id, status: updated.status },
    });
  } catch (error) {
    console.error("[internal-automation] Error actualizando evento:", error);
    return NextResponse.json(
      { error: "No se pudo actualizar el evento." },
      { status: 500 },
    );
  }
}
