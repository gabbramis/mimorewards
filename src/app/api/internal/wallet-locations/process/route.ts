import { NextResponse } from 'next/server';
import { requireAutomationAuth } from '@/lib/automation-auth';
import { processWalletLocationJobs } from '@/lib/wallet/location-sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const unauthorized = requireAutomationAuth(request);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json(await processWalletLocationJobs());
  } catch {
    return NextResponse.json({ error: 'No se pudo procesar la sincronización.' }, { status: 503 });
  }
}
