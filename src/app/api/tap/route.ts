import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    // Lógica del GET
    return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
    // Lógica del POST
    return NextResponse.json({ ok: true });
}
