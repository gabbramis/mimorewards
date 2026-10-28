import 'server-only';
import { walletLocationClient } from './location-database';
import { getCurrentAccess } from '@/lib/authz';
import { canManageWalletLocations, UUID_PATTERN, type WalletLocation } from './locations';

export async function getWalletLocationAccess(businessId: string) {
  const { user, role } = await getCurrentAccess();
  if (!user) return { allowed: false, superadmin: false };
  if (role === 'superadmin') return { allowed: true, superadmin: true };
  const { data, error } = await walletLocationClient().from('business_members')
    .select('role').eq('user_id', user.id).eq('business_id', businessId).maybeSingle();
  return { allowed: !error && canManageWalletLocations(role, data?.role ?? null), superadmin: false };
}

export async function readWalletLocations(businessId: string): Promise<WalletLocation[]> {
  if (!UUID_PATTERN.test(businessId)) return [];
  const supabase = walletLocationClient();
  const { data: business, error } = await supabase.from('businesses')
    .select('wallet_locations_enabled').eq('id', businessId).maybeSingle();
  // The migration is optional during rollout. Existing cards must keep working.
  if (error) {
    if (['42703', 'PGRST204'].includes(error.code)) return [];
    throw new Error('No se pudo comprobar la configuración de ubicaciones.');
  }
  if (!business?.wallet_locations_enabled) return [];
  const { data, error: locationError } = await supabase.from('branch_wallet_locations')
    .select('id, name, address, latitude, longitude, enabled, apple_relevant_text')
    .eq('business_id', businessId).order('id').limit(10);
  if (locationError) throw new Error('No se pudieron leer las ubicaciones de Wallet.');
  return (data ?? []).map((row) => ({
    id: row.id, name: row.name, address: row.address, latitude: row.latitude,
    longitude: row.longitude, enabled: row.enabled, appleRelevantText: row.apple_relevant_text,
  }));
}
