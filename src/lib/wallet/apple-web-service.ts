/** Wallet callbacks must use a public HTTPS service, independently of marketing URLs. */
export function resolveAppleWebServiceURL(requestUrl?: string, override?: string) {
  const explicit = override?.trim();
  const url = explicit
    ? new URL(explicit)
    : new URL('/api/apple-wallet', requestUrl || 'https://www.mimorewards.com');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('El servicio de Apple Wallet requiere una URL HTTPS pública, sin credenciales ni parámetros.');
  }
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|\[)/.test(host)) {
    throw new Error('Apple Wallet necesita un servicio público; el iPhone no puede actualizarse desde una URL local.');
  }
  // The production apex redirects at Vercel before Next can handle the request.
  // Wallet callbacks must go directly to www so Authorization survives the trip.
  if (host === 'mimorewards.com') url.hostname = 'www.mimorewards.com';
  return url.toString().replace(/\/$/, '');
}
