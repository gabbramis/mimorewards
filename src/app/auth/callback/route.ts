import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLoginDestination } from "@/lib/login-access";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  let destination = "/login?error=oauth_error";
  try {
    if (code) {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.user) {
        destination = await getLoginDestination(createAdminClient(), data.user, request.nextUrl.searchParams.get("next"))
          || "/login?error=inactive";
      }
    }
  } catch (error) {
    console.error("No se pudo completar el acceso OAuth:", error);
    destination = "/login?error=access_error";
  }
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
