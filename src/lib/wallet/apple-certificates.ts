const ALIASES: Record<string, string> = {
  APPLE_SIGNER_CERT: 'APPLE_WALLET_SIGNER_CERT_BASE64',
  APPLE_PRIVATE_KEY: 'APPLE_WALLET_SIGNER_KEY_BASE64',
  APPLE_WWDR_CERT: 'APPLE_WALLET_WWDR_CERT_BASE64',
};

export function certificateEnvironment(name: string, env: NodeJS.ProcessEnv = process.env) {
  return env[name]?.trim() || env[`${name}_BASE64`]?.trim() || env[ALIASES[name]]?.trim() || '';
}
