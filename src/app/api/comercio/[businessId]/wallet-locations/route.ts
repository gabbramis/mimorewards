import { after, NextResponse } from 'next/server';
import { walletLocationClient } from '@/lib/wallet/location-database';
import { getWalletLocationAccess } from '@/lib/wallet/location-store';
import { validateWalletLocations, UUID_PATTERN } from '@/lib/wallet/locations';
import { appleWalletConfigured } from '@/lib/wallet/appleWallet';
import { googleWalletConfigured } from '@/lib/wallet/googleWallet';
import { processWalletLocationJobs } from '@/lib/wallet/location-sync';

export const runtime = 'nodejs';
export const maxDuration = 60;
type Context = { params: Promise<{ businessId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { businessId } = await params;
  if (!UUID_PATTERN.test(businessId)) return NextResponse.json({ error: 'Negocio inválido.' }, { status: 400 });
  const access = await getWalletLocationAccess(businessId);
  if (!access.allowed) return NextResponse.json({ error: 'No tenés permisos para configurar ubicaciones.' }, { status: 403 });
  const supabase = walletLocationClient();
  const { data: business, error } = await supabase.from('businesses')
    .select('id, name, slug, active, wallet_locations_enabled, wallet_location_revision').eq('id', businessId).maybeSingle();
  if (error) return NextResponse.json({ error: 'La configuración de geolocalización aún no está disponible. El equipo Mimo debe completar su instalación.' }, { status: 503 });
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado.' }, { status: 404 });
  if (!access.superadmin && !business.wallet_locations_enabled) return NextResponse.json({ error: 'Este negocio todavía no participa del piloto.' }, { status: 403 });
  const [locations, summary] = await Promise.all([
    supabase.from('branch_wallet_locations').select('id, name, address, latitude, longitude, enabled, apple_relevant_text')
      .eq('business_id', businessId).order('id'),
    supabase.rpc('wallet_location_sync_summary', { p_business_id: businessId, p_revision: business.wallet_location_revision }),
  ]);
  if (locations.error || summary.error) return NextResponse.json({ error: 'No se pudo cargar la configuración. Intentá nuevamente.' }, { status: 503 });
  return NextResponse.json({
    business, superadmin: access.superadmin,
    locations: (locations.data ?? []).map(({ apple_relevant_text, ...row }) => ({ ...row, appleRelevantText: apple_relevant_text })),
    summary: summary.data, configured: { apple: appleWalletConfigured(), google: googleWalletConfigured() },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PUT(request: Request, { params }: Context) {
  const { businessId } = await params;
  if (!UUID_PATTERN.test(businessId)) return NextResponse.json({ error: 'Negocio inválido.' }, { status: 400 });
  const access = await getWalletLocationAccess(businessId);
  if (!access.allowed) return NextResponse.json({ error: 'No tenés permisos para configurar ubicaciones.' }, { status: 403 });
  let input: { enabled: boolean; revision: number; locations: ReturnType<typeof validateWalletLocations> };
  try {
    const body = await request.json();
    if (typeof body.enabled !== 'boolean' || !Number.isInteger(body.revision) || body.revision < 0) throw new Error('Configuración inválida.');
    input = { enabled: body.enabled, revision: body.revision, locations: validateWalletLocations(body.locations) };
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Configuración inválida.' }, { status: 400 });
  }
  const supabase = walletLocationClient();
  const { data: business, error } = await supabase.from('businesses')
    .select('wallet_locations_enabled, active').eq('id', businessId).maybeSingle();
  if (error || !business) return NextResponse.json({ error: 'La configuración aún no está disponible.' }, { status: 503 });
  if (!access.superadmin && (!business.wallet_locations_enabled || input.enabled !== business.wallet_locations_enabled)) {
    return NextResponse.json({ error: 'Solo el superadmin puede habilitar o deshabilitar el piloto.' }, { status: 403 });
  }
  if (input.enabled && !business.active) return NextResponse.json({ error: 'Activá el negocio antes de habilitar cercanía.' }, { status: 409 });
  const result = await supabase.rpc('save_wallet_locations', {
    p_business_id: businessId, p_enabled: input.enabled,
    p_expected_revision: input.revision, p_locations: input.locations,
  });
  if (result.error) {
    if (result.error.message.includes('revision_conflict')) return NextResponse.json({ error: 'Otra persona guardó cambios. Recargá la configuración antes de guardar.' }, { status: 409 });
    return NextResponse.json({ error: 'No se pudo guardar la configuración. Ningún cambio fue aplicado.' }, { status: 503 });
  }
  after(async () => {
    try { await processWalletLocationJobs(businessId); }
    catch { console.error('[Wallet locations] El lote quedó pendiente para el procesador.'); }
  });
  return NextResponse.json({ revision: result.data, message: 'Configuración guardada. La sincronización quedó en cola.' });
}

export async function POST(_request: Request, { params }: Context) {
  const { businessId } = await params;
  if (!UUID_PATTERN.test(businessId)) return NextResponse.json({ error: 'Negocio inválido.' }, { status: 400 });
  const access = await getWalletLocationAccess(businessId);
  if (!access.allowed) return NextResponse.json({ error: 'No tenés permisos para sincronizar este negocio.' }, { status: 403 });
  const { data, error } = await walletLocationClient().from('businesses').select('wallet_locations_enabled').eq('id', businessId).maybeSingle();
  if (error || !data || (!access.superadmin && !data.wallet_locations_enabled)) return NextResponse.json({ error: 'El piloto no está disponible.' }, { status: 403 });
  try {
    return NextResponse.json(await processWalletLocationJobs(businessId));
  } catch {
    return NextResponse.json({ error: 'El lote sigue pendiente. Intentá nuevamente más tarde.' }, { status: 503 });
  }
}
