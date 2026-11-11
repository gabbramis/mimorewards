import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const subscription = await req.json();
    console.log("[Push Notification] Nueva suscripción recibida:", subscription);

    return NextResponse.json(
      { success: true, message: "Suscripción recibida" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Push Notification] Error al procesar suscripción:", error);
    return NextResponse.json(
      { success: false, error: "Error al procesar la suscripción" },
      { status: 400 }
    );
  }
}

