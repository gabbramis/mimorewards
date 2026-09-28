import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "mimo_customer_token";

function secret() {
  const value = process.env.MIMO_CUSTOMER_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Falta una clave para firmar la sesión del cliente.");
  return value;
}

function signature(customerId: string) {
  return createHmac("sha256", secret()).update(customerId).digest("base64url");
}

function tokenSignature(payload: string) {
  return createHmac("sha256", secret()).update(`tap:${payload}`).digest("base64url");
}

export function customerCookieName(businessId?: string) {
  if (!businessId) return COOKIE_NAME;
  const safeBusinessId = businessId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${COOKIE_NAME}_${safeBusinessId}`;
}

export function createCustomerSession(customerId: string) {
  return `${customerId}.${signature(customerId)}`;
}

export function readCustomerSession(value: string | undefined) {
  if (!value) return null;
  const [customerId, receivedSignature] = value.split(".");
  if (!customerId || !receivedSignature) return null;

  const expected = signature(customerId);
  const received = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (received.length !== expectedBuffer.length || !timingSafeEqual(received, expectedBuffer)) return null;

  return customerId;
}

export function createTapTestToken(customerId: string, nfcId: string, ttlSeconds = 600) {
  const payload = Buffer.from(JSON.stringify({
    customerId,
    nfcId,
    expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
  })).toString("base64url");
  return `${payload}.${tokenSignature(payload)}`;
}

export function readTapTestToken(value: string | undefined, nfcId: string) {
  if (!value) return null;
  const [payload, receivedSignature] = value.split(".");
  if (!payload || !receivedSignature) return null;
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(tokenSignature(payload));
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { customerId?: string; nfcId?: string; expiresAt?: number };
    if (!parsed.customerId || parsed.nfcId !== nfcId || !parsed.expiresAt || parsed.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return parsed.customerId;
  } catch {
    return null;
  }
}
