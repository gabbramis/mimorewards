import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessBusiness, getCurrentAccess } from "@/lib/authz";
import {
  getFallbackNotifications,
  markFallbackNotificationsRead,
} from "@/lib/merchant-notifications-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId")?.trim() || "";

    if (!businessId) {
      return NextResponse.json(
        { error: "Falta el parámetro businessId." },
        { status: 400 }
      );
    }

    const access = await getCurrentAccess();
    if (!access.user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (!(await canAccessBusiness(businessId))) {
      return NextResponse.json({ error: "Sin permisos para este comercio." }, { status: 403 });
    }

    const supabase: any = createAdminClient();
    const { data, error } = await supabase
      .from("merchant_notifications")
      .select("id, business_id, type, message, is_read, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.warn("[api/merchant/notifications] Usando fallback en memoria:", error.message);
      const fallback = getFallbackNotifications(businessId);
      const unreadCount = fallback.filter((n) => !n.is_read).length;
      return NextResponse.json(
        { notifications: fallback, unreadCount },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const notifications = Array.isArray(data) ? data : [];
    const unreadCount = notifications.filter((n: any) => !n.is_read).length;

    return NextResponse.json(
      { notifications, unreadCount },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("[api/merchant/notifications GET] Error:", err);
    return NextResponse.json(
      { error: "No se pudieron obtener las notificaciones.", notifications: [], unreadCount: 0 },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
    const notificationId = typeof body.notificationId === "string" ? body.notificationId.trim() : "";

    if (!businessId) {
      return NextResponse.json(
        { error: "Falta el businessId del comercio." },
        { status: 400 }
      );
    }

    const access = await getCurrentAccess();
    if (!access.user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (!(await canAccessBusiness(businessId))) {
      return NextResponse.json({ error: "Sin permisos para este comercio." }, { status: 403 });
    }

    markFallbackNotificationsRead(businessId, notificationId || undefined);

    const supabase: any = createAdminClient();
    let query = supabase
      .from("merchant_notifications")
      .update({ is_read: true })
      .eq("business_id", businessId);

    if (notificationId) {
      query = query.eq("id", notificationId);
    } else {
      query = query.eq("is_read", false);
    }

    const { error } = await query;
    if (error) {
      console.warn("[api/merchant/notifications PATCH] Aviso al marcar como leídas:", error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/merchant/notifications PATCH] Error:", err);
    return NextResponse.json(
      { error: "No se pudieron actualizar las notificaciones." },
      { status: 500 }
    );
  }
}

export { PATCH as POST };

