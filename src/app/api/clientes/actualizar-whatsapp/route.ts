import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[Clientes] Actualización de permiso de WhatsApp recibida:", body);

    // TODO: Conectar con la base de datos para actualizar la columna de WhatsApp del cliente

    return NextResponse.json(
      { success: true, message: "Permiso de WhatsApp actualizado" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Clientes] Error al actualizar permiso de WhatsApp:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar permiso de WhatsApp" },
      { status: 400 }
    );
  }
}

