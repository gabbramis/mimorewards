import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALLOWED_REWARD_TARGETS,
  formatClientNumericId,
  getStampGridLayout,
  isAllowedRewardTarget,
  MIN_CLIENT_NUMERIC_ID,
  normalizeRewardTarget,
} from "@/lib/wallet-config";
import {
  DEFAULT_GOOGLE_CLASS_ID,
  DEFAULT_GOOGLE_ISSUER_ID,
  loadCredentials,
} from "@/lib/wallet/googleWallet";

export const runtime = "nodejs";

// Identificadores Base de Google Wallet para Mimo Rewards
const ISSUER_ID =
  (process.env.GOOGLE_WALLET_ISSUER_ID || process.env.GOOGLE_ISSUER_ID)
    ?.trim()
    .replace(/^["']|["']$/g, "") || DEFAULT_GOOGLE_ISSUER_ID;

const CLASS_SUFFIX =
  (process.env.GOOGLE_WALLET_CLASS_ID || process.env.GOOGLE_CLASS_ID)
    ?.trim()
    .replace(/^["']|["']$/g, "") || DEFAULT_GOOGLE_CLASS_ID;

const FULL_CLASS_ID = CLASS_SUFFIX.startsWith(`${ISSUER_ID}.`)
  ? CLASS_SUFFIX
  : `${ISSUER_ID}.${CLASS_SUFFIX}`;

export interface GoogleWalletRequestBody {
  customerId?: string;
  accountId?: string | number;
  uniqueCode?: string | number;
  customerName?: string;
  firstName?: string;
  lastName?: string;
  currentStamps?: number;
  targetStamps?: number;
  maxStamps?: number;
  rewardTarget?: number;
  businessId?: string;
  businessName?: string;
  rewardDescription?: string;
}

/**
 * POST /api/wallet/google
 * Recibe por body los datos del cliente, valida las reglas estrictas de negocio:
 * - Identificador numérico secuencial >= 15001 (sin letras ni prefijo "CLI -")
 * - Objetivos de sellos válidos únicamente: 4, 5, 6, 8 o 10
 * Firma el JWT (RS256) del LoyaltyObject y devuelve https://pay.google.com/gp/v/save/${signedJwt}
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as GoogleWalletRequestBody;

    let dbCustomer: any = null;
    let dbBusiness: any = null;

    // Si se envía customerId o uniqueCode, enriquecemos opcionalmente desde Supabase
    if (body.customerId || body.uniqueCode || body.accountId) {
      try {
        const supabase: any = createAdminClient();
        const rawLookup = String(body.customerId || body.uniqueCode || body.accountId || "").trim();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawLookup);

        let customerQuery = supabase
          .from("customers")
          .select("id, unique_code, first_name, last_name, current_stamps, business_id, wallet_platform");

        if (isUUID) {
          customerQuery = customerQuery.eq("id", rawLookup);
        } else {
          const cleanLookup = formatClientNumericId(rawLookup);
          customerQuery = customerQuery.eq("unique_code", cleanLookup || rawLookup);
        }

        const { data: foundCustomer } = await customerQuery.maybeSingle();
        if (foundCustomer) {
          dbCustomer = foundCustomer;
          if (foundCustomer.business_id) {
            const { data: foundBusiness } = await supabase
              .from("businesses")
              .select("id, name, reward_target, reward_description, primary_color, logo_url, wallet_config")
              .eq("id", foundCustomer.business_id)
              .maybeSingle();
            dbBusiness = foundBusiness;
          }
        }
      } catch (dbErr) {
        console.warn("[Google Wallet API] No se pudo consultar Supabase, usando datos del body:", dbErr);
      }
    }

    // 1. Validar objetivo de sellos (únicamente 4, 5, 6, 8 o 10)
    const rawTarget =
      body.targetStamps ??
      body.maxStamps ??
      body.rewardTarget ??
      dbBusiness?.reward_target ??
      8;

    const parsedTarget = Number(rawTarget);
    if (
      (body.targetStamps !== undefined || body.maxStamps !== undefined || body.rewardTarget !== undefined) &&
      (!Number.isInteger(parsedTarget) || !isAllowedRewardTarget(parsedTarget))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Objetivo de sellos inválido (${rawTarget}). Los únicos valores permitidos son: ${ALLOWED_REWARD_TARGETS.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const targetStamps = normalizeRewardTarget(parsedTarget, 8);
    const currentStamps = Math.max(
      0,
      Math.min(
        Math.floor(Number(body.currentStamps ?? dbCustomer?.current_stamps ?? 0) || 0),
        targetStamps
      )
    );

    // 2. Identificador del cliente EXCLUSIVAMENTE numérico (>= 15001), sin letras ni "CLI -"
    const rawIdentifier =
      body.accountId ??
      body.uniqueCode ??
      dbCustomer?.unique_code ??
      body.customerId ??
      String(MIN_CLIENT_NUMERIC_ID);

    const numericAccountId = formatClientNumericId(rawIdentifier, String(MIN_CLIENT_NUMERIC_ID));

    if (!/^\d+$/.test(numericAccountId) || Number.parseInt(numericAccountId, 10) < MIN_CLIENT_NUMERIC_ID) {
      return NextResponse.json(
        {
          success: false,
          error: "El identificador del cliente (accountId / QR) debe ser exclusivamente numérico a partir de 15001.",
        },
        { status: 400 }
      );
    }

    // 3. Datos del titular y comercio
    const customerName =
      (
        body.customerName ||
        `${body.firstName || dbCustomer?.first_name || ""} ${body.lastName || dbCustomer?.last_name || ""}`.trim() ||
        "Cliente Mimo"
      ).trim();

    const businessName = (body.businessName || dbBusiness?.name || "Mimo Rewards").trim();
    const rewardDescription = (
      body.rewardDescription ||
      dbBusiness?.reward_description ||
      "Tu próxima recompensa"
    ).trim();

    // Disposición visual de los sellos según la regla estricta (4: 2x2, 5: 1x5, 6: 2x3, 8: 2x4, 10: 2x5)
    const stampLayout = getStampGridLayout(targetStamps);

    // 4. Armar el payload del LoyaltyObject con los identificadores base
    const objectId = `${ISSUER_ID}.${numericAccountId}`;

    const loyaltyObject = {
      id: objectId,
      classId: FULL_CLASS_ID,
      state: "ACTIVE",
      accountId: numericAccountId,
      accountName: customerName,
      barcode: {
        type: "QR_CODE",
        value: numericAccountId,
        alternateText: numericAccountId,
      },
      loyaltyPoints: {
        label: "Sellos",
        balance: {
          int: currentStamps,
        },
      },
      secondaryLoyaltyPoints: {
        label: "Objetivo",
        balance: {
          string: `${currentStamps} / ${targetStamps}`,
        },
      },
      textModulesData: [
        {
          id: "comercio",
          header: "Comercio",
          body: businessName,
        },
        {
          id: "progreso",
          header: "Progreso",
          body: `${currentStamps} de ${targetStamps} sellos`,
        },
        {
          id: "recompensa",
          header: "Premio",
          body: rewardDescription,
        },
      ],
    };

    // 5. Firmar el JWT con las credenciales de la Service Account de Google Cloud
    const credentials = loadCredentials();

    const claims = {
      iss: credentials.client_email,
      aud: "google",
      typ: "savetowallet",
      origins: [],
      payload: {
        loyaltyObjects: [loyaltyObject],
      },
    };

    const signedJwt = jwt.sign(claims, credentials.private_key, {
      algorithm: "RS256",
    });

    const saveUrl = `https://pay.google.com/gp/v/save/${signedJwt}`;

    // Registrar asociación en base de datos si el cliente existe en Supabase
    if (dbCustomer?.id) {
      try {
        const supabase: any = createAdminClient();
        await supabase
          .from("customers")
          .update({
            google_wallet_object_id: objectId,
            wallet_platform: dbCustomer.wallet_platform === "APPLE" ? "BOTH" : "GOOGLE",
          })
          .eq("id", dbCustomer.id);
      } catch {
        // Ignorar error de actualización secundaria para no bloquear la entrega de la URL
      }
    }

    return NextResponse.json({
      success: true,
      url: saveUrl,
      saveUrl,
      accountId: numericAccountId,
      objectId,
      classId: FULL_CLASS_ID,
      targetStamps,
      stampLayout,
    });
  } catch (error: any) {
    console.error("[Google Wallet Endpoint] Error generando enlace:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "No se pudo generar el enlace de Google Wallet.",
      },
      { status: 500 }
    );
  }
}

