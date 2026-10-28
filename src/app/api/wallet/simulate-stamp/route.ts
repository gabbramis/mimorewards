import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Usá el flujo autorizado de sellos del panel.' }, { status: 410 });
}
