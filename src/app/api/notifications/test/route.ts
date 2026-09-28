import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { phone } = await request.json();

        // Validar formato telefónico robusto:
        // Exige un '+' (opcional), al menos 8 dígitos en total permitiendo espacios.
        const cleanedPhone = phone.replace(/[\s-]/g, '');
        const isValid = /^(\+)?\d{8,15}$/.test(cleanedPhone);

        if (!isValid) {
            return NextResponse.json({ error: 'Formato telefónico inválido. Por favor incluye tu código de área.' }, { status: 400 });
        }

        // Simular envío de notificación / ping a proveedor
        await new Promise((resolve) => setTimeout(resolve, 800));

        return NextResponse.json({ success: true, message: `Ping ok a ${phone}` });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Error interno simulando la notificación.' }, { status: 500 });
    }
}
