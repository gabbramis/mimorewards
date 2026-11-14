import "server-only";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_FETCH_TIMEOUT_MS = 5000;

/**
 * Fetch wrapper con AbortController y sin caché para evitar conexiones "zombie"
 * tras cold starts o periodos de inactividad (>5 min) en Vercel Serverless.
 */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Timeout de conexión a Supabase (${SUPABASE_FETCH_TIMEOUT_MS}ms)`));
  }, SUPABASE_FETCH_TIMEOUT_MS);

  const existingSignal = init?.signal;
  if (existingSignal) {
    if (existingSignal.aborted) {
      clearTimeout(timeoutId);
      controller.abort(existingSignal.reason);
    } else {
      existingSignal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeoutId);
          controller.abort(existingSignal.reason);
        },
        { once: true }
      );
    }
  }

  return fetch(input, {
    ...init,
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Server-only Supabase client for trusted operations.
 * Instantiates a fresh client per request with strict timeout handling to prevent
 * stale/zombie connections across serverless cold starts in Vercel.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configuradas.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: fetchWithTimeout,
    },
  });
}
