import "server-only";

import http2 from "node:http2";
import { createAdminClient } from "@/lib/supabase/admin";
import { certificate, PASS_TYPE_ID } from "./appleWallet";

export type ApnsPushResult = {
  pushToken: string;
  status: number;
  success: boolean;
  unregistered?: boolean;
  error?: string;
};

/**
 * Envía una notificación push vacía requerida por el protocolo de Apple Wallet
 * para indicarle al dispositivo iOS que descargue la versión actualizada del pase.
 */
export async function sendApnsNotification(
  pushToken: string,
  passTopic: string = PASS_TYPE_ID,
): Promise<ApnsPushResult> {
  const host =
    process.env.APNS_HOST ||
    (process.env.APNS_ENV === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com");

  let cert: Buffer;
  let key: Buffer;

  try {
    cert = certificate("APPLE_SIGNER_CERT", "signerCert.pem");
    key = certificate("APPLE_PRIVATE_KEY", "mimo-wallet-private-key.pem");
  } catch (err: any) {
    console.error("[APNs] No se pudieron cargar los certificados para push:", err?.message);
    return {
      pushToken,
      status: 500,
      success: false,
      error: err?.message || "Certificados no disponibles",
    };
  }

  return new Promise((resolve) => {
    let client: http2.ClientHttp2Session | null = null;
    let resolved = false;

    const finalize = (result: ApnsPushResult) => {
      if (!resolved) {
        resolved = true;
        if (client && !client.destroyed) {
          try {
            client.close();
          } catch { }
        }
        resolve(result);
      }
    };

    try {
      client = http2.connect(`https://${host}:443`, {
        cert,
        key,
      });

      client.on("error", (err) => {
        finalize({
          pushToken,
          status: 500,
          success: false,
          error: `HTTP2 connect error: ${err.message}`,
        });
      });

      const req = client.request({
        [http2.constants.HTTP2_HEADER_METHOD]: http2.constants.HTTP2_METHOD_POST,
        [http2.constants.HTTP2_HEADER_PATH]: `/3/device/${pushToken}`,
        "apns-topic": passTopic,
        "apns-priority": "10",
        "apns-push-type": "background",
      });

      req.setTimeout(8000, () => {
        try {
          req.close(http2.constants.NGHTTP2_CANCEL);
        } catch { }
        finalize({
          pushToken,
          status: 408,
          success: false,
          error: "APNs request timeout (8s)",
        });
      });

      let status = 0;
      let responseBody = "";

      req.on("response", (headers) => {
        status = Number(headers[http2.constants.HTTP2_HEADER_STATUS]) || 0;
      });

      req.on("data", (chunk) => {
        responseBody += chunk.toString("utf-8");
      });

      req.on("end", () => {
        const isSuccess = status === 200;
        const isUnregistered = status === 410; // Token caducado o tarjeta eliminada

        finalize({
          pushToken,
          status,
          success: isSuccess,
          unregistered: isUnregistered,
          error: !isSuccess ? responseBody || `HTTP ${status}` : undefined,
        });
      });

      req.on("error", (err) => {
        finalize({
          pushToken,
          status: 500,
          success: false,
          error: `Request error: ${err.message}`,
        });
      });

      // El payload de Apple Wallet DEBE ser un objeto JSON vacío {}
      req.write(JSON.stringify({}));
      req.end();
    } catch (err: any) {
      finalize({
        pushToken,
        status: 500,
        success: false,
        error: `Unexpected error: ${err?.message}`,
      });
    }
  });
}

/**
 * Envía la notificación APNs a todos los dispositivos registrados para un serialNumber (.id de la loyalty_card)
 */
export async function sendPassUpdatePush(serialNumber: string): Promise<{ sent: number; failed: number }> {
  try {
    const supabase: any = createAdminClient();
    const { data: devices, error } = await supabase
      .from("wallet_devices")
      .select("id, push_token, pass_type_identifier")
      .eq("serial_number", serialNumber);

    if (error) {
      console.error("[APNs] Error consultando wallet_devices:", error);
      return { sent: 0, failed: 0 };
    }

    if (!devices || devices.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const device of devices) {
      const result = await sendApnsNotification(device.push_token, device.pass_type_identifier);
      if (result.success) {
        sent++;
      } else {
        failed++;
        console.warn(`[APNs] Falló push a dispositivo ${device.id}:`, result.error);

        // Si el token es inválido o el usuario borró la tarjeta (410 Gone), limpiar registro
        if (result.unregistered) {
          console.log(`[APNs] Limpiando dispositivo 410 (desinstalado): ${device.id}`);
          await supabase.from("wallet_devices").delete().eq("id", device.id);
        }
      }
    }

    return { sent, failed };
  } catch (err) {
    console.error("[APNs] Error en sendPassUpdatePush:", err);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Busca las tarjetas asociadas a un cliente y dispara la actualización push de sus pases en Apple Wallet
 */
export async function sendCustomerPassUpdate(
  customerId: string,
  businessId?: string,
): Promise<{ sent: number; failed: number }> {
  try {
    const supabase: any = createAdminClient();
    let query = supabase.from("loyalty_cards").select("id").eq("customer_id", customerId);
    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    const { data: cards, error } = await query;
    if (error || !cards || cards.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let totalSent = 0;
    let totalFailed = 0;

    for (const card of cards) {
      const res = await sendPassUpdatePush(card.id);
      totalSent += res.sent;
      totalFailed += res.failed;
    }

    return { sent: totalSent, failed: totalFailed };
  } catch (err) {
    console.error("[APNs] Error en sendCustomerPassUpdate:", err);
    return { sent: 0, failed: 0 };
  }
}
