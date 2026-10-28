/** Shared validation and provider mapping. No secrets or database access. */
export const MAX_WALLET_LOCATIONS = 10;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WalletLocation = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  enabled: boolean;
  appleRelevantText: string;
};

export function validateWalletLocations(raw: unknown): WalletLocation[] {
  if (!Array.isArray(raw) || raw.length > MAX_WALLET_LOCATIONS) {
    throw new Error('Podés configurar hasta 10 ubicaciones por negocio en este piloto.');
  }
  const ids = new Set<string>();
  return raw.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ubicación inválida.');
    const item = value as Record<string, unknown>;
    const readText = (key: string, max: number, required = false) => {
      if (typeof item[key] !== 'string') throw new Error('Revisá los textos de la ubicación.');
      const result = (item[key] as string).trim();
      if ((required && !result) || result.length > max) throw new Error('Revisá el nombre, la dirección y el texto de cercanía.');
      return result;
    };
    const id = readText('id', 36, true);
    if (!UUID_PATTERN.test(id) || ids.has(id.toLowerCase())) throw new Error('Identificador de ubicación inválido o repetido.');
    ids.add(id.toLowerCase());
    if (typeof item.enabled !== 'boolean') throw new Error('Indicá si la ubicación está activa.');
    if (typeof item.latitude !== 'number' || !Number.isFinite(item.latitude) || Math.abs(item.latitude) > 90 ||
        typeof item.longitude !== 'number' || !Number.isFinite(item.longitude) || Math.abs(item.longitude) > 180) {
      throw new Error('Ingresá una latitud entre -90 y 90 y una longitud entre -180 y 180.');
    }
    return {
      id, name: readText('name', 120, true), address: readText('address', 250, true),
      latitude: item.latitude, longitude: item.longitude, enabled: item.enabled,
      appleRelevantText: readText('appleRelevantText', 120),
    };
  });
}

export function applePassLocations(locations: WalletLocation[]) {
  return locations.filter((location) => location.enabled).slice(0, MAX_WALLET_LOCATIONS).map((location) => ({
    latitude: location.latitude, longitude: location.longitude,
    ...(location.appleRelevantText ? { relevantText: location.appleRelevantText } : {}),
  }));
}

export function googleMerchantLocations(locations: WalletLocation[]) {
  return applePassLocations(locations).map(({ latitude, longitude }) => ({ latitude, longitude }));
}

export function canManageWalletLocations(role: string | null, membershipRole: string | null) {
  return role === 'superadmin' || membershipRole === 'merchant';
}
