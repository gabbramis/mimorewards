"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSuperadmin } from "@/lib/authz";

const IMPERSONATION_COOKIE = "mimo_impersonated_business_id";

export async function startImpersonation(businessId: string): Promise<{ ok: boolean; redirectUrl?: string; error?: string }> {
  const allowed = await isSuperadmin();
  if (!allowed) {
    return { ok: false, error: "No tenés permisos de Super Administrador." };
  }

  const cleanId = String(businessId || "").trim();
  if (!cleanId) {
    return { ok: false, error: "ID de comercio inválido." };
  }

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, cleanId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8, // 8 horas
  });

  return { ok: true, redirectUrl: `/comercio/${cleanId}` };
}

export async function stopImpersonation(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
  redirect("/admin");
}

