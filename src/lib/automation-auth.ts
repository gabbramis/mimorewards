import "server-only";
import { NextResponse } from "next/server";

/**
 * Autenticación server-to-server para los endpoints internos de automatizaciones
 * (mimo → n8n → mimo).
 *
 * n8n debe enviar:  x-mimo-automation-key: <MIMO_AUTOMATION_SECRET>
 * No usa autenticación de usuario/merchant ni RLS de navegador.
 */

const HEADER_NAME = "x-mimo-automation-key";

export function getAutomationSecret(): string {
  return (process.env.MIMO_AUTOMATION_SECRET || "").trim();
}

/**
 * Valida el header interno. Devuelve `null` si está autorizado,
 * o un NextResponse 401/500 listo para retornar.
 */
export function requireAutomationAuth(request: Request): NextResponse | null {
  const secret = getAutomationSecret();

  // Falla de configuración: no exponer detalles al cliente.
  if (!secret) {
    console.error("[internal-automation] MIMO_AUTOMATION_SECRET no está configurada.");
    return NextResponse.json(
      { error: "Error interno de configuración." },
      { status: 500 },
    );
  }

  const provided = (request.headers.get(HEADER_NAME) || "").trim();

  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
