import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { createCanvas } from "@napi-rs/canvas";
import { PKPass } from "passkit-generator";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrUpdateLoyaltyClass, generateSavePassUrl, getGoogleObjectId } from "@/lib/wallet/googleWallet";
import { cookies } from 'next/headers';
import { customerCookieName, readCustomerSession } from '@/lib/mimo-customer-session';
import { isSuperadmin } from '@/lib/authz';
import { certificateEnvironment } from '@/lib/wallet/apple-certificates';

export const runtime = "nodejs";

// ============================================================================
// CONFIGURACIÓN Y IDENTIFICADORES DE APPLE DEVELOPER
// ============================================================================
const PASS_TYPE_IDENTIFIER = process.env.APPLE_PASS_TYPE_IDENTIFIER || "pass.com.mimorewards.loyalty";
const TEAM_IDENTIFIER = process.env.APPLE_TEAM_IDENTIFIER || "K4TTF9N96K";

// Carpeta de certificados criptográficos en la raíz del proyecto
const CERTS_DIR = join(process.cwd(), "certs");

/**
 * Carga un certificado desde la carpeta `certs/`
 */
function parseEnvCertificate(rawVal: string): Buffer {
  let cleaned = rawVal.trim().replace(/\\n/g, "\n");
  if (!cleaned.includes("-----BEGIN") && /^[A-Za-z0-9+/=\s]+$/.test(cleaned)) {
    return Buffer.from(cleaned, "base64");
  }
  return Buffer.from(cleaned, "utf-8");
}

function loadCertificate(fileName: string, envVarName: string): Buffer {
  // 1. Variables de entorno (producción Vercel)
  const envVal = certificateEnvironment(envVarName);
  if (envVal) {
    return parseEnvCertificate(envVal);
  }

  // 2. Fallback local: carpeta certs/ en la raíz del proyecto
  const certsPath = join(CERTS_DIR, fileName);
  if (existsSync(certsPath)) {
    return readFileSync(certsPath);
  }

  // 3. Fallback alternativo legacy: .secrets/apple-wallet/
  const legacyPath = join(process.cwd(), ".secrets", "apple-wallet", fileName);
  if (existsSync(legacyPath)) {
    return readFileSync(legacyPath);
  }

  throw new Error(
    `Certificado no encontrado: No se encontró la variable de entorno "${envVarName}" ni el archivo físico en "certs/${fileName}".`
  );
}

/**
 * Ícono de contingencia por si el comercio no tiene logoUrl o falla la descarga
 */
function generateFallbackIcon(size: number): Buffer {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const scale = size / 58;

  ctx.fillStyle = "#FF1F2D";
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(29, 45);
  ctx.bezierCurveTo(23, 40, 10, 30, 10, 20);
  ctx.bezierCurveTo(10, 11, 21, 8, 29, 17);
  ctx.bezierCurveTo(37, 8, 48, 11, 48, 20);
  ctx.bezierCurveTo(48, 30, 35, 40, 29, 45);
  ctx.fill();
  ctx.restore();

  return canvas.toBuffer("image/png");
}

/**
 * Descarga el logo de Supabase y genera en memoria `icon.png` y `logo.png` con Sharp
 */
async function processLogoImages(logoUrl?: string | null): Promise<{
  iconBuffer: Buffer;
  logoBuffer: Buffer | null;
}> {
  let sourceBuffer: Buffer | null = null;

  if (logoUrl) {
    try {
      const response = await fetch(logoUrl, { signal: AbortSignal.timeout(6000) });
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        sourceBuffer = Buffer.from(arrayBuf);
      }
    } catch (err) {
      console.warn("[Wallet Pass] No se pudo descargar el logo desde logoUrl, usando contingencia:", err);
    }
  }

  if (sourceBuffer) {
    try {
      // 1. icon.png: 58x58 px (fit: contain, fondo transparente)
      const iconBuffer = await sharp(sourceBuffer)
        .resize(58, 58, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      // 2. logo.png: 160x160 px cuadrado perfecto (fit: cover) recortando bordes transparentes
      let trimmed = sourceBuffer;
      try {
        trimmed = await sharp(sourceBuffer).trim().png().toBuffer();
      } catch {
        trimmed = sourceBuffer;
      }

      const logoBuffer = await sharp(trimmed)
        .resize(160, 160, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      return { iconBuffer, logoBuffer };
    } catch (err) {
      console.warn("[Wallet Pass] Error procesando imagen con sharp, usando contingencia:", err);
    }
  }

  // Fallback si no hay imagen
  const iconBuffer = generateFallbackIcon(58);
  return { iconBuffer, logoBuffer: null };
}

/**
 * Construye y firma la tarjeta Store Card en memoria inyectando los buffers dinámicos
 */
async function buildStoreCard(params: {
  customerName: string;
  currentStamps: number;
  targetStamps: number;
  businessName: string;
  rewardDescription: string;
  qrMessage: string;
  logoUrl?: string | null;
  serialNumber?: string;
}): Promise<Buffer> {
  const {
    customerName,
    currentStamps,
    targetStamps,
    businessName,
    rewardDescription,
    qrMessage,
    logoUrl,
    serialNumber = `mimo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  } = params;

  // Cargar certificados (prioridad: variables de entorno Vercel -> fallback: certs/)
  const wwdr = loadCertificate("wwdrg4.pem", "APPLE_WWDR_CERT");
  const signerCert = loadCertificate("signerCert.pem", "APPLE_SIGNER_CERT");
  const signerKey = loadCertificate("mimo-wallet-private-key.pem", "APPLE_PRIVATE_KEY");

  // Procesar imágenes con Sharp en tiempo real
  const { iconBuffer, logoBuffer } = await processLogoImages(logoUrl);

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_IDENTIFIER,
    teamIdentifier: TEAM_IDENTIFIER,
    serialNumber,
    organizationName: businessName,
    description: `Tarjeta de fidelización de ${businessName}`,
    logoText: businessName,

    // Diseño y colores
    backgroundColor: "rgb(255, 255, 255)", // Fondo blanco
    labelColor: "rgb(255, 31, 45)",        // Rojo Mimo
    foregroundColor: "rgb(30, 30, 30)",     // Texto oscuro

    // Estructura Store Card
    storeCard: {
      headerFields: [
        {
          key: "stamps",
          label: "SELLOS",
          value: `${currentStamps} / ${targetStamps}`,
          textAlignment: "PKTextAlignmentRight",
          changeMessage: "¡Sumaste un sello! Llevás %@ acumulados.",
        },
      ],
      primaryFields: [],
      secondaryFields: [
        {
          key: "customer",
          label: "CLIENTE",
          value: customerName.startsWith("¡Hola") ? customerName : `¡Hola, ${customerName.split(" ")[0]}!`,
        },
      ],
      auxiliaryFields: [
        {
          key: "reward",
          label: "RECOMPENSA",
          value: rewardDescription,
        },
      ],
      backFields: [
        {
          key: "about",
          label: "Programa de beneficios",
          value: `Tarjeta de fidelización oficial de ${businessName}, emitida a través de Mimo Rewards. Presentala en cada compra para sumar sellos.`,
        },
      ],
    },

    // Código QR dinámico
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: qrMessage,
        messageEncoding: "iso-8859-1",
        altText: qrMessage,
      },
    ],
  };

  // Buffers generados en memoria (sin lectura de archivos estáticos en disco)
  const passBuffers: Record<string, Buffer> = {
    "pass.json": Buffer.from(JSON.stringify(passJson)),
    "icon.png": iconBuffer,
    "icon@2x.png": iconBuffer,
  };

  if (logoBuffer) {
    passBuffers["logo.png"] = logoBuffer;
    passBuffers["logo@2x.png"] = logoBuffer;
  }

  // Instanciar PKPass con los buffers en memoria y certificados
  const pass = new PKPass(passBuffers, {
    wwdr,
    signerCert,
    signerKey,
  });

  return pass.getAsBuffer();
}

/**
 * POST /api/wallet/generate
 * Recibe: customerName, currentStamps, targetStamps, businessName, rewardDescription, qrMessage, logoUrl
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // Soporte para Google Wallet heredado si envían solo customerId
    if (body.customerId && !body.customerName && !body.nombre && !body.businessName && !body.comercio) {
      const supabase: any = createAdminClient();
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("id, first_name, last_name, business_id, current_stamps, wallet_platform, unique_code")
        .eq("id", body.customerId)
        .maybeSingle();

      if (customerError || !customer) {
        console.warn("[Google Wallet] Cliente no encontrado para id:", body.customerId);
        return NextResponse.json({ success: false, error: "No se encontró el cliente solicitado." }, { status: 404 });
      }

      const cookieStore = await cookies();
      if (readCustomerSession(cookieStore.get(customerCookieName(customer.business_id))?.value) !== customer.id) {
        return NextResponse.json({ success: false, error: 'Abrí primero tu tarjeta en este celular.' }, { status: 403 });
      }

      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("id, name, active, logo_url, reward_target, primary_color, reward_description, wallet_config")
        .eq("id", customer.business_id)
        .maybeSingle();

      if (businessError || !business || business.active === false) {
        console.warn("[Google Wallet] Comercio no encontrado para cliente:", customer.id);
        return NextResponse.json({ success: false, error: "No se encontró el comercio asociado." }, { status: 404 });
      }

      let { data: loyaltyCard } = await supabase
        .from("loyalty_cards")
        .select("id, wallet_platform")
        .eq("customer_id", customer.id)
        .eq("business_id", customer.business_id)
        .maybeSingle();

      if (!loyaltyCard) {
        const { data: newCard } = await supabase
          .from("loyalty_cards")
          .insert({
            customer_id: customer.id,
            business_id: customer.business_id,
            current_stamps: customer.current_stamps || 0,
            wallet_platform: "GOOGLE",
            wallet_status: "ACTIVE",
          })
          .select("id, wallet_platform")
          .maybeSingle();
        loyaltyCard = newCard || { id: customer.id, wallet_platform: "GOOGLE" };
      }

      try {
        const fullName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Cliente Mimo";
        const { id: classId } = await createOrUpdateLoyaltyClass(
          business.id,
          business.name,
          business.primary_color || "#FF1F2D",
          business.logo_url,
          business.wallet_config
        );
        const saveUrl = generateSavePassUrl(
          loyaltyCard.id,
          fullName,
          customer.current_stamps || 0,
          business.reward_target || 10,
          business.id,
          business.wallet_config,
          business.reward_description || undefined,
          customer.unique_code || undefined
        );
        const objectId = getGoogleObjectId(loyaltyCard.id);

        await Promise.allSettled([
          supabase.from("businesses").update({ google_wallet_class_id: classId }).eq("id", business.id),
          supabase.from("customers").update({
            google_wallet_object_id: objectId,
            wallet_platform: customer.wallet_platform === "APPLE" ? "BOTH" : "GOOGLE",
          }).eq("id", customer.id),
          loyaltyCard.id !== customer.id ? supabase.from("loyalty_cards").update({
            google_wallet_object_id: objectId,
            wallet_platform: loyaltyCard.wallet_platform === "APPLE" ? "BOTH" : "GOOGLE",
            wallet_status: "ACTIVE",
          }).eq("id", loyaltyCard.id) : Promise.resolve(),
        ]);

        return NextResponse.json({ success: true, saveUrl });
      } catch (gwError: any) {
        console.error("[Google Wallet] Error generando pase para cliente:", customer.id, gwError);
        const googleDetails = gwError?.response?.data ? JSON.stringify(gwError.response.data) : null;
        const status = gwError?.status || gwError?.code || gwError?.response?.status;
        const fullMessage = [
          gwError?.message || "Error al procesar Google Wallet",
          googleDetails ? `Google API: ${googleDetails}` : null,
          status ? `Status: ${status}` : null,
        ].filter(Boolean).join(" | ");

        return NextResponse.json(
          {
            success: false,
            error: fullMessage,
          },
          { status: 500 }
        );
      }
    }

    // Legacy arbitrary sample generation is restricted to the superadmin.
    if (!await isSuperadmin()) return NextResponse.json({ error: 'Usá tu tarjeta para agregarla a Wallet.' }, { status: 403 });
    // Extracción dinámica del body
    const customerName = String(body.customerName || body.cliente || body.nombre || "Cliente Mimo").trim();
    const currentStamps = Number(body.currentStamps ?? body.sellos ?? 0);
    const targetStamps = Number(body.targetStamps ?? body.meta ?? body.metaSellos ?? 10);
    const businessName = String(body.businessName || body.comercio || body.nombreComercio || "Comercio Mimo").trim();
    const rewardDescription = String(body.rewardDescription || body.premio || body.recompensa || "1 Beneficio gratis").trim();
    const qrMessage = String(
      body.qrMessage || body.qrCode || body.codigo || body.customerId || `MIMO-${Date.now()}`
    ).trim();
    const logoUrl = body.logoUrl || body.logo || null;

    // Construcción y firma con imágenes procesadas por Sharp
    const pkpassBuffer = await buildStoreCard({
      customerName,
      currentStamps,
      targetStamps,
      businessName,
      rewardDescription,
      qrMessage,
      logoUrl,
    });

    const safeFilename = `${businessName.toLowerCase().replace(/[^a-z0-9]/g, "-") || "tarjeta"}.pkpass`;

    return new Response(new Uint8Array(pkpassBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Cache-Control": "no-store, private",
      },
    });
  } catch (error: any) {
    console.error("[Wallet Pass] Error al generar tarjeta:", error);
    const googleDetails = error?.response?.data ? JSON.stringify(error.response.data) : null;
    const status = error?.status || error?.code || error?.response?.status;
    const fullMessage = [
      error?.message || "Error al generar tarjeta digital",
      googleDetails ? `Google API: ${googleDetails}` : null,
      status ? `Status: ${status}` : null,
    ].filter(Boolean).join(" | ");

    return NextResponse.json(
      {
        success: false,
        error: fullMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/wallet/generate
 * Permite descargar y probar la tarjeta desde Safari / navegador mediante query params:
 * ?cliente=Franco&sellos=4&meta=10&comercio=CafeCentral&premio=1%20Cafe%20gratis&logoUrl=https://...
 */
export async function GET(request: Request) {
  if (!await isSuperadmin()) return NextResponse.json({ error: 'Prueba disponible solo para el superadmin.' }, { status: 403 });
  try {
    const { searchParams } = new URL(request.url);

    const customerName = searchParams.get("cliente") || searchParams.get("customerName") || searchParams.get("nombre") || "Cliente Mimo";
    const currentStamps = Number(searchParams.get("sellos") || searchParams.get("currentStamps") || 0);
    const targetStamps = Number(searchParams.get("meta") || searchParams.get("targetStamps") || 10);
    const businessName = searchParams.get("comercio") || searchParams.get("businessName") || "Comercio Mimo";
    const rewardDescription = searchParams.get("premio") || searchParams.get("rewardDescription") || "1 Beneficio gratis";
    const qrMessage = searchParams.get("codigo") || searchParams.get("qrMessage") || `MIMO-${Date.now()}`;
    const logoUrl = searchParams.get("logoUrl") || searchParams.get("logo") || null;

    const pkpassBuffer = await buildStoreCard({
      customerName,
      currentStamps,
      targetStamps,
      businessName,
      rewardDescription,
      qrMessage,
      logoUrl,
    });

    const safeFilename = `${businessName.toLowerCase().replace(/[^a-z0-9]/g, "-") || "tarjeta"}.pkpass`;

    return new Response(new Uint8Array(pkpassBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Cache-Control": "no-store, private",
      },
    });
  } catch (error: any) {
    console.error("Error al generar tarjeta Apple Wallet (GET):", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "No se pudo generar la tarjeta de Apple Wallet.",
      },
      { status: 500 }
    );
  }
}
